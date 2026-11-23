import { useEffect, useMemo, useState } from 'react';
import { MetroMap, type MapMarker } from '../components/MetroMap';
import { PlaceInput } from '../components/PlaceInput';
import { RouteCard } from '../components/RouteCard';
import type { PlaceResolver } from '../data';
import { endpointName, endpointPoint, pinned, type Endpoint } from '../endpoint';
import { useI18n } from '../i18n';
import {
  isStarred,
  loadTrips,
  openTrip,
  planUrl,
  readPlanHash,
  recordTrip,
  toggleStar,
} from '../storage';
import { planTrips } from '../trip';

export function PlannerPage({
  resolver,
  tiles,
}: {
  resolver: PlaceResolver | null;
  tiles: boolean;
}) {
  const { t, lang } = useI18n();
  const [linked] = useState(readPlanHash);
  const [from, setFrom] = useState<Endpoint | null>(linked?.from ?? null);
  const [to, setTo] = useState<Endpoint | null>(linked?.to ?? null);
  const [selected, setSelected] = useState(0);
  const [saved, setSaved] = useState(loadTrips);
  const [copied, setCopied] = useState(false);

  const plan = useMemo(() => (from && to ? planTrips(from, to) : null), [from, to]);
  const trip = plan?.trips[Math.min(selected, (plan?.trips.length ?? 1) - 1)];

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
    return out;
  }, [from, to, lang]);

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
      <PlaceInput
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
        label={t('to')}
        endpoint={to}
        onChange={(e) => {
          setTo(e);
          setSelected(0);
        }}
        resolver={resolver}
        showGps={false}
      />
      <MetroMap
        markers={markers}
        route={trip?.route.stations}
        tiles={tiles}
        onPick={pick}
        onStation={(s) => pickEndpoint({ kind: 'station', station: s })}
      />
      <p className="note">{t('mapHint')}</p>

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
    </>
  );
}
