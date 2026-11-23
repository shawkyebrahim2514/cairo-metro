import { planRoute, type MetroGraph } from './routing';

export interface Reachable {
  stationId: string;
  stops: number;
  totalSec: number;
  transfers: number;
}

export interface ReachableOptions {
  /** Only stations reachable within this many seconds (including transfers). */
  maxSec?: number;
  /** Only stations at most this many stops away. */
  maxStops?: number;
}

/** Stations reachable from a station by metro, nearest in time first. The origin is excluded. */
export function reachableStations(
  graph: MetroGraph,
  from: string,
  options: ReachableOptions = {},
): Reachable[] {
  const { maxSec = Infinity, maxStops = Infinity } = options;
  const out: Reachable[] = [];
  for (const station of graph.data.stations) {
    if (station.id === from || station.status !== 'open') continue;
    const route = planRoute(graph, from, station.id);
    if (!route || route.totalSec > maxSec || route.stops > maxStops) continue;
    out.push({
      stationId: station.id,
      stops: route.stops,
      totalSec: route.totalSec,
      transfers: route.transfers.length,
    });
  }
  return out.sort((a, b) => a.totalSec - b.totalSec);
}
