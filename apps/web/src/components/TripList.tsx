import { useState } from 'react';
import { endpointName } from '../endpoint';
import { formatClock, useI18n, type Lang } from '../i18n';
import { useSettings } from '../settings';
import { Icon } from './Icon';
import { openTrip, type SavedTrip } from '../storage';
import type { Endpoint } from '../endpoint';

interface Props {
  trips: SavedTrip[];
  onOpen: (from: Endpoint, to: Endpoint) => void;
  onClear: () => void;
}

const COLLAPSED = 5;
const DAY = 86_400_000;

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Starred trips first, then the history of planned trips with a date label. */
export function TripList({ trips, onOpen, onClear }: Props) {
  const { t, lang } = useI18n();
  const { timeFormat } = useSettings();
  const [all, setAll] = useState(false);
  const saved = trips.filter((x) => x.starred);
  const history = trips.filter((x) => !x.starred);
  const shown = all ? history : history.slice(0, COLLAPSED);

  const when = (at: number | undefined, language: Lang) => {
    if (!at) return '';
    const d = new Date(at);
    const days = Math.round((startOfDay(new Date()) - startOfDay(d)) / DAY);
    if (days === 0) return `${t('today')} ${formatClock(d, language, timeFormat)}`;
    if (days === 1) return t('yesterday');
    return d.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-GB', {
      day: 'numeric',
      month: 'short',
    });
  };

  const row = (s: SavedTrip) => {
    const trip = openTrip(s);
    if (!trip) return null;
    return (
      <li key={s.from + '>' + s.to} className="card trip-row">
        <button
          type="button"
          className="link"
          title={t('historyAgain')}
          onClick={() => onOpen(trip.from, trip.to)}
        >
          {s.starred && <Icon name="star" size={14} />} {endpointName(trip.from, lang)} →{' '}
          {endpointName(trip.to, lang)}
        </button>
        {!s.starred && <span className="trip-when">{when(s.at, lang)}</span>}
      </li>
    );
  };

  if (trips.length === 0) return null;
  return (
    <>
      {saved.length > 0 && (
        <>
          <h2>{t('saved')}</h2>
          <ul className="cards">{saved.map(row)}</ul>
        </>
      )}
      {history.length > 0 && (
        <>
          <h2>
            <Icon name="history" size={18} /> {t('history')}
          </h2>
          <ul className="cards">{shown.map(row)}</ul>
          <div className="trip-tools">
            {history.length > COLLAPSED && (
              <button type="button" className="pill" onClick={() => setAll((v) => !v)}>
                {all ? t('historyLess') : `${t('historyMore')} (${history.length})`}
              </button>
            )}
            <button type="button" className="pill" onClick={onClear}>
              <Icon name="close" size={14} /> {t('historyClear')}
            </button>
          </div>
        </>
      )}
    </>
  );
}
