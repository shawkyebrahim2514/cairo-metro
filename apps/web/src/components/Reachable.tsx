import { stationsById } from '../data';
import { formatMinutes, localDigits, stationName, useI18n } from '../i18n';
import type { ReachResult } from '../trip';

const OPTIONS = [10, 20, 30, 45, 60];

interface Props {
  minutes: number;
  onMinutes: (m: number) => void;
  result: ReachResult | null;
}

export function Reachable({ minutes, onMinutes, result }: Props) {
  const { t, lang } = useI18n();
  return (
    <section className="card">
      <h2 style={{ marginTop: 0 }}>{t('reachTitle')}</h2>
      <div className="chips" role="group" aria-label={t('reachWithin')}>
        {OPTIONS.map((m) => (
          <button
            key={m}
            type="button"
            className={m === minutes ? 'chip on' : 'chip'}
            aria-pressed={m === minutes}
            onClick={() => onMinutes(m)}
          >
            {localDigits(m, lang)} {t('min')}
          </button>
        ))}
      </div>
      {result && result.items.length === 0 && <p className="note">{t('reachNone')}</p>}
      {result && result.items.length > 0 && (
        <>
          <p className="note">
            {localDigits(result.items.length, lang)} {t('stationCount')}
          </p>
          <ul className="reach-list">
            {result.items.map((r) => (
              <li key={r.stationId}>
                <span>{stationName(stationsById.get(r.stationId)!, lang)}</span>
                <small>{formatMinutes(r.totalSec + result.walkSec, t, lang)}</small>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
