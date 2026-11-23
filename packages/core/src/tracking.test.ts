import { describe, expect, it } from 'vitest';
import metroJson from '../../../data/metro.json';
import { haversineMeters } from './geo';
import { buildGraph, planRoute } from './routing';
import { alertAt, snapToRoute, trackSteps, tripProgress } from './tracking';
import type { MetroData } from './types';

const data = metroJson as unknown as MetroData;
const graph = buildGraph(data);
const byId = new Map(data.stations.map((s) => [s.id, s]));
const route = planRoute(graph, 'el-monib', 'cairo-university')!;
const coords = route.stations.map((id) => ({ lat: byId.get(id)!.lat, lng: byId.get(id)!.lng }));

describe('trip tracking', () => {
  it('labels boarding, passing and arrival steps', () => {
    const kinds = trackSteps(route).map((s) => s.kind);
    expect(kinds[0]).toBe('board');
    expect(kinds.at(-1)).toBe('arrive');
    expect(kinds.slice(1, -1).every((k) => k === 'station')).toBe(true);
  });

  it('marks the interchange as a change step', () => {
    const r = planRoute(graph, 'el-monib', 'el-malek-el-saleh')!;
    const changes = trackSteps(r).filter((s) => s.kind === 'change');
    expect(changes.length).toBe(r.transfers.length);
  });

  it('snaps a fix beside a station to it and flags a distant one as off route', () => {
    const near = { lat: coords[2]!.lat + 0.0003, lng: coords[2]!.lng };
    expect(snapToRoute(coords, near)).toMatchObject({ index: 2, offRoute: false });
    const far = { lat: coords[2]!.lat + 0.05, lng: coords[2]!.lng };
    expect(snapToRoute(coords, far).offRoute).toBe(true);
  });

  it('only counts a station as reached when the rider is close to it', () => {
    const i = coords.findIndex(
      (c, k) => k + 1 < coords.length && haversineMeters(c, coords[k + 1]!) > 900,
    );
    expect(i).toBeGreaterThanOrEqual(0);
    const [a, b] = [coords[i]!, coords[i + 1]!];
    const mid = { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
    const snap = snapToRoute(coords, mid);
    expect(snap.reached).toBe(i);
    const atNext = { lat: b.lat + 0.0003, lng: b.lng };
    expect(snapToRoute(coords, atNext).reached).toBe(i + 1);
  });

  it('reports stops left, the exit and a shrinking ETA', () => {
    const start = tripProgress(route, 0);
    const mid = tripProgress(route, 3);
    expect(start.stopsLeft).toBe(route.stops);
    expect(start.event).toMatchObject({ kind: 'arrive', stopsAway: route.stops });
    expect(mid.etaSec).toBeLessThan(start.etaSec);
    expect(tripProgress(route, route.stations.length - 1).atEnd).toBe(true);
  });

  it('includes a transfer in the ETA until it is passed', () => {
    const r = planRoute(graph, 'el-monib', 'el-malek-el-saleh')!;
    const change = r.stations.indexOf(r.transfers[0]!.stationId);
    expect(tripProgress(r, change).etaSec).toBeGreaterThan(tripProgress(r, change + 1).etaSec);
  });

  it('chooses the alert: warn before the exit, arrive at the end, nothing at boarding', () => {
    const last = route.stations.length - 1;
    expect(alertAt(route, 0, 2)).toBeNull();
    expect(alertAt(route, last, 2)).toBe('arrive');
    expect(alertAt(route, last - 2, 2)).toBe('warn');
    expect(alertAt(route, last - 2, 0)).toBe('station');
    expect(alertAt(route, 1, 2)).toBe('station');
  });
});
