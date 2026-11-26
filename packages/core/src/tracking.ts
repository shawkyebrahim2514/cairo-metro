import { haversineMeters, type LatLng } from './geo';
import type { Route } from './routing';

export type StepKind = 'board' | 'station' | 'change' | 'arrive';

export interface TrackStep {
  stationId: string;
  kind: StepKind;
}

/** What happens at each station of a route: board, pass, change line, or get off. */
export function trackSteps(route: Route): TrackStep[] {
  const changes = new Set(route.transfers.map((t) => t.stationId));
  const last = route.stations.length - 1;
  return route.stations.map((stationId, i) => ({
    stationId,
    kind:
      i === last && last > 0
        ? 'arrive'
        : i === 0
          ? 'board'
          : changes.has(stationId)
            ? 'change'
            : 'station',
  }));
}

/** Ride duration (seconds) for each inter-station hop along a route. */
export function routeHopSecs(route: Route): number[] {
  const hops: number[] = [];
  for (const leg of route.legs) {
    if (leg.hopSec && leg.hopSec.length === leg.stations.length - 1) {
      hops.push(...leg.hopSec);
    } else {
      const per = leg.stops > 0 ? leg.rideSec / leg.stops : 0;
      for (let j = 1; j < leg.stations.length; j++) hops.push(per);
    }
  }
  return hops;
}

export interface RouteSnap {
  /** Index in `route.stations` of the station nearest to the fix. */
  index: number;
  /** Last station reached: the nearest one when within STATION_REACH_M, otherwise the one just passed. */
  reached: number;
  /** Index of the nearest route segment (between `segment` and `segment + 1`). */
  segment: number;
  /** Fraction [0, 1] along `segment` of the closest point on the route line. */
  t: number;
  /** Point on the route polyline closest to the fix. */
  projected: LatLng;
  /** Distance from the fix to the route line, in metres. */
  distanceM: number;
  offRoute: boolean;
}

/** A fix this close to a station counts as having reached it. */
export const STATION_REACH_M = 300;

/** Closest point on segment a-b to `p`, with distance in metres and fraction `t` in [0, 1]. */
function projectToSegment(
  p: LatLng,
  a: LatLng,
  b: LatLng,
): { distanceM: number; t: number; point: LatLng } {
  const kx = 111320 * Math.cos((p.lat * Math.PI) / 180);
  const ky = 110540;
  const ax = (a.lng - p.lng) * kx;
  const ay = (a.lat - p.lat) * ky;
  const bx = (b.lng - p.lng) * kx;
  const by = (b.lat - p.lat) * ky;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
  return {
    distanceM: Math.hypot(ax + t * dx, ay + t * dy),
    t,
    point: { lat: a.lat + t * (b.lat - a.lat), lng: a.lng + t * (b.lng - a.lng) },
  };
}

/** Point along the route polyline at station `index` plus `fraction` (0..1) toward `index + 1`. */
export function interpolateRoute(coords: LatLng[], index: number, fraction = 0): LatLng {
  if (coords.length === 0) return { lat: 0, lng: 0 };
  const i = Math.max(0, Math.min(index, coords.length - 1));
  const a = coords[i]!;
  const b = coords[i + 1];
  if (!b || fraction <= 0) return a;
  const f = Math.max(0, Math.min(1, fraction));
  return { lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f };
}

/** Matches a location fix to the route: nearest station, projected point, and off-route flag. */
export function snapToRoute(coords: LatLng[], fix: LatLng, maxOffRouteM = 600): RouteSnap {
  let index = 0;
  let best = Infinity;
  coords.forEach((c, i) => {
    const d = haversineMeters(fix, c);
    if (d < best) {
      best = d;
      index = i;
    }
  });
  let line = best;
  let segment = Math.min(index, Math.max(0, coords.length - 2));
  let bestT = 0;
  let projected: LatLng = coords[index] ?? fix;
  for (let i = 0; i + 1 < coords.length; i++) {
    const proj = projectToSegment(fix, coords[i]!, coords[i + 1]!);
    if (proj.distanceM < line) {
      line = proj.distanceM;
      segment = i;
      bestT = proj.t;
      projected = proj.point;
    }
  }
  // Between stations the nearest one may be the next, so only count it once the rider is close.
  const reached = best <= STATION_REACH_M ? index : Math.min(segment, index);
  return {
    index,
    reached,
    segment,
    t: bestT,
    projected,
    distanceM: line,
    offRoute: line > maxOffRouteM,
  };
}

export interface TripProgress {
  index: number;
  atEnd: boolean;
  /** Next station to reach, or null at the end. */
  nextStationId: string | null;
  /** The next change or arrival ahead (or the current station if you are standing on it). */
  event: { kind: 'change' | 'arrive'; stationId: string; stopsAway: number } | null;
  stopsLeft: number;
  etaSec: number;
}

/** Remaining stops, the next change or exit, and an estimated time left from station `index`. */
export function tripProgress(route: Route, index: number): TripProgress {
  const steps = trackSteps(route);
  const i = Math.max(0, Math.min(index, steps.length - 1));
  const hopSec = routeHopSecs(route);
  let eta = 0;
  for (let k = i; k < hopSec.length; k++) eta += hopSec[k] ?? 0;
  const transferAt = new Map(route.transfers.map((t) => [t.stationId, t.sec]));
  let event: TripProgress['event'] = null;
  for (let k = i; k < steps.length; k++) {
    const s = steps[k]!;
    if (s.kind === 'change' || s.kind === 'arrive') {
      event ??= { kind: s.kind, stationId: s.stationId, stopsAway: k - i };
    }
    if (s.kind === 'change') eta += transferAt.get(s.stationId) ?? 0;
  }
  return {
    index: i,
    atEnd: i >= steps.length - 1,
    nextStationId: steps[i + 1]?.stationId ?? null,
    event,
    stopsLeft: steps.length - 1 - i,
    etaSec: Math.round(eta),
  };
}

export type AlertKind = 'station' | 'warn' | 'change' | 'arrive';

/**
 * The alert to raise on reaching station `index`: arrival and changes first, then the
 * "n stops before" warning (0 disables it), otherwise a plain station pulse.
 */
export function alertAt(route: Route, index: number, warnStops: number): AlertKind | null {
  const steps = trackSteps(route);
  const s = steps[index];
  if (!s || s.kind === 'board') return null;
  if (s.kind === 'arrive') return 'arrive';
  if (s.kind === 'change') return 'change';
  const p = tripProgress(route, index);
  if (warnStops > 0 && p.event && p.event.stopsAway === warnStops) return 'warn';
  return 'station';
}
