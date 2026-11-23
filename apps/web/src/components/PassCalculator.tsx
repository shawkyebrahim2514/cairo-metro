import { useState } from 'react';
import { comparePass, type TicketCategory } from '@cairo-metro/core';
import { faresData } from '../data';
import { localDigits, useI18n } from '../i18n';

const DEFAULT_RIDES = 44; // 22 working days, there and back

export function PassCalculator({ stops, category }: { stops: number; category: TicketCategory }) {
  const { t, lang } = useI18n();
  const [rides, setRides] = useState(DEFAULT_RIDES);
  const n = (v: number) => localDigits(v, lang);
  const result = comparePass(faresData, stops, rides, category);

  return (
    <details className="card">
      <summary>{t('passTitle')}</summary>
      {!result ? (
        <p className="note">{t('noPass')}</p>
      ) : (
        <>
          <label className="rides">
            {t('ridesPerMonth')}{' '}
            <input
              type="number"
              min={1}
              max={200}
              inputMode="numeric"
              value={rides}
              onChange={(e) => setRides(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
            />
          </label>
          <p className="meta">
            {t('singleTickets')}: {n(result.ticketTotal)} {t('fare')}
            <br />
            {t('monthlyPass')} ({t('zonesApprox')} {n(result.zones)}): {n(result.monthlyPass)}{' '}
            {t('fare')}
          </p>
          <p>
            <strong>
              {result.savings > 0
                ? `${t('passCheaper')} ${n(result.savings)} ${t('fare')}`
                : t('ticketsCheaper')}
            </strong>
            <br />
            <small>
              {t('breakEven')} {n(result.breakEvenRides)}
            </small>
          </p>
        </>
      )}
    </details>
  );
}
