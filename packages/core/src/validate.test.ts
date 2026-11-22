import { describe, expect, it } from 'vitest';
import { validateMetroData } from './validate';
import type { MetroData, Station } from './types';

const station = (id: string, lat: number, lines: Station['lines'] = []): Station => ({
  id,
  name: { en: id, ar: 'محطة' },
  aliases: [],
  lat,
  lng: 31.2,
  lines,
  interchange: new Set(lines.map((l) => l.line)).size > 1,
  transferSec: null,
  status: 'open',
  wikidata: null,
  osmNodeIds: [],
  notes: [],
});

const base = (): MetroData => ({
  generatedAt: '',
  attribution: [],
  stations: [
    station('a', 30.0, [{ line: 'L1', branch: 'L1-main', order: 0 }]),
    station('b', 30.02, [{ line: 'L1', branch: 'L1-main', order: 1 }]),
  ],
  lines: [
    {
      id: 'L1',
      name: { en: 'Line 1', ar: 'الخط الأول' },
      colour: '#000',
      operator: 'x',
      branches: [
        {
          id: 'L1-main',
          name: { en: 'x', ar: 'x' },
          stations: ['a', 'b'],
          segments: [{ from: 'a', to: 'b', distanceM: 2200, rideSec: 200, estimated: true }],
        },
      ],
    },
  ],
});

describe('validateMetroData', () => {
  it('accepts a minimal valid network', () => {
    expect(validateMetroData(base())).toEqual([]);
  });

  it('reports orphan stations, disconnected graph and out-of-bounds coordinates', () => {
    const data = base();
    data.stations.push(station('far', 10));
    const codes = validateMetroData(data).map((i) => i.code);
    expect(codes).toContain('orphan');
    expect(codes).toContain('out-of-bounds');
    expect(codes).toContain('disconnected');
  });

  it('checks expected per-line counts', () => {
    const issues = validateMetroData(base(), { expectedLineCounts: { L1: 3 } });
    expect(issues.map((i) => i.code)).toContain('line-count');
  });
});
