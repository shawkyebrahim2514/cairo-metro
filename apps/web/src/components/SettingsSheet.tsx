import { useEffect } from 'react';
import type { TicketCategory } from '@cairo-metro/core';
import { useI18n } from '../i18n';
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
  const { t } = useI18n();
  const { theme, setTheme, highlight, setHighlight } = useSettings();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="scrim" onClick={onClose}>
      <div
        className="settings"
        role="dialog"
        aria-modal="true"
        aria-label={t('settings')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="settings-head">
          <h2>{t('settings')}</h2>
          <button type="button" className="icon" aria-label={t('close')} onClick={onClose}>
            ✕
          </button>
        </div>

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

        <p className="label">{t('fareCategory')}</p>
        <select value={category} onChange={(e) => onCategory(e.target.value as TicketCategory)}>
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
