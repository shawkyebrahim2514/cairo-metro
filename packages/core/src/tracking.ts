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

export interface RouteSnap {
  /** Index in `route.stations` of the station nearest to the fix. */
  index: number;
  /** Distance from the fix to the route line, in metres. */
  distanceM: number;
  offRoute: boolean;
}

/** Metres from `p` to the segment a-b (local flat approximation, fine at city scale). */
function distanceToSegmentM(p: LatLng, a: LatLng, b: LatLng): number {
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
  return Math.hypot(ax + t * dx, ay + t * dy);
}

/** Matches a location fix to the route: nearest station and whether the fix is off the route line. */
export function snapToRoute(coords: LatLng[], fix: LatLng, maxOffRouteM = 400): RouteSnap {
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
  for (let i = 0; i + 1 < coords.length; i++) {
    line = Math.min(line, distanceToSegmentM(fix, coords[i]!, coords[i + 1]!));
  }
  return { index, distanceM: line, offRoute: line > maxOffRouteM };
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
  const hopSec: number[] = [];
  for (const leg of route.legs) {
    const per = leg.stops > 0 ? leg.rideSec / leg.stops : 0;
    for (let j = 1; j < leg.stations.length; j++) hopSec.push(per);
  }
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
