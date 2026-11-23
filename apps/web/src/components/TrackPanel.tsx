import { tripProgress } from '@cairo-metro/core';
import { stationsById } from '../data';
import { Icon } from './Icon';
import { formatDistance, formatMinutes, localDigits, stationName, useI18n } from '../i18n';
import type { TrackSource, TrackState } from '../tracking';
import { endpointPoint, type Endpoint } from '../endpoint';
import type { Trip } from '../trip';
import { WalkLink } from './WalkLink';

interface Props {
  trip: Trip;
  to: Endpoint;
  state: TrackState;
  wakeMe: boolean;
  follow: boolean;
  onWakeMe: (v: boolean) => void;
  onFollow: () => void;
  onSet: (index: number) => void;
  onReplan: () => void;
  onDismiss: () => void;
  onStop: () => void;
}

const SOURCE_KEY = {
  start: 'trackSearching',
  gps: 'trackGps',
  manual: 'trackManual',
  time: 'trackEstimated',
} as const satisfies Record<TrackSource, string>;

export function TrackPanel({
  trip,
  to,
  state,
  wakeMe,
  follow,
  onWakeMe,
  onFollow,
  onSet,
  onReplan,
  onDismiss,
  onStop,
}: Props) {
  const { t, lang } = useI18n();
  const { route } = trip;
  const n = (v: number | string) => localDigits(v, lang);
  const name = (id: string) => stationName(stationsById.get(id)!, lang);
  const p = tripProgress(route, state.index);
  const arrived = p.atEnd;
  const here = route.stations[state.index]!;

  return (
    <section className="track" aria-label={t('trackTitle')}>
      <p className="sr-only" role="status">
        {arrived
          ? `${t('trackArrived')} ${name(here)}`
          : `${t('trackNext')}: ${p.nextStationId ? name(p.nextStationId) : ''}`}
      </p>
      <header>
        <span className="pulse" aria-hidden="true" />
        <strong>{t('trackTitle')}</strong>
        <button type="button" className="pill" onClick={onStop}>
          <Icon name="stop" size={14} /> {t('trackStop')}
        </button>
      </header>

      {state.alarm && (
        <div role="alert">
          <button type="button" className="alarm" onClick={onDismiss}>
            {t('trackDismiss')}
          </button>
        </div>
      )}
      {state.denied && <p className="note warn">{t('trackDenied')}</p>}
      {state.offRoute && (
        <div className="note warn" role="alert">
          <p>{t('trackOffRoute')}</p>
          <button type="button" className="pill" onClick={onReplan}>
            {t('trackReplan')}
          </button>
        </div>
      )}

      {arrived ? (
        <>
          <p className="track-big">
            {t('trackArrived')} {name(here)}
          </p>
          {trip.walkOut && (
            <>
              <p className="note">
                {t('walkFromStation')} {name(trip.walkOut.station.id)} ·{' '}
                {formatDistance(trip.walkOut.walkMeters, t, lang)} ·{' '}
                {formatMinutes(trip.walkOut.walkSec, t, lang)}
              </p>
              <WalkLink from={trip.walkOut.station} to={endpointPoint(to)} />
            </>
          )}
        </>
      ) : (
        <>
          <p className="track-label">{t('trackNext')}</p>
          <p className="track-big">{p.nextStationId && name(p.nextStationId)}</p>
          <p className="meta">
            {n(p.stopsLeft)} {p.stopsLeft === 1 ? t('stop') : t('stops')} · ~
            {formatMinutes(p.etaSec, t, lang)}
          </p>
          {p.event && (
            <p className="note">
              {p.event.kind === 'arrive' ? t('getOff') : t('changeAt')} {name(p.event.stationId)}
              {p.event.stopsAway > 0 &&
                ` · ${n(p.event.stopsAway)} ${p.event.stopsAway === 1 ? t('stop') : t('stops')}`}
            </p>
          )}
        </>
      )}
      <p className="track-src">
        {t('trackNow')}: {name(here)} · {t(SOURCE_KEY[state.source])}
      </p>

      <div className="track-actions">
        <label>
          {t('trackAtLabel')}{' '}
          <select value={state.index} onChange={(e) => onSet(Number(e.target.value))}>
            {route.stations.map((id, i) => (
              <option key={id} value={i}>
                {name(id)}
              </option>
            ))}
          </select>
        </label>
        <label className="toggle">
          <input type="checkbox" checked={wakeMe} onChange={(e) => onWakeMe(e.target.checked)} />{' '}
          {t('trackWakeMe')}
        </label>
        <button type="button" className={`pill${follow ? ' on' : ''}`} onClick={onFollow}>
          {t('trackFollow')}
        </button>
      </div>
    </section>
  );
}
