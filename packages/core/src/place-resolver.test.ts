import { describe, expect, it } from 'vitest';
import places from '../../../data/places.json';
import metroJson from '../../../data/metro.json';
import { GREATER_CAIRO_BBOX, inBBox } from './geo';
import { nearestStations } from './nearest';
import { createPlaceResolver, parseSharedText } from './place-resolver';
import type { MetroData, Place } from './types';

const resolver = createPlaceResolver(places.places as Place[]);

describe('parseSharedText', () => {
  it('splits name, address and link', () => {
    expect(
      parseSharedText('City Stars\nOmar Ibn El-Khattab, Nasr City\nhttps://maps.app.goo.gl/AbC123'),
    ).toEqual({
      url: 'https://maps.app.goo.gl/AbC123',
      name: 'City Stars',
      address: 'Omar Ibn El-Khattab, Nasr City',
    });
  });

  it('handles a one-line "name - link" and a link only', () => {
    expect(parseSharedText('Cairo Tower - https://maps.app.goo.gl/x')).toEqual({
      url: 'https://maps.app.goo.gl/x',
      name: 'Cairo Tower',
    });
    expect(parseSharedText('https://maps.app.goo.gl/x')).toEqual({
      url: 'https://maps.app.goo.gl/x',
    });
  });
});

describe('landmark sanity (real data)', () => {
  const metro = metroJson as unknown as MetroData;
  const cases: [string, string, number][] = [
    ['Cairo Tower', 'opera', 800],
    ['Cairo Opera House', 'opera', 400],
    ['Egyptian Museum', 'sadat', 800],
    ['Tahrir Square', 'sadat', 400],
    ['Cairo University', 'cairo-university', 800],
    ['Cairo Citadel', '', Infinity],
    ['Midan Tahrir', 'sadat', 400],
  ];
  it.each(cases)('%s resolves near the expected station', (query, stationId, maxMeters) => {
    const r = resolver.resolve(query);
    const place =
      r.status === 'resolved' ? r.place : r.status === 'ambiguous' ? r.candidates[0] : undefined;
    expect(place, query).toBeDefined();
    const nearest = nearestStations(metro.stations, place!.point, { limit: 1 })[0]!;
    if (stationId) {
      expect(nearest.station.id, query).toBe(stationId);
      expect(nearest.straightMeters).toBeLessThan(maxMeters);
    }
  });

  it('has no numbered-block noise entries', () => {
    expect((places.places as Place[]).filter((p) => /^block \d+$/i.test(p.en))).toHaveLength(0);
  });

  it('keeps every place inside Greater Cairo with at least one name', () => {
    for (const p of places.places as Place[]) {
      expect(inBBox(p, GREATER_CAIRO_BBOX)).toBe(true);
      expect(p.en || p.ar).toBeTruthy();
    }
  });
});

describe('place resolver (real index)', () => {
  it('has a usable index', () => {
    expect(places.places.length).toBeGreaterThan(5000);
  });

  it('resolves coordinates from a long link without touching the index', () => {
    const r = resolver.resolve('https://www.google.com/maps/@30.01,31.2,15z');
    expect(r).toMatchObject({ status: 'resolved', place: { source: 'coordinates' } });
  });

  it('finds a well-known place by English name, with spelling variants', () => {
    for (const q of ['Cairo University', 'cairo univercity']) {
      const r = resolver.searchPlaces(q, 5);
      expect(r.length, q).toBeGreaterThan(0);
    }
  });

  it('finds places by Arabic name', () => {
    expect(resolver.searchPlaces('جامعة القاهرة', 5).length).toBeGreaterThan(0);
  });

  it('uses the name from shared text when the link is a short link', () => {
    const name = (places.places as Place[]).find((p) => p.en && p.type === 'mall')!.en;
    const r = resolver.resolve(`${name}\nSomewhere, Cairo\nhttps://maps.app.goo.gl/AbC123`);
    expect(['resolved', 'ambiguous']).toContain(r.status);
  });

  it('asks for a name when only a short link is pasted', () => {
    expect(resolver.resolve('https://maps.app.goo.gl/AbC123')).toEqual({
      status: 'needs-name',
      url: 'https://maps.app.goo.gl/AbC123',
    });
  });

  it('reports empty and not-found input', () => {
    expect(resolver.resolve('  ')).toEqual({ status: 'empty' });
    expect(resolver.resolve('qqqzzzxxxwww').status).toBe('not-found');
  });
});
