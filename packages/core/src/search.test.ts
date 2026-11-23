import { describe, expect, it } from 'vitest';
import { normalizeForSearch, searchStations } from './search';
import type { Station } from './types';

const mk = (id: string, en: string, ar: string): Station => ({
  id,
  name: { en, ar },
  aliases: [],
  lat: 30,
  lng: 31,
  lines: [],
  interchange: false,
  transferSec: null,
  status: 'open',
  verified: true,
  wikidata: null,
  osmNodeIds: [],
  notes: [],
});

const data = {
  stations: [
    mk('abbassia', 'Abbassia', 'العباسية'),
    mk('el-marg', 'El-Marg', 'المرج'),
    mk('new-el-marg', 'New El-Marg', 'المرج الجديدة'),
    mk('saad-zaghloul', 'Saad Zaghloul', 'سعد زغلول'),
    mk('sadat', 'Sadat', 'السادات'),
    mk('shubra-el-kheima', 'Shubra El-Kheima', 'شبرا الخيمة'),
  ],
};

const top = (q: string) => searchStations(data.stations, q, 3).map((m) => m.station.name.en);

describe('normalizeForSearch', () => {
  it('ignores El/Al articles, hyphens and case', () => {
    const k = normalizeForSearch('El-Marg');
    expect(normalizeForSearch('el marg')).toBe(k);
    expect(normalizeForSearch('Elmarg')).toBe(k);
    expect(normalizeForSearch('Al Marg')).toBe(k);
    expect(normalizeForSearch('marg')).toBe(k);
  });

  it('treats e/i, o/u, p/b and doubled letters as the same', () => {
    expect(normalizeForSearch('Shobra')).toBe(normalizeForSearch('Shubra'));
    expect(normalizeForSearch('Sayyeda')).toBe(normalizeForSearch('Sayeda'));
    expect(normalizeForSearch('Saad')).toBe(normalizeForSearch('Sad'));
    expect(normalizeForSearch('Ibrahim')).toBe(normalizeForSearch('Ebrahim'));
    expect(normalizeForSearch('Pasha')).toBe(normalizeForSearch('Basha'));
  });

  it('normalises Arabic letter variants and the definite article', () => {
    expect(normalizeForSearch('الشهداء')).toBe(normalizeForSearch('شهداء'));
    expect(normalizeForSearch('أحمد')).toBe(normalizeForSearch('احمد'));
  });
});

describe('searchStations', () => {
  it('finds stations despite spelling variants', () => {
    expect(top('el marg')[0]).toBe('El-Marg');
    expect(top('elmarg')[0]).toBe('El-Marg');
    expect(top('sad zaghlul')[0]).toBe('Saad Zaghloul');
    expect(top('shobra el kheima')[0]).toMatch(/Shubra|Shobra/i);
    expect(top('sadat')[0]).toMatch(/Sadat/i);
  });

  it('finds stations by Arabic name', () => {
    expect(searchStations(data.stations, 'المرج').length).toBeGreaterThan(0);
  });

  it('matches words typed in a different order', () => {
    expect(top('kheima shubra')[0]).toBe('Shubra El-Kheima');
  });

  it('tolerates a small typo and returns nothing for gibberish', () => {
    expect(top('abbassiya').join()).toMatch(/Abb?assi/i);
    expect(searchStations(data.stations, 'zzzzqqqq')).toEqual([]);
  });
});
