import { describe, expect, it } from 'vitest';
import { stationsById } from './data';
import type { Endpoint } from './endpoint';
import { planTrips } from './trip';

const station = (id: string): Endpoint => ({ kind: 'station', station: stationsById.get(id)! });
const someId = (n: number) => [...stationsById.keys()][n]!;

describe('planTrips', () => {
  it('reports identical places as close by instead of planning a metro trip', () => {
    const e = station(someId(0));
    const plan = planTrips(e, e);
    expect(plan.closeBy).toBe(true);
    expect(plan.trips).toHaveLength(0);
  });

  it('plans a door-to-door trip between far points with walking legs', () => {
    const from: Endpoint = { kind: 'point', point: { lat: 30.0444, lng: 31.2357 }, name: 'A' };
    const to: Endpoint = { kind: 'point', point: { lat: 30.13, lng: 31.4 }, name: 'B' };
    const [first] = planTrips(from, to).trips;
    expect(first).toBeDefined();
    expect(first!.walkIn).not.toBeNull();
    expect(first!.totalSec).toBeGreaterThan(first!.route.totalSec);
  });
});
