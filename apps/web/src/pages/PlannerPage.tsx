import { useMemo, useState } from 'react';
import { MetroMap, type MapMarker } from '../components/MetroMap';
import { PlaceInput } from '../components/PlaceInput';
import { RouteCard } from '../components/RouteCard';
import type { PlaceResolver } from '../data';
import { endpointName, endpointPoint, pinned, type Endpoint } from '../endpoint';
import { useI18n } from '../i18n';
import { planTrips } from '../trip';

export function PlannerPage({
  resolver,
  tiles,
}: {
  resolver: PlaceResolver | null;
  tiles: boolean;
}) {
  const { t, lang } = useI18n();
  const [from, setFrom] = useState<Endpoint | null>(null);
  const [to, setTo] = useState<Endpoint | null>(null);
  const [selected, setSelected] = useState(0);

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
          {plan.trips.length > 0 && <p className="note">{t('estimateNote')}</p>}
        </>
      )}
    </>
  );
}
