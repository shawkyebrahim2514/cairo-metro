import { describe, expect, it } from 'vitest';
import { metro } from './data';
import { schematic, schematicPath } from './schematic';

describe('schematic layout', () => {
  it('places every station exactly once and apart from the others', () => {
    const seen = new Set<string>();
    for (const s of metro.stations) {
      const p = schematic.positions.get(s.id);
      expect(p, s.id).toBeDefined();
      const key = `${Math.round(p!.x)},${Math.round(p!.y)}`;
      expect(seen.has(key), `${s.id} overlaps another station`).toBe(false);
      seen.add(key);
    }
  });

  it('keeps neighbouring stations on a branch at a readable distance', () => {
    for (const line of metro.lines) {
      for (const b of line.branches) {
        for (let i = 1; i < b.stations.length; i++) {
          const a = schematic.positions.get(b.stations[i - 1]!)!;
          const c = schematic.positions.get(b.stations[i]!)!;
          expect(Math.hypot(a.x - c.x, a.y - c.y), `${b.id} #${i}`).toBeGreaterThan(20);
        }
      }
    }
  });

  it('draws bends between stations and reverses them for the opposite direction', () => {
    const forward = schematicPath(['helwan', 'ain-helwan']);
    expect(forward.length).toBeGreaterThanOrEqual(2);
    const ids = ['mohamed-naguib', 'attaba'];
    const there = schematicPath(ids).length;
    expect(schematicPath([...ids].reverse()).length).toBe(there);
  });
});
