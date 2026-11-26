import { tripService, type LineId } from '@cairo-metro/core';
import { hoursData, lineColour, stationsById } from '../data';
import {
  formatClock,
  formatDistance,
  formatMinutes,
  localDigits,
  stationName,
  useI18n,
} from '../i18n';
import { useSettings } from '../settings';
import { endpointPoint, type Endpoint } from '../endpoint';
import type { Trip } from '../trip';
import { WalkLink } from './WalkLink';

interface Props {
  trip: Trip;
  from: Endpoint;
  to: Endpoint;
  title: string;
  selected: boolean;
  onSelect: () => void;
}

const lineNo = (line: string) => line.replace(/\D/g, '');

export function RouteCard({ trip, from, to, title, selected, onSelect }: Props) {
  const { t, lang } = useI18n();
  const { timeFormat } = useSettings();
  const { route } = trip;
  const n = (v: number | string) => localDigits(v, lang);
  const name = (id: string) => stationName(stationsById.get(id)!, lang);
  const mins = (sec: number) => `${n(Math.max(1, Math.round(sec / 60)))} ${t('min')}`;
  const nt = route.transfers.length;
  const now = new Date();
  const service = tripService(
    hoursData,
    route.legs.map((l) => l.line),
    now,
    { timeZone: 'Africa/Cairo' },
  );
  const firstWait = service.lines[0]?.avgWaitMin;
  const lastTrain = service.lines.find((s) => s.state !== 'open')?.lastTrain;
  const arrival = formatClock(new Date(now.getTime() + trip.totalSec * 1000), lang, timeFormat);
  const [lh, lm] = (lastTrain ?? '').split(':').map(Number);
  const lastTime =
    lh === undefined || lm === undefined || Number.isNaN(lh) || Number.isNaN(lm)
      ? null
      : formatClock(
          new Date(now.getFullYear(), now.getMonth(), now.getDate(), lh, lm),
          lang,
          timeFormat,
        );
  const pill = (line: LineId) => (
    <span className="badge line-pill" style={{ background: lineColour.get(line) }}>
      {t('line')} {n(lineNo(line))}
    </span>
  );

  return (
    <section className={`card route${selected ? ' selected' : ''}`} onClick={onSelect}>
      <header>
        <div>
          <button
            type="button"
            className="route-pick"
            aria-pressed={selected}
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
          >
            <span className="tag">{title}</span>
          </button>
          <div className="big-time">{formatMinutes(trip.totalSec, t, lang)}</div>
        </div>
        <div className="arrive">
          {t('arriveAt')}
          <b>{arrival}</b>
        </div>
      </header>

      <div className="stats">
        <div className="stat">
          <b>{n(route.stops + 1)}</b>
          <span>{route.stops === 0 ? t('stationCountOne') : t('stationCount')}</span>
        </div>
        <div className="stat">
          <b>{nt === 0 ? t('direct') : n(nt)}</b>
          <span>{nt === 0 ? t('noChanges') : nt === 1 ? t('transfer') : t('transfers')}</span>
        </div>
        {route.fare != null && (
          <div className="stat">
            <b>{n(route.fare)}</b>
            <span>{t('fare')}</span>
          </div>
        )}
      </div>

      {service.state === 'closed' && (
        <p className="status warn">
          <i className="dot" aria-hidden="true" />
          {t('svcClosed')}
        </p>
      )}
      {service.state === 'closing-soon' && (
        <p className="status warn">
          <i className="dot" aria-hidden="true" />
          {t('svcClosingSoon')}
          {lastTime && ` (${lastTime})`}
        </p>
      )}
      {service.state === 'open' && firstWait != null && (
        <p className="status">
          <i className="dot" aria-hidden="true" />
          {t('svcRunning')} {n(Math.round(firstWait))} {t('min')}
        </p>
      )}

      <ol className="tl">
        {trip.walkIn && (
          <li className="walk">
            <span className="node ico" aria-hidden="true">
              🚶
            </span>
            <div>
              <div className="name">
                {t('walkToStation')} {name(trip.walkIn.station.id)}
              </div>
              <div className="sub">
                {formatDistance(trip.walkIn.walkMeters, t, lang)} ·{' '}
                {formatMinutes(trip.walkIn.walkSec, t, lang)}
              </div>
              <WalkLink from={endpointPoint(from)} to={trip.walkIn.station} />
            </div>
          </li>
        )}
        {route.legs.flatMap((leg, i) => {
          const tr = route.transfers[i];
          const next = route.legs[i + 1];
          const middle = leg.stations.slice(1, -1);
          const style = { '--c': lineColour.get(leg.line) } as React.CSSProperties;
          const ride = (
            <li key={`leg${i}`} style={style}>
              <span className="node" aria-hidden="true" />
              <div>
                {i === 0 && <div className="name">{name(leg.stations[0]!)}</div>}
                <div className="sub">
                  {pill(leg.line)} {t('towards')} {leg.towards.map(name).join(' / ')}
                </div>
                <details className="ride">
                  <summary>
                    <span>
                      {n(leg.stops)} {leg.stops === 1 ? t('stop') : t('stops')} ·{' '}
                      {mins(leg.rideSec)}
                    </span>
                    <span aria-hidden="true">▾</span>
                  </summary>
                  {middle.length > 0 && (
                    <ul>
                      {middle.map((id) => (
                        <li key={id}>{name(id)}</li>
                      ))}
                    </ul>
                  )}
                </details>
              </div>
            </li>
          );
          const end = tr ? (
            <li key={`change${i}`} style={{ '--c': 'var(--hl)' } as React.CSSProperties}>
              <span className="node end" aria-hidden="true">
                ⇄
              </span>
              <div>
                <div className="name">{name(tr.stationId)}</div>
                <span className="change">
                  {tr.fromLine === tr.toLine ? t('changeBranch') : t('changeToLine')}{' '}
                  {next && pill(next.line)} · {mins(tr.sec)}
                </span>
              </div>
            </li>
          ) : (
            <li key={`exit${i}`} style={style}>
              <span className="node end" aria-hidden="true" />
              <div>
                <div className="name">{name(leg.stations.at(-1)!)}</div>
                <div className="sub">{t('getOffHere')}</div>
              </div>
            </li>
          );
          return [ride, end];
        })}{' '}
        {trip.walkOut ? (
          <li className="walk">
            <span className="node ico" aria-hidden="true">
              📍
            </span>
            <div>
              <div className="name">{t('destLabel')}</div>
              <div className="sub">
                {t('walkFromStation')} {name(trip.walkOut.station.id)} ·{' '}
                {formatDistance(trip.walkOut.walkMeters, t, lang)} ·{' '}
                {formatMinutes(trip.walkOut.walkSec, t, lang)}
              </div>
              <WalkLink from={trip.walkOut.station} to={endpointPoint(to)} />
            </div>
          </li>
        ) : null}
      </ol>

      <details className="tips" onClick={(e) => e.stopPropagation()}>
        <summary>
          <span aria-hidden="true">♀</span> {t('womenTitle')}
        </summary>
        <p>{t('womenCars')}</p>
      </details>
    </section>
  );
}
