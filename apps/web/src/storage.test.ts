import { beforeEach, describe, expect, it } from 'vitest';
import { stationsById } from './data';
import { decodeEndpoint, encodeEndpoint, type Endpoint } from './endpoint';
import { isStarred, recordTrip, toggleStar, type SavedTrip } from './storage';

const memory = new Map<string, string>();
beforeEach(() => {
  memory.clear();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => memory.get(k) ?? null,
      setItem: (k: string, v: string) => void memory.set(k, v),
    },
  });
});

const station = (n: number): Endpoint => ({
  kind: 'station',
  station: stationsById.get([...stationsById.keys()][n]!)!,
});

describe('endpoint codec', () => {
  it('round-trips stations and points, including commas in names', () => {
    const s = station(3);
    expect(decodeEndpoint(encodeEndpoint(s))).toEqual(s);
    const p: Endpoint = {
      kind: 'point',
      point: { lat: 30.0444, lng: 31.2357 },
      name: 'Cafe, Zamalek',
    };
    expect(decodeEndpoint(encodeEndpoint(p))).toEqual(p);
  });

  it('rejects garbage and unknown stations', () => {
    expect(decodeEndpoint('s.nope')).toBeNull();
    expect(decodeEndpoint('p.x,y,z')).toBeNull();
    expect(decodeEndpoint('')).toBeNull();
  });
});

describe('saved trips', () => {
  it('keeps recents capped and starred trips forever', () => {
    let trips: SavedTrip[] = [];
    trips = toggleStar(trips, station(0), station(1));
    for (let i = 2; i < 12; i++) trips = recordTrip(trips, station(0), station(i));
    expect(trips.filter((t) => !t.starred)).toHaveLength(6);
    expect(isStarred(trips, station(0), station(1))).toBe(true);
    trips = toggleStar(trips, station(0), station(1));
    expect(isStarred(trips, station(0), station(1))).toBe(false);
  });
});
