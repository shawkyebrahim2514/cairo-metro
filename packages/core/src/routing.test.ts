import { describe, expect, it } from 'vitest';
import fares from '../../../data/curated/fares.json';
import metro from '../../../data/metro.json';
import { bboxOf, GREATER_CAIRO_BBOX, inBBox } from './geo';
import { nearestStations } from './nearest';
import { buildGraph, planRoute, planRoutes } from './routing';
import type { FaresData } from './fares';
import type { MetroData } from './types';

const data = metro as unknown as MetroData;
const graph = buildGraph(data);
const name = (id: string) => data.stations.find((s) => s.id === id)!.name.en;
const id = (en: string) => data.stations.find((s) => s.name.en === en)!.id;

describe('geo bbox', () => {
  it('contains every station inside Greater Cairo', () => {
    expect(data.stations.every((s) => inBBox(s, GREATER_CAIRO_BBOX))).toBe(true);
    expect(bboxOf([])).toBeNull();
    expect(
      bboxOf([
        { lat: 1, lng: 2 },
        { lat: 3, lng: 0 },
      ]),
    ).toEqual({
      south: 1,
      north: 3,
      west: 0,
      east: 2,
    });
  });
});

describe('nearestStations', () => {
  it('finds Sadat first for Tahrir Square', () => {
    const r = nearestStations(data.stations, { lat: 30.0444, lng: 31.2357 }, { limit: 3 });
    expect(r).toHaveLength(3);
    expect(r[0]!.station.id).toBe('sadat');
    expect(r[0]!.walkMeters).toBeGreaterThan(r[0]!.straightMeters);
    expect(r.map((x) => x.walkMeters)).toEqual(
      [...r.map((x) => x.walkMeters)].sort((a, b) => a - b),
    );
  });

  it('respects maxMeters and a custom walking provider', () => {
    expect(nearestStations(data.stations, { lat: 29.0, lng: 30.0 }, { maxMeters: 1000 })).toEqual(
      [],
    );
    const r = nearestStations(
      data.stations,
      { lat: 30.0444, lng: 31.2357 },
      { limit: 1, walkingMeters: () => 100 },
    );
    expect(r[0]!.walkMeters).toBe(100);
    expect(r[0]!.walkSec).toBe(75);
  });

  it('lists every line at an interchange', () => {
    const r = nearestStations(
      data.stations,
      data.stations.find((s) => s.id === 'nasser')!,
      { limit: 1 },
    );
    expect(r[0]!.lines.sort()).toEqual(['L1', 'L3']);
  });
});

describe('planRoute', () => {
  it('rides one line end to end with no transfers', () => {
    const r = planRoute(graph, 'helwan', 'new-el-marg')!;
    expect(r.legs).toHaveLength(1);
    expect(r.transfers).toHaveLength(0);
    expect(r.stops).toBe(34);
    expect(r.legs[0]!.towards).toEqual(['new-el-marg']);
    expect(planRoute(graph, 'new-el-marg', 'helwan')!.legs[0]!.towards).toEqual(['helwan']);
  });

  it('returns a zero-length route for the same station and null for unknown ids', () => {
    expect(planRoute(graph, 'sadat', 'sadat')!.totalSec).toBe(0);
    expect(planRoute(graph, 'sadat', 'nowhere')).toBeNull();
    expect(planRoute(graph, 'nowhere', 'sadat')).toBeNull();
  });

  it('transfers at the right interchange between L1 and L2', () => {
    const r = planRoute(graph, 'helwan', 'shubra-el-kheima')!;
    expect(r.legs.map((l) => l.line)).toEqual(['L1', 'L2']);
    expect(['sadat', 'el-shohadaa']).toContain(r.transfers[0]!.stationId);
    expect(r.transferSec).toBe(240);
    expect(r.totalSec).toBe(r.rideSec + r.transferSec);
  });

  it('does not repeat the transfer station in the station list', () => {
    const r = planRoute(graph, 'helwan', 'shubra-el-kheima')!;
    expect(new Set(r.stations).size).toBe(r.stations.length);
    expect(r.stations.length).toBe(r.stops + 1);
  });

  it('runs through the L3 trunk to the Imbaba and Cairo University branches', () => {
    const imbaba = planRoute(graph, 'adly-mansour', 'rod-el-farag-axis')!;
    expect(imbaba.legs).toHaveLength(1);
    expect(imbaba.transfers).toHaveLength(0);
    expect(imbaba.legs[0]!.towards).toEqual(['rod-el-farag-axis']);
    const cu = planRoute(graph, 'adly-mansour', 'cairo-university', { mode: 'fewest-transfers' })!;
    expect(cu.transfers).toHaveLength(0);
    expect(cu.legs[0]!.towards).toEqual(['cairo-university']);
  });

  it('requires a branch change at Kit-Kat between the two L3 branches', () => {
    const l3 = data.lines.find((l) => l.id === 'L3')!;
    const a = l3.branches.find((b) => b.id === 'L3-cairo-univ')!.stations[1]!;
    const b = l3.branches.find((b) => b.id === 'L3-imbaba')!.stations[1]!;
    const r = planRoute(graph, a, b)!;
    const kitKat = r.transfers.find((t) => t.stationId === 'kit-kat');
    expect(kitKat).toBeDefined();
    expect(kitKat!.fromLine).toBe('L3');
    expect(kitKat!.toLine).toBe('L3');
  });

  it('names both onward terminals when heading to the junction from the trunk', () => {
    const r = planRoute(graph, 'adly-mansour', 'kit-kat')!;
    expect(r.legs[0]!.towards.sort()).toEqual(['cairo-university', 'rod-el-farag-axis']);
  });

  it('is symmetric in total time', () => {
    for (const [a, b] of [
      ['helwan', 'rod-el-farag-axis'],
      ['new-el-marg', 'adly-mansour'],
      ['shubra-el-kheima', 'el-monib'],
    ] as const) {
      expect(planRoute(graph, a, b)!.totalSec).toBe(planRoute(graph, b, a)!.totalSec);
    }
  });

  it('reaches every station from every other (connected graph)', () => {
    const from = 'helwan';
    for (const s of data.stations) {
      expect(planRoute(graph, from, s.id), `helwan -> ${s.id}`).not.toBeNull();
    }
  });

  it('obeys the triangle inequality through any intermediate station', () => {
    const ids = ['helwan', 'sadat', 'attaba', 'kit-kat', 'new-el-marg', 'cairo-university'];
    for (const a of ids)
      for (const b of ids)
        for (const c of ids) {
          const ab = planRoute(graph, a, b)!.totalSec;
          const bc = planRoute(graph, b, c)!.totalSec;
          const ac = planRoute(graph, a, c)!.totalSec;
          expect(ac).toBeLessThanOrEqual(ab + bc + 1e-9 + 240 * 2);
        }
  });

  it('keeps leg stop counts consistent with the station lists', () => {
    for (const [a, b] of [
      ['helwan', 'rod-el-farag-axis'],
      ['new-el-marg', 'cairo-university'],
      ['shubra-el-kheima', 'adly-mansour'],
    ] as const) {
      const r = planRoute(graph, a, b)!;
      for (const leg of r.legs) expect(leg.stops).toBe(leg.stations.length - 1);
      expect(r.stops).toBe(r.legs.reduce((s, l) => s + l.stops, 0));
      expect(r.legs.length).toBe(r.transfers.length + 1);
    }
  });

  it('prices trips from stop count when fares are given', () => {
    const r = planRoute(graph, 'helwan', 'new-el-marg', { fares: fares as unknown as FaresData })!;
    expect(r.fare).toBe(20);
    const short = planRoute(graph, 'sadat', 'nasser', { fares: fares as unknown as FaresData })!;
    expect(short.fare).toBe(10);
    expect(planRoute(graph, 'sadat', 'nasser')!.fare).toBeNull();
  });

  it('uses a custom transfer penalty to avoid transfers', () => {
    const cheap = planRoute(graph, 'sadat', 'attaba', { transferPenaltySec: 0 })!;
    const strict = planRoute(graph, 'sadat', 'attaba', { transferPenaltySec: 100000 })!;
    expect(strict.transfers.length).toBeLessThanOrEqual(cheap.transfers.length);
  });
});

describe('planRoutes', () => {
  it('returns fastest first and only adds a distinct fewer-transfer alternative', () => {
    const routes = planRoutes(graph, id('Helwan'), id('Rod El-Farag Axis'));
    expect(routes.length).toBeGreaterThan(0);
    expect(routes[0]!.mode).toBe('fastest');
    if (routes[1]) {
      expect(routes[1].transfers.length).toBeLessThan(routes[0]!.transfers.length);
      expect(routes[1].totalSec).toBeGreaterThanOrEqual(routes[0]!.totalSec);
    }
    expect(planRoutes(graph, 'x', 'y')).toEqual([]);
    expect(name('sadat')).toBe('Sadat');
  });
});
