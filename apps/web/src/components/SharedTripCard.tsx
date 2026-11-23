import { endpointName, type Endpoint } from '../endpoint';
import { formatMinutes, localDigits, useI18n } from '../i18n';
import type { Trip } from '../trip';
import { Icon } from './Icon';

interface Props {
  from: Endpoint;
  to: Endpoint;
  trip: Trip;
  starred: boolean;
  onView: () => void;
  onTrack: () => void;
  onSave: () => void;
  onClose: () => void;
}

/** Welcome card shown when the app is opened from a shared trip link. */
export function SharedTripCard({
  from,
  to,
  trip,
  starred,
  onView,
  onTrack,
  onSave,
  onClose,
}: Props) {
  const { t, lang } = useI18n();
  const n = (v: number | string) => localDigits(v, lang);
  const { route } = trip;

  return (
    <section className="shared-card" aria-label={t('sharedTitle')}>
      <button type="button" className="shared-x" aria-label={t('close')} onClick={onClose}>
        <Icon name="close" size={16} />
      </button>
      <p className="shared-eyebrow">{t('sharedTitle')}</p>
      <p className="shared-route">
        <span>{endpointName(from, lang)}</span>
        <span aria-hidden="true" className="shared-arrow">
          {lang === 'ar' ? '←' : '→'}
        </span>
        <span>{endpointName(to, lang)}</span>
      </p>
      <p className="shared-stats">
        <b>{formatMinutes(trip.totalSec, t, lang)}</b>
        <span>
          {n(route.stops + 1)} {t('sharedStations')}
        </span>
        {route.fare != null && (
          <span>
            {n(route.fare)} {t('fare')}
          </span>
        )}
      </p>
      <div className="shared-actions">
        <button type="button" className="pill primary" onClick={onView}>
          {t('sharedView')}
        </button>
        <button type="button" className="pill" onClick={onTrack}>
          <Icon name="play" size={16} /> {t('trackStart')}
        </button>
        <button type="button" className="pill" aria-pressed={starred} onClick={onSave}>
          <Icon name={starred ? 'star' : 'starOutline'} size={16} />{' '}
          {starred ? t('saved') : t('saveTrip')}
        </button>
      </div>
    </section>
  );
}
