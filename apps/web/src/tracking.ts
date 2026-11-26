import { useCallback, useEffect, useRef, useState } from 'react';
import {
  alertAt,
  interpolateRoute,
  routeHopSecs,
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
export type GpsErrorKind = 'denied' | 'unavailable' | 'timeout' | null;

export interface TrackState {
  index: number;
  source: TrackSource;
  /** Latest fresh GPS fix, or null when estimating by time / manually set. */
  fix: LatLng | null;
  /** Point to show on the map (GPS fix, snapped route point, or interpolated time position). */
  point: LatLng | null;
  /** Reported accuracy of the latest accepted GPS fix, in metres. */
  accuracy: number | null;
  fixFresh?: boolean;
  offRoute: boolean;
  denied: boolean;
  gpsError: GpsErrorKind;
  /** The wake-me alarm is ringing. */
  alarm: boolean;
}

const STALE_MS = 30_000;
const HIGH_ACC_M = 250;
const MAX_ACC_M = 1500;
const HIGH_ACC_HOLD_MS = 20_000;
const BASE_OFF_ROUTE_M = 600;
const BOARD_DELAY_SEC = 30;
const TICK_MS = 3_000;

const initialState = (startPoint: LatLng | null): TrackState => ({
  index: 0,
  source: 'start',
  fix: null,
  point: startPoint,
  accuracy: null,
  offRoute: false,
  denied: false,
  gpsError: null,
  alarm: false,
});

/**
 * Follows a trip: GPS snapped to the route (falling back to network/coarse fixes indoors),
 * a manual "I am at" correction, and a smooth time-based estimate when GPS drops underground.
 * Raises the alerts chosen in the settings.
 */
export function useTracking(
  route: Route | null,
  active: boolean,
  prefs: AlertPrefs,
  wakeMe: boolean,
) {
  const { t, lang } = useI18n();
  const [state, setState] = useState<TrackState>(() => initialState(null));
  const [highAccuracy, setHighAccuracy] = useState(true);
  const anchor = useRef<{ index: number; at: number; boardDelay: boolean } | null>(null);
  const lastFixAt = useRef(0);
  const lastHighAccAt = useRef(0);
  const lastPosTs = useRef(0);
  const indexRef = useRef(0);
  const sourceRef = useRef<TrackSource>('start');
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const wakeRef = useRef(wakeMe);
  wakeRef.current = wakeMe;
  const textRef = useRef({ t, lang });
  textRef.current = { t, lang };

  const setIndex = useCallback(
    (index: number, source: TrackSource) => {
      indexRef.current = index;
      sourceRef.current = source;
      if (source !== 'time') {
        anchor.current = { index, at: Date.now(), boardDelay: false };
      }
      if (source === 'manual') {
        lastFixAt.current = 0;
        lastHighAccAt.current = 0;
      }
      const st = route ? stationsById.get(route.stations[index]!) : undefined;
      const point = st ? { lat: st.lat, lng: st.lng } : null;
      setState((s) => ({
        ...s,
        index,
        source,
        fix: source === 'manual' ? null : s.fix,
        point: point ?? s.point,
        offRoute: source === 'manual' ? false : s.offRoute,
      }));
    },
    [route],
  );

  // A new trip or a restart begins again at the boarding station.
  useEffect(() => {
    const startSt = route ? stationsById.get(route.stations[0]!) : undefined;
    const startPoint = startSt ? { lat: startSt.lat, lng: startSt.lng } : null;
    indexRef.current = 0;
    sourceRef.current = 'start';
    // Start the time anchor at boarding so underground/offline riders still get live progress.
    anchor.current = active && route ? { index: 0, at: Date.now(), boardDelay: true } : null;
    lastFixAt.current = 0;
    lastHighAccAt.current = 0;
    lastPosTs.current = 0;
    setHighAccuracy(true);
    setState(initialState(active ? startPoint : null));
  }, [route, active]);

  // GPS watcher with adaptive accuracy and fallback to network positioning indoors/underground.
  useEffect(() => {
    if (!active || !route || !('geolocation' in navigator)) return;
    const coords = route.stations.map((id) => {
      const s = stationsById.get(id)!;
      return { lat: s.lat, lng: s.lng };
    });
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        const rawTs = typeof pos.timestamp === 'number' && pos.timestamp > 0 ? pos.timestamp : now;
        const fixTs = Math.min(rawTs, now);
        // Ignore duplicate OS-cached deliveries and fixes already older than STALE_MS.
        if (pos.timestamp > 0 && pos.timestamp === lastPosTs.current) return;
        if (now - fixTs > STALE_MS) return;

        const acc = Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : 0;
        if (acc > MAX_ACC_M) {
          setState((s) => ({ ...s, accuracy: Math.round(acc), gpsError: 'unavailable' }));
          return;
        }
        // Keep a recent high-accuracy GNSS lock from being overridden by a noisy cell fix.
        if (acc > HIGH_ACC_M && now - lastHighAccAt.current < HIGH_ACC_HOLD_MS) return;

        lastPosTs.current = pos.timestamp || now;
        lastFixAt.current = fixTs;
        if (acc <= HIGH_ACC_M) lastHighAccAt.current = fixTs;

        const fix: LatLng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        // Widen off-route tolerance when accuracy is coarse (e.g. cell/Wi-Fi indoors).
        const maxOffRouteM = BASE_OFF_ROUTE_M + (acc > HIGH_ACC_M ? Math.min(acc, 800) : 0);
        const snap = snapToRoute(coords, fix, maxOffRouteM);
        const displayPoint = !snap.offRoute && acc > HIGH_ACC_M ? snap.projected : fix;

        let nextIndex = indexRef.current;
        let nextSource = sourceRef.current;
        if (!snap.offRoute) {
          const canCorrectTimeBackwards =
            sourceRef.current === 'time' && acc <= HIGH_ACC_M && now - fixTs < 15_000;
          if (snap.reached >= indexRef.current || canCorrectTimeBackwards) {
            nextIndex = snap.reached;
            nextSource = 'gps';
            indexRef.current = nextIndex;
            sourceRef.current = nextSource;
            anchor.current = {
              index: nextIndex,
              at: fixTs,
              boardDelay: nextIndex === 0 && anchor.current?.boardDelay === true,
            };
          }
        }

        setState((s) => ({
          ...s,
          index: nextIndex,
          source: nextSource,
          fix,
          point: displayPoint,
          accuracy: Math.round(acc),
          offRoute: snap.offRoute,
          denied: false,
          gpsError: null,
        }));
      },
      (err) => {
        if (err.code === 1) {
          setState((s) => ({ ...s, denied: true, gpsError: 'denied' }));
        } else {
          const kind: GpsErrorKind = err.code === 3 ? 'timeout' : 'unavailable';
          setState((s) => ({ ...s, gpsError: kind }));
          // Inside stations/trains, high-accuracy GNSS often times out; fall back to network location.
          if (highAccuracy && lastFixAt.current === 0) {
            setHighAccuracy(false);
          }
        }
      },
      highAccuracy
        ? { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 }
        : { enableHighAccuracy: false, maximumAge: 15_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [active, route, highAccuracy]);

  // Smooth time-based estimate while GPS is missing, from the last confirmed station.
  useEffect(() => {
    if (!active || !route) return;
    const steps = trackSteps(route);
    const hops = routeHopSecs(route);
    const coords = route.stations.map((id) => {
      const s = stationsById.get(id)!;
      return { lat: s.lat, lng: s.lng };
    });
    const transfer = new Map(route.transfers.map((x) => [x.stationId, x.sec]));

    const timer = setInterval(() => {
      const now = Date.now();
      const a = anchor.current;
      if (!a) return;
      const gpsFresh = lastFixAt.current > 0 && now - lastFixAt.current < STALE_MS;
      if (gpsFresh) return;

      let rem = (now - a.at) / 1000 - (a.index === 0 && a.boardDelay ? BOARD_DELAY_SEC : 0);
      if (rem < 0) return;

      let i = a.index;
      // Never auto-declare arrival without GPS or tap, but still interpolate along the last hop.
      while (i < steps.length - 2 && rem >= (hops[i] ?? Infinity)) {
        rem -= hops[i]!;
        i++;
        if (steps[i]!.kind === 'change') rem -= transfer.get(steps[i]!.stationId) ?? 0;
      }

      const hop = hops[i] ?? 0;
      const maxFrac = i >= steps.length - 2 ? 0.92 : 0.98;
      const frac = hop > 0 && rem > 0 ? Math.min(maxFrac, rem / hop) : 0;
      const nextIdx = Math.max(indexRef.current, i);
      const point = interpolateRoute(coords, nextIdx, nextIdx === i ? frac : 0);

      if (nextIdx > indexRef.current || frac > 0) {
        indexRef.current = nextIdx;
        sourceRef.current = 'time';
        setState((s) => ({
          ...s,
          index: nextIdx,
          source: 'time',
          fix: null,
          point,
          offRoute: false,
        }));
      }
    }, TICK_MS);
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
        if (k === 'warn' || k === 'change' || k === 'arrive') wake = true;
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
  const fixFresh =
    state.fix !== null && lastFixAt.current > 0 && Date.now() - lastFixAt.current < STALE_MS;
  return {
    state: { ...state, fixFresh },
    setIndex,
    dismissAlarm,
  };
}
