import { haversineMeters, type LatLng } from './geo';
import type { LineId, Station } from './types';

export const WALK_SPEED_MPS = 1.33;
/** Street distance is longer than a straight line; used when no routing provider is available. */
export const DETOUR_FACTOR = 1.3;

export interface NearestOptions {
  limit?: number;
  /** Ignore stations farther than this straight-line distance. */
  maxMeters?: number;
  includePlanned?: boolean;
  /** Pluggable walking distance (e.g. from a routing service); defaults to haversine * DETOUR_FACTOR. */
  walkingMeters?: (from: LatLng, to: Station) => number;
}

export interface NearestStation {
  station: Station;
  straightMeters: number;
  walkMeters: number;
  walkSec: number;
  lines: LineId[];
}

export function nearestStations(
  stations: Station[],
  origin: LatLng,
  options: NearestOptions = {},
): NearestStation[] {
  const { limit = 3, maxMeters = Infinity, includePlanned = false } = options;
  const walk = options.walkingMeters ?? ((from, st) => haversineMeters(from, st) * DETOUR_FACTOR);

  return stations
    .filter((s) => includePlanned || s.status === 'open')
    .map((station) => {
      const straightMeters = haversineMeters(origin, station);
      return { station, straightMeters };
    })
    .filter((r) => r.straightMeters <= maxMeters)
    .map((r) => {
      const walkMeters = walk(origin, r.station);
      return {
        station: r.station,
        straightMeters: r.straightMeters,
        walkMeters,
        walkSec: Math.round(walkMeters / WALK_SPEED_MPS),
        lines: [...new Set(r.station.lines.map((l) => l.line))],
      };
    })
    .sort((a, b) => a.walkMeters - b.walkMeters)
    .slice(0, limit);
}
