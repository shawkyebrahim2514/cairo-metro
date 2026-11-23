import { describe, expect, it } from 'vitest';
import metro from '../../../data/metro.json';
import { searchStations } from './search';
import type { Station } from './types';

const stations = metro.stations as unknown as Station[];

const top = (q: string) => searchStations(stations, q)[0]?.station.id;

describe('alternative station names (real data)', () => {
  it.each([
    ['Tahrir', 'sadat'],
    ['ميدان التحرير', 'sadat'],
    ['Mohandessin', 'gamet-el-dowel'],
    ['Abdu Basha', 'abdo-pasha'],
    ['Cairo Stadium', 'stadium'],
  ])('%s -> %s', (q, id) => {
    expect(top(q)).toBe(id);
  });
});
