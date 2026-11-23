import { beforeEach, describe, expect, it } from 'vitest';
import { stationsById } from './data';
import { decodeEndpoint, encodeEndpoint, type Endpoint } from './endpoint';
import {
  clearHistory,
  isStarred,
  loadPlace,
  recordTrip,
  savePlace,
  toggleStar,
  type SavedTrip,
} from './storage';

const memory = new Map<string, string>();
beforeEach(() => {
  memory.clear();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => memory.get(k) ?? null,
      setItem: (k: string, v: string) => void memory.set(k, v),
      removeItem: (k: string) => void memory.delete(k),
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
    for (let i = 2; i < 40; i++) trips = recordTrip(trips, station(0), station(i));
    expect(trips.filter((t) => !t.starred)).toHaveLength(30);
    expect(isStarred(trips, station(0), station(1))).toBe(true);
    trips = toggleStar(trips, station(0), station(1));
    expect(isStarred(trips, station(0), station(1))).toBe(false);
  });

  it('stamps trips, and clearing history keeps the starred ones', () => {
    let trips: SavedTrip[] = [];
    trips = toggleStar(trips, station(0), station(1));
    trips = recordTrip(trips, station(0), station(2));
    expect(trips.every((t) => typeof t.at === 'number')).toBe(true);
    trips = clearHistory(trips);
    expect(trips).toHaveLength(1);
    expect(trips[0]!.starred).toBe(true);
  });
});

describe('home and work places', () => {
  it('saves, loads and removes a slot', () => {
    const s = station(4);
    expect(loadPlace('home')).toBeNull();
    savePlace('home', s);
    expect(loadPlace('home')).toEqual(s);
    expect(loadPlace('work')).toBeNull();
    savePlace('home', null);
    expect(loadPlace('home')).toBeNull();
  });
});
