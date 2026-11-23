import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { searchStations } from './search';

const data = JSON.parse(readFileSync(new URL('../../../data/metro.json', import.meta.url), 'utf8'));

const top = (q: string) => searchStations(data.stations, q)[0]?.station.id;

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
