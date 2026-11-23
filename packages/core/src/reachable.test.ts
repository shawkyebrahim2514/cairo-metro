import { describe, expect, it } from 'vitest';
import metroJson from '../../../data/metro.json';
import { buildGraph } from './routing';
import { reachableStations } from './reachable';
import type { MetroData } from './types';

const graph = buildGraph(metroJson as unknown as MetroData);

describe('reachableStations', () => {
  it('returns stations within the time limit, nearest first, without the origin', () => {
    const r = reachableStations(graph, 'sadat', { maxSec: 10 * 60 });
    expect(r.length).toBeGreaterThan(3);
    expect(r.every((x) => x.totalSec <= 600 && x.stationId !== 'sadat')).toBe(true);
    expect(r.map((x) => x.totalSec)).toEqual([...r.map((x) => x.totalSec)].sort((a, b) => a - b));
  });

  it('limits by stops and includes transfer destinations', () => {
    const r = reachableStations(graph, 'sadat', { maxStops: 2 });
    const ids = r.map((x) => x.stationId);
    expect(ids).toContain('saad-zaghloul');
    expect(ids).toContain('mohamed-naguib');
    expect(r.every((x) => x.stops <= 2)).toBe(true);
  });
});
