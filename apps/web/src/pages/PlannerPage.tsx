import { useEffect, useMemo, useState } from 'react';
import { MetroMap, type MapMarker } from '../components/MetroMap';
import { Footer } from '../components/Footer';
import { TrackPanel } from '../components/TrackPanel';
import { Sheet, type Snap } from '../components/Sheet';
import { PassCalculator } from '../components/PassCalculator';
import type { TicketCategory } from '@cairo-metro/core';
import { PlaceInput } from '../components/PlaceInput';
import { Reachable } from '../components/Reachable';
import { RouteCard } from '../components/RouteCard';
import { stationsById, type PlaceResolver } from '../data';
import { endpointName, endpointPoint, pinned, type Endpoint } from '../endpoint';
import { stationName, useI18n } from '../i18n';
import {
  isStarred,
  loadTrips,
  openTrip,
  planUrl,
  readPlanHash,
  recordTrip,
  toggleStar,
} from '../storage';
import { useSettings } from '../settings';
import { useTracking } from '../tracking';
import { planTrips, reachFrom } from '../trip';

export function PlannerPage({
  resolver,
  tiles,
  category,
}: {
  resolver: PlaceResolver | null;
  tiles: boolean;
  category: TicketCategory;
}) {
  const { t, lang } = useI18n();
  const [linked] = useState(readPlanHash);
  const [from, setFrom] = useState<Endpoint | null>(linked?.from ?? null);
  const [to, setTo] = useState<Endpoint | null>(linked?.to ?? null);
  const [selected, setSelected] = useState(0);
  const [saved, setSaved] = useState(loadTrips);
  const [copied, setCopied] = useState(false);
  const [reachMin, setReachMin] = useState(20);
  const [snap, setSnap] = useState<Snap>(linked ? 'half' : 'peek');

  // Offer the 'where can I get to' view while only the origin is chosen.
  const reach = useMemo(
    () => (from && !to ? reachFrom(from, reachMin) : null),
    [from, to, reachMin],
  );

  const plan = useMemo(
    () => (from && to ? planTrips(from, to, category) : null),
    [from, to, category],
  );
  const trip = plan?.trips[Math.min(selected, (plan?.trips.length ?? 1) - 1)];

  // Open the sheet to read the result when a route first appears.
  const hasTrip = Boolean(trip);
  useEffect(() => {
    if (hasTrip) setSnap((s) => (s === 'peek' ? 'half' : s));
  }, [hasTrip]);

  const markers = useMemo<MapMarker[]>(() => {
    const out: MapMarker[] = [];
    if (from)
      out.push({ point: endpointPoint(from), label: endpointName(from, lang), primary: true });
    if (to)
      out.push({
        point: endpointPoint(to),
        label: endpointName(to, lang),
        primary: true,
        colour: '#2563eb',
      });
    for (const r of reach?.items ?? []) {
      const s = stationsById.get(r.stationId)!;
      out.push({
        point: { lat: s.lat, lng: s.lng },
        label: stationName(s, lang),
        colour: '#0f766e',
      });
    }
    return out;
  }, [from, to, lang, reach]);

  // A map tap fills the first empty endpoint, origin first.
  const pickEndpoint = (e: Endpoint) => {
    if (!from) setFrom(e);
    else setTo(e);
    setSelected(0);
  };
  const pick = (p: { lat: number; lng: number }) => pickEndpoint(pinned(p, t));

  const swap = () => {
    setFrom(to);
    setTo(from);
    setSelected(0);
  };

  const [tracking, setTracking] = useState(false);
  const [wakeMe, setWakeMe] = useState(false);
  const [follow, setFollow] = useState(true);
  const { alerts } = useSettings();
  const {
    state: ts,
    setIndex,
    dismissAlarm,
  } = useTracking(trip?.route ?? null, tracking, alerts, wakeMe);

  // A different trip ends tracking, so the old one never keeps ringing.
  useEffect(() => {
    setTracking(false);
    setWakeMe(false);
  }, [from, to, selected, category]);

  const stationAt = trip ? stationsById.get(trip.route.stations[ts.index]!) : undefined;
  const fixLat = ts.fixFresh ? ts.fix?.lat : undefined;
  const fixLng = ts.fixFresh ? ts.fix?.lng : undefined;
  const trackPoint = useMemo(() => {
    if (!tracking) return null;
    if (fixLat != null && fixLng != null) return { lat: fixLat, lng: fixLng };
    return stationAt ? { lat: stationAt.lat, lng: stationAt.lng } : null;
  }, [tracking, fixLat, fixLng, stationAt]);

  const replan = () => {
    if (!ts.fix) return;
    setFrom(pinned(ts.fix, t));
    setTracking(false);
    setSelected(0);
  };
  const starred = from && to ? isStarred(saved, from, to) : false;

  // Record each planned trip and keep the address bar shareable.
  useEffect(() => {
    if (!from || !to || !plan || plan.trips.length === 0) {
      if (window.location.hash.startsWith('#/plan')) {
        history.replaceState(null, '', window.location.pathname);
      }
      return;
    }
    setSaved((cur) => recordTrip(cur, from, to));
    history.replaceState(null, '', planUrl(from, to));
  }, [from, to, plan]);

  const share = async () => {
    if (!from || !to) return;
    const url = planUrl(from, to);
    if (navigator.share) {
      try {
        await navigator.share({ title: t('appName'), url });
        return;
      } catch {
        // dismissed or unsupported: fall back to the clipboard
      }
    }
    await navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <div className="map-bg">
        <MetroMap
          markers={markers}
          route={trip?.route.stations}
          legs={trip?.route.legs}
          tiles={tiles}
          bottomPad={Math.round(window.innerHeight * 0.45)}
          track={trackPoint}
          follow={tracking && follow}
          onDrag={() => setFollow(false)}
          onPick={pick}
          onStation={(s) => pickEndpoint({ kind: 'station', station: s })}
        />
      </div>
      <Sheet snap={snap} onSnap={setSnap}>
        {tracking && trip && (
          <TrackPanel
            trip={trip}
            state={ts}
            wakeMe={wakeMe}
            follow={follow}
            onWakeMe={setWakeMe}
            onFollow={() => setFollow((v) => !v)}
            onSet={(i) => setIndex(i, 'manual')}
            onReplan={replan}
            onDismiss={dismissAlarm}
            onStop={() => setTracking(false)}
          />
        )}
        {!tracking && (
          <>
            <PlaceInput
              tone="from"
              label={t('from')}
              endpoint={from}
              onChange={(e) => {
                setFrom(e);
                setSelected(0);
              }}
              resolver={resolver}
            />
            <button
              type="button"
              className="swap"
              onClick={swap}
              aria-label={t('swap')}
              title={t('swap')}
            >
              ⇅
            </button>
            <PlaceInput
              tone="to"
              label={t('to')}
              endpoint={to}
              onChange={(e) => {
                setTo(e);
                setSelected(0);
              }}
              resolver={resolver}
              showGps={false}
            />
            <p className="note">{t('mapHint')}</p>
          </>
        )}

        {from && !to && <Reachable minutes={reachMin} onMinutes={setReachMin} result={reach} />}

        {plan && from && to && (
          <>
            {plan.closeBy && <p className="note">{t('closeBy')}</p>}
            {plan.sameStation && plan.trips.length === 0 && (
              <p className="note">{t('sameStation')}</p>
            )}
            {!plan.closeBy && !plan.sameStation && plan.trips.length === 0 && (
              <p className="note warn">{t('noRoute')}</p>
            )}
            {plan.trips.map((tr, i) => (
              <RouteCard
                key={i}
                trip={tr}
                from={from}
                to={to}
                title={i === 0 ? t('fastest') : t('fewestTransfers')}
                selected={i === selected}
                onSelect={() => setSelected(i)}
              />
            ))}
            {plan.trips.length > 0 && (
              <div className="actions">
                <button
                  type="button"
                  className="pill"
                  onClick={() => {
                    setTracking(true);
                    setFollow(true);
                    setSnap('half');
                  }}
                >
                  {t('trackStart')}
                </button>
                <button type="button" className="pill" onClick={share}>
                  {copied ? t('linkCopied') : t('share')}
                </button>
                <button
                  type="button"
                  className="pill"
                  aria-pressed={starred}
                  onClick={() => setSaved(toggleStar(saved, from, to))}
                >
                  {starred ? '★ ' + t('saved') : '☆ ' + t('saveTrip')}
                </button>
              </div>
            )}
            {trip && <PassCalculator stops={trip.route.stops} category={category} />}
            {plan.trips.length > 0 && <p className="note">{t('estimateNote')}</p>}
          </>
        )}

        {!(from && to) && saved.length > 0 && (
          <>
            <h2>{t('yourTrips')}</h2>
            <ul className="cards">
              {saved.map((s) => {
                const trip = openTrip(s);
                if (!trip) return null;
                return (
                  <li key={s.from + '>' + s.to} className="card">
                    <button
                      type="button"
                      className="link"
                      onClick={() => {
                        setFrom(trip.from);
                        setTo(trip.to);
                        setSelected(0);
                      }}
                    >
                      {s.starred ? '★ ' : ''}
                      {endpointName(trip.from, lang)} → {endpointName(trip.to, lang)}
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
        <Footer />
      </Sheet>
    </>
  );
}
