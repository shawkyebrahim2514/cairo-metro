// @vitest-environment jsdom
import { StrictMode, type ReactNode } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { planRoute } from '@cairo-metro/core';
import { DEFAULT_ALERTS } from './alerts';
import { graph, stationsById } from './data';
import { dictionaries, I18nContext, type I18n } from './i18n';
import { useTracking } from './tracking';

const i18n: I18n = { lang: 'en', setLang: () => {}, t: (k) => dictionaries.en[k] };
const wrapper = ({ children }: { children: ReactNode }) => (
  <StrictMode>
    <I18nContext.Provider value={i18n}>{children}</I18nContext.Provider>
  </StrictMode>
);

type OkCb = (pos: GeolocationPosition) => void;
type ErrCb = (err: GeolocationPositionError) => void;

function mockGeo() {
  const watches: { ok: OkCb; err: ErrCb; opts?: PositionOptions }[] = [];
  const clearWatch = vi.fn();
  vi.stubGlobal('navigator', {
    ...navigator,
    vibrate: vi.fn(),
    geolocation: {
      watchPosition: vi.fn((ok: OkCb, err: ErrCb, opts?: PositionOptions) => {
        watches.push({ ok, err, opts });
        return watches.length;
      }),
      clearWatch,
    },
  });
  return { watches, clearWatch };
}

const mkPos = (lat: number, lng: number, accuracy: number, timestamp = Date.now()) =>
  ({
    coords: {
      latitude: lat,
      longitude: lng,
      accuracy,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
    },
    timestamp,
  }) as unknown as GeolocationPosition;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-06-01T12:00:00Z'));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useTracking', () => {
  it('accepts coarse indoor/station fixes (250-1500 m) and snaps them onto the route', () => {
    const { watches } = mockGeo();
    const route = planRoute(graph, 'el-monib', 'cairo-university')!;
    const s2 = stationsById.get(route.stations[2]!)!;
    const { result } = renderHook(() => useTracking(route, true, DEFAULT_ALERTS, false), {
      wrapper,
    });

    const w = watches.at(-1)!;
    act(() => w.ok(mkPos(s2.lat + 0.002, s2.lng, 600)));

    expect(result.current.state.source).toBe('gps');
    expect(result.current.state.offRoute).toBe(false);
    expect(result.current.state.index).toBe(2);
    expect(result.current.state.accuracy).toBe(600);
    // Coarse fix is snapped onto the route polyline instead of raw noisy coordinates.
    expect(result.current.state.point).not.toEqual({ lat: s2.lat + 0.002, lng: s2.lng });
  });

  it('falls back from high-accuracy GPS to network location after a timeout', () => {
    const { watches } = mockGeo();
    const route = planRoute(graph, 'el-monib', 'cairo-university')!;
    const { result } = renderHook(() => useTracking(route, true, DEFAULT_ALERTS, false), {
      wrapper,
    });

    expect(watches.at(-1)!.opts?.enableHighAccuracy).toBe(true);
    act(() => watches.at(-1)!.err({ code: 3, message: 'Timeout' } as GeolocationPositionError));

    expect(result.current.state.gpsError).toBe('timeout');
    expect(watches.at(-1)!.opts?.enableHighAccuracy).toBe(false);
  });

  it('ignores stale cached OS fixes and smoothly interpolates along 1-stop trips underground', () => {
    const { watches } = mockGeo();
    const route = planRoute(graph, 'sadat', 'nasser')!;
    expect(route.stations).toHaveLength(2);
    const s0 = stationsById.get(route.stations[0]!)!;
    const s1 = stationsById.get(route.stations[1]!)!;
    const { result } = renderHook(() => useTracking(route, true, DEFAULT_ALERTS, false), {
      wrapper,
    });

    // Stale fix older than 30s is ignored.
    act(() => watches.at(-1)!.ok(mkPos(s0.lat, s0.lng, 30, Date.now() - 45_000)));
    expect(result.current.state.source).toBe('start');

    // After 60s underground/offline, time estimation smoothly moves the point along the path.
    act(() => vi.advanceTimersByTime(60_000));
    expect(result.current.state.source).toBe('time');
    expect(result.current.state.point!.lat).toBeGreaterThan(s0.lat);
    expect(result.current.state.point!.lat).toBeLessThan(s1.lat);
  });

  it('moves the map dot immediately on manual "I am at" selection even after a recent GPS fix', () => {
    const { watches } = mockGeo();
    const route = planRoute(graph, 'el-monib', 'cairo-university')!;
    const s0 = stationsById.get(route.stations[0]!)!;
    const s3 = stationsById.get(route.stations[3]!)!;
    const { result } = renderHook(() => useTracking(route, true, DEFAULT_ALERTS, false), {
      wrapper,
    });

    act(() => watches.at(-1)!.ok(mkPos(s0.lat, s0.lng, 20)));
    expect(result.current.state.index).toBe(0);

    act(() => result.current.setIndex(3, 'manual'));
    expect(result.current.state.index).toBe(3);
    expect(result.current.state.source).toBe('manual');
    expect(result.current.state.fix).toBeNull();
    expect(result.current.state.point).toEqual({ lat: s3.lat, lng: s3.lng });
  });

  it('triggers wake-me alarm when reaching an interchange even when warnStops is 0', () => {
    mockGeo();
    const route = planRoute(graph, 'el-monib', 'el-malek-el-saleh')!;
    const changeIdx = route.stations.indexOf(route.transfers[0]!.stationId);
    const { result } = renderHook(
      () => useTracking(route, true, { ...DEFAULT_ALERTS, warnStops: 0 }, true),
      { wrapper },
    );

    act(() => result.current.setIndex(changeIdx, 'manual'));
    expect(result.current.state.alarm).toBe(true);
  });
});
