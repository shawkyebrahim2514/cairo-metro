import { useCallback, useEffect, useRef, useState } from 'react';
import {
  alertAt,
  snapToRoute,
  trackSteps,
  tripProgress,
  type LatLng,
  type Route,
} from '@cairo-metro/core';
import { fireAlert, type AlertPrefs } from './alerts';
import { stationsById } from './data';
import { stationName, useI18n } from './i18n';

export type TrackSource = 'start' | 'gps' | 'manual' | 'time';

export interface TrackState {
  index: number;
  source: TrackSource;
  /** Latest GPS fix, and whether it is recent (GPS usually drops in tunnels). */
  fix: LatLng | null;
  fixFresh?: boolean;
  offRoute: boolean;
  denied: boolean;
  /** The wake-me alarm is ringing. */
  alarm: boolean;
}

const STALE_MS = 60_000;
const BOARD_DELAY_SEC = 180;

/**
 * Follows a trip: GPS snapped to the route, a manual "I am at" correction, and a
 * time-based estimate when GPS is lost underground. Raises the alerts chosen in the settings.
 */
export function useTracking(
  route: Route | null,
  active: boolean,
  prefs: AlertPrefs,
  wakeMe: boolean,
) {
  const { t, lang } = useI18n();
  const [state, setState] = useState<TrackState>({
    index: 0,
    source: 'start',
    fix: null,
    offRoute: false,
    denied: false,
    alarm: false,
  });
  const [, setTick] = useState(0);
  const anchor = useRef<{ index: number; at: number } | null>(null);
  const lastFixAt = useRef(0);
  const lastFix = useRef<LatLng | null>(null);
  const indexRef = useRef(0);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const wakeRef = useRef(wakeMe);
  wakeRef.current = wakeMe;
  const textRef = useRef({ t, lang });
  textRef.current = { t, lang };

  const setIndex = useCallback((index: number, source: TrackSource) => {
    indexRef.current = index;
    if (source !== 'time') anchor.current = { index, at: Date.now() };
    setState((s) => ({ ...s, index, source }));
  }, []);

  // A new trip or a restart begins again at the boarding station.
  useEffect(() => {
    indexRef.current = 0;
    // the time estimate starts from boarding, so the warning still fires without a GPS fix
    anchor.current = active && route ? { index: 0, at: Date.now() } : null;
    lastFixAt.current = 0;
    lastFix.current = null;
    setState({
      index: 0,
      source: 'start',
      fix: null,
      offRoute: false,
      denied: false,
      alarm: false,
    });
  }, [route, active]);

  // GPS
  useEffect(() => {
    if (!active || !route || !('geolocation' in navigator)) return;
    const coords = route.stations.map((id) => {
      const s = stationsById.get(id)!;
      return { lat: s.lat, lng: s.lng };
    });
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        if (pos.coords.accuracy > 250) return;
        const fix = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        lastFixAt.current = Date.now();
        lastFix.current = fix;
        const snap = snapToRoute(coords, fix);
        setState((s) => ({ ...s, fix, offRoute: snap.offRoute, denied: false }));
        if (!snap.offRoute) {
          setState((s) => {
            if (snap.reached >= s.index || s.source === 'time') {
              indexRef.current = snap.reached;
              anchor.current = { index: snap.reached, at: Date.now() };
              return { ...s, index: snap.reached, source: 'gps' };
            }
            return s;
          });
        }
      },
      (err) => {
        if (err.code === 1) setState((s) => ({ ...s, denied: true }));
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [active, route]);

  // Time-based estimate while GPS is missing, from the last confirmed station.
  useEffect(() => {
    if (!active || !route) return;
    const steps = trackSteps(route);
    const hops: number[] = [];
    for (const leg of route.legs) {
      const per = leg.stops > 0 ? leg.rideSec / leg.stops : 0;
      for (let j = 1; j < leg.stations.length; j++) hops.push(per);
    }
    const transfer = new Map(route.transfers.map((x) => [x.stationId, x.sec]));
    const timer = setInterval(() => {
      setTick((n) => n + 1);
      const a = anchor.current;
      if (!a) return;
      const gpsFresh = Date.now() - lastFixAt.current < STALE_MS;
      if (gpsFresh) return;
      let rem = (Date.now() - a.at) / 1000 - (a.index === 0 ? BOARD_DELAY_SEC : 0);
      let i = a.index;
      // never estimate the arrival itself: the exit needs a GPS fix or a tap
      while (i < steps.length - 2 && rem >= (hops[i] ?? Infinity)) {
        rem -= hops[i]!;
        i++;
        if (steps[i]!.kind === 'change') rem -= transfer.get(steps[i]!.stationId) ?? 0;
      }
      if (i > indexRef.current) {
        indexRef.current = i;
        setState((s) => ({ ...s, index: i, source: 'time', fix: null }));
      }
    }, 10_000);
    return () => clearInterval(timer);
  }, [active, route]);

  // Alerts when a new station is reached.
  const prevIndex = useRef(0);
  useEffect(() => {
    if (!active || !route) {
      prevIndex.current = 0;
      return;
    }
    const idx = state.index;
    if (idx > prevIndex.current) {
      // a jump can skip stations: keep the most important alert among those crossed
      const rank = { station: 0, warn: 1, change: 2, arrive: 3 } as const;
      let kind: ReturnType<typeof alertAt> = null;
      let at = idx;
      let wake = false;
      for (let i = prevIndex.current + 1; i <= idx; i++) {
        const k = alertAt(route, i, prefsRef.current.warnStops);
        if (k === 'warn' || k === 'arrive') wake = true;
        if (k && (!kind || rank[k] >= rank[kind])) {
          kind = k;
          at = i;
        }
      }
      if (kind) {
        const { t: tt, lang: lg } = textRef.current;
        const name = (id: string) => stationName(stationsById.get(id)!, lg);
        const stationId = route.stations[at]!;
        const p = tripProgress(route, at);
        const text =
          kind === 'arrive'
            ? `${tt('trackArrived')} ${name(stationId)}`
            : kind === 'change'
              ? `${tt('changeAt')} ${name(stationId)}`
              : kind === 'warn' && p.event
                ? `${p.event.stopsAway} ${p.event.stopsAway === 1 ? tt('stop') : tt('stops')}: ${
                    p.event.kind === 'arrive' ? tt('getOff') : tt('changeAt')
                  } ${name(p.event.stationId)}`
                : name(stationId);
        fireAlert(kind, prefsRef.current, text, lg);
        if (wakeRef.current && wake) {
          setState((s) => ({ ...s, alarm: true }));
        }
      }
    }
    prevIndex.current = idx;
  }, [state.index, active, route]);

  // The wake-me alarm repeats until it is dismissed.
  useEffect(() => {
    if (!state.alarm) return;
    const ring = () =>
      fireAlert(
        'arrive',
        { ...prefsRef.current, vibrate: true, beep: true, eachStation: true },
        textRef.current.t('trackWakeText'),
        textRef.current.lang,
      );
    ring();
    const timer = setInterval(ring, 4000);
    return () => clearInterval(timer);
  }, [state.alarm]);

  // Keep the screen on while tracking, when chosen.
  useEffect(() => {
    if (!active || !prefs.keepAwake || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        const l = await navigator.wakeLock.request('screen');
        if (cancelled) void l.release();
        else lock = l;
      } catch {
        // not allowed (battery saver, background tab)
      }
    };
    void acquire();
    const onVisible = () => document.visibilityState === 'visible' && void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release();
    };
  }, [active, prefs.keepAwake]);

  const dismissAlarm = useCallback(() => setState((s) => ({ ...s, alarm: false })), []);
  const fixFresh = Date.now() - lastFixAt.current < STALE_MS;
  return {
    state: { ...state, fix: lastFix.current, fixFresh },
    setIndex,
    dismissAlarm,
  };
}
