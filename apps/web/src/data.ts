import fares from '../../../data/curated/fares.json';
import hours from '../../../data/curated/hours.json';
import metroJson from '../../../data/metro.json';
import {
  buildGraph,
  createPlaceResolver,
  type FaresData,
  type HoursData,
  type MetroData,
  type Place,
  type PlacesData,
  type Station,
} from '@cairo-metro/core';

export const metro = metroJson as unknown as MetroData;
export const faresData = fares as unknown as FaresData;
export const hoursData = hours as unknown as HoursData;
export const graph = buildGraph(metro);
export const stationsById = new Map<string, Station>(metro.stations.map((s) => [s.id, s]));
export const lineColour = new Map(metro.lines.map((l) => [l.id, l.colour]));

export type PlaceResolver = ReturnType<typeof createPlaceResolver>;

/** The places index is large, so it is loaded after the first paint. */
export async function loadPlaceResolver(): Promise<PlaceResolver> {
  resolverPromise ??= import('../../../data/places.json')
    .then((mod) => createPlaceResolver((mod.default as unknown as PlacesData).places as Place[]))
    .catch((err: unknown) => {
      resolverPromise = null;
      throw err;
    });
  return resolverPromise;
}

let resolverPromise: Promise<PlaceResolver> | null = null;
