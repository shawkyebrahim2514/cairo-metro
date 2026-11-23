import { useEffect, useRef } from 'react';
import { useModal } from '../useModal';
import type { TicketCategory } from '@cairo-metro/core';
import { canVibrate, fireAlert, unlockAudio, type AlertPrefs } from '../alerts';
import { localDigits, useI18n } from '../i18n';
import { HIGHLIGHTS, useSettings, type ThemeMode } from '../settings';

interface Props {
  category: TicketCategory;
  onCategory: (c: TicketCategory) => void;
  tiles: boolean;
  onTiles: (v: boolean) => void;
  onClose: () => void;
}

const THEMES: { id: ThemeMode; key: 'themeLight' | 'themeDark' | 'themeAuto' }[] = [
  { id: 'light', key: 'themeLight' },
  { id: 'dark', key: 'themeDark' },
  { id: 'auto', key: 'themeAuto' },
];

export function SettingsSheet({ category, onCategory, tiles, onTiles, onClose }: Props) {
  const { t, lang } = useI18n();
  const { theme, setTheme, highlight, setHighlight, alerts, setAlerts } = useSettings();

  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const modal = useModal(onClose);

  return (
    <div className="scrim" onClick={onClose}>
      <div
        className="settings"
        role="dialog"
        aria-modal="true"
        aria-label={t('settings')}
        ref={modal.ref}
        onKeyDown={modal.onKeyDown}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="settings-head">
          <h2>{t('settings')}</h2>
          <button type="button" className="icon" aria-label={t('close')} onClick={onClose}>
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        <h3>{t('appearance')}</h3>
        <p className="label">{t('theme')}</p>
        <div className="seg" role="group" aria-label={t('theme')}>
          {THEMES.map((o) => (
            <button
              key={o.id}
              type="button"
              className={theme === o.id ? 'on' : ''}
              aria-pressed={theme === o.id}
              onClick={() => setTheme(o.id)}
            >
              {t(o.key)}
            </button>
          ))}
        </div>

        <p className="label">{t('routeHighlight')}</p>
        <div className="swatches" role="group" aria-label={t('routeHighlight')}>
          {HIGHLIGHTS.map((h) => (
            <button
              key={h.id}
              type="button"
              className={highlight === h.id ? 'on' : ''}
              style={{ background: h.colour }}
              aria-pressed={highlight === h.id}
              aria-label={t(`hl_${h.id}`)}
              onClick={() => setHighlight(h.id)}
            />
          ))}
        </div>

        <h3>{t('alertsTitle')}</h3>
        {!canVibrate() && <p className="note">{t('alertNoVibrate')}</p>}
        <label className="toggle row">
          <input
            type="checkbox"
            checked={alerts.vibrate}
            onChange={(e) => setAlerts({ ...alerts, vibrate: e.target.checked })}
          />{' '}
          {t('alertVibrate')}
        </label>
        <label className="toggle row">
          <input
            type="checkbox"
            checked={alerts.eachStation}
            onChange={(e) => setAlerts({ ...alerts, eachStation: e.target.checked })}
          />{' '}
          {t('alertEach')}
        </label>
        <label className="toggle row">
          <input
            type="checkbox"
            checked={alerts.beep}
            onChange={(e) => setAlerts({ ...alerts, beep: e.target.checked })}
          />{' '}
          {t('alertBeep')}
        </label>
        <label className="toggle row">
          <input
            type="checkbox"
            checked={alerts.voice}
            onChange={(e) => setAlerts({ ...alerts, voice: e.target.checked })}
          />{' '}
          {t('alertVoice')}
        </label>
        <label className="toggle row">
          <input
            type="checkbox"
            checked={alerts.keepAwake}
            onChange={(e) => setAlerts({ ...alerts, keepAwake: e.target.checked })}
          />{' '}
          {t('alertAwake')}
        </label>
        <p className="label" id="warn-label">
          {t('alertWarn')}
        </p>
        <select
          aria-labelledby="warn-label"
          value={alerts.warnStops}
          onChange={(e) =>
            setAlerts({ ...alerts, warnStops: Number(e.target.value) as AlertPrefs['warnStops'] })
          }
        >
          <option value={0}>{t('alertWarnOff')}</option>
          {[1, 2, 3].map((n) => (
            <option key={n} value={n}>
              {localDigits(n, lang)} {t('alertWarnN')}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="pill test"
          onClick={() => {
            unlockAudio();
            for (const [i, kind] of (['station', 'warn', 'change', 'arrive'] as const).entries()) {
              timers.current.push(
                window.setTimeout(
                  () => fireAlert(kind, alerts, t('alertTestText'), lang),
                  i * 1500,
                ),
              );
            }
          }}
        >
          {t('alertTest')}
        </button>

        <h3>{t('tripTitle')}</h3>
        <p className="label" id="fare-label">
          {t('fareCategory')}
        </p>
        <select
          aria-labelledby="fare-label"
          value={category}
          onChange={(e) => onCategory(e.target.value as TicketCategory)}
        >
          <option value="standard">{t('catStandard')}</option>
          <option value="senior60AndArmyPolice">{t('catSenior')}</option>
          <option value="specialNeedsAndVeterans">{t('catSpecial')}</option>
        </select>

        <label className="toggle row">
          <input type="checkbox" checked={tiles} onChange={(e) => onTiles(e.target.checked)} />{' '}
          {t('mapTiles')}
        </label>
      </div>
    </div>
  );
}
