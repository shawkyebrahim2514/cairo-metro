import { nearestStations, planRoutes, type NearestStation, type Route } from '@cairo-metro/core';
import { faresData, graph, metro } from './data';
import { endpointPoint, type Endpoint } from './endpoint';

export interface Trip {
  route: Route;
  /** Walk to the boarding station; null when the origin is a station. */
  walkIn: NearestStation | null;
  walkOut: NearestStation | null;
  totalSec: number;
}

/** How many nearby stations are tried at a place that is not itself a station. */
const CANDIDATES = 2;

function access(e: Endpoint): { id: string; walk: NearestStation | null }[] {
  if (e.kind === 'station') return [{ id: e.station.id, walk: null }];
  return nearestStations(metro.stations, endpointPoint(e), { limit: CANDIDATES }).map((n) => ({
    id: n.station.id,
    walk: n,
  }));
}

/** Door-to-door trips: the best (walk + ride + walk) overall, plus the fewest-transfers alternative. */
export function planTrips(from: Endpoint, to: Endpoint): { trips: Trip[]; sameStation: boolean } {
  const starts = access(from);
  const ends = access(to);
  const all: Trip[] = [];
  let sameStation = false;

  for (const a of starts) {
    for (const b of ends) {
      if (a.id === b.id) {
        sameStation = true;
        continue;
      }
      for (const route of planRoutes(graph, a.id, b.id, { fares: faresData })) {
        all.push({
          route,
          walkIn: a.walk,
          walkOut: b.walk,
          totalSec: route.totalSec + (a.walk?.walkSec ?? 0) + (b.walk?.walkSec ?? 0),
        });
      }
    }
  }
  if (all.length === 0) return { trips: [], sameStation };

  const fastest = all.reduce((x, y) => (y.totalSec < x.totalSec ? y : x));
  const fewest = all.reduce((x, y) =>
    y.route.transfers.length < x.route.transfers.length ||
    (y.route.transfers.length === x.route.transfers.length && y.totalSec < x.totalSec)
      ? y
      : x,
  );
  const sameTrip = fewest.route.from === fastest.route.from && fewest.route.to === fastest.route.to;
  const trips =
    fewest.route.transfers.length < fastest.route.transfers.length &&
    !(sameTrip && fewest.route.mode === fastest.route.mode)
      ? [fastest, fewest]
      : [fastest];
  return { trips, sameStation: false };
}
