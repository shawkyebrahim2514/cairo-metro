import { useState } from 'react';
import { lineColour, stationsById } from '../data';
import { endpointName, type Endpoint } from '../endpoint';
import { formatDistance, formatMinutes, localDigits, stationName, useI18n } from '../i18n';
import type { Trip } from '../trip';

interface Props {
  trip: Trip;
  title: string;
  from: Endpoint;
  to: Endpoint;
  selected: boolean;
  onSelect: () => void;
}

export function RouteCard({ trip, title, from, to, selected, onSelect }: Props) {
  const { t, lang } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const { route } = trip;
  const n = (v: number | string) => localDigits(v, lang);
  const name = (id: string) => stationName(stationsById.get(id)!, lang);
  const nt = route.transfers.length;

  return (
    <section className={`card route${selected ? ' selected' : ''}`} onClick={onSelect}>
      <header>
        <strong>{title}</strong>
        <span className="total">{formatMinutes(trip.totalSec, t, lang)}</span>
      </header>
      <p className="meta">
        {n(route.stops)} {route.stops === 1 ? t('stop') : t('stops')} ·{' '}
        {nt === 0 ? t('direct') : `${n(nt)} ${nt === 1 ? t('transfer') : t('transfers')}`}
        {route.fare != null && ` · ${n(route.fare)} ${t('fare')}`}
      </p>

      <ol className="steps">
        {trip.walkIn && (
          <li className="walk">
            {t('walkToStation')} {name(trip.walkIn.station.id)} ·{' '}
            {formatDistance(trip.walkIn.walkMeters, t, lang)} ·{' '}
            {formatMinutes(trip.walkIn.walkSec, t, lang)}
          </li>
        )}
        {!trip.walkIn && from.kind === 'station' && (
          <li className="walk">{endpointName(from, lang)}</li>
        )}
        {route.legs.map((leg, i) => {
          const tr = route.transfers[i];
          return (
            <li key={i} style={{ borderColor: lineColour.get(leg.line) }}>
              <span className="badge" style={{ background: lineColour.get(leg.line) }}>
                {leg.line}
              </span>{' '}
              {t('takeLine')} {name(leg.stations[0]!)} {t('towards')}{' '}
              {leg.towards.map(name).join(' / ')} · {n(leg.stops)}{' '}
              {leg.stops === 1 ? t('stop') : t('stops')}
              <br />
              <small>
                {tr
                  ? `${t('changeAt')} ${name(tr.stationId)}`
                  : `${t('getOff')} ${name(leg.stations.at(-1)!)}`}
              </small>
              {expanded && (
                <ul className="stations">
                  {leg.stations.map((id) => (
                    <li key={id}>{name(id)}</li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
        {trip.walkOut && (
          <li className="walk">
            {t('walkFromStation')} {name(trip.walkOut.station.id)} ·{' '}
            {formatDistance(trip.walkOut.walkMeters, t, lang)} ·{' '}
            {formatMinutes(trip.walkOut.walkSec, t, lang)}
          </li>
        )}
        {!trip.walkOut && to.kind === 'station' && (
          <li className="walk">{endpointName(to, lang)}</li>
        )}
      </ol>

      <button
        type="button"
        className="link"
        onClick={(e) => {
          e.stopPropagation();
          setExpanded((v) => !v);
        }}
      >
        {t('showStations')} {expanded ? '▲' : '▼'}
      </button>
    </section>
  );
}
