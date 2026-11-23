import { useEffect, useMemo, useState } from 'react';
import type { TicketCategory } from '@cairo-metro/core';
import { loadPlaceResolver, type PlaceResolver } from './data';
import { dictionaries, I18nContext, type I18n, type Lang, type TimeFormat } from './i18n';
import { loadAlerts, saveAlerts, type AlertPrefs } from './alerts';
import { Footer } from './components/Footer';
import { Icon } from './components/Icon';
import { SettingsSheet } from './components/SettingsSheet';
import { Tour } from './components/Tour';
import { NearestPage } from './pages/NearestPage';
import { PlannerPage } from './pages/PlannerPage';
import './styles.css';
import { takeSharedText } from './share';
import { readPlanHash } from './storage';
import {
  applyTheme,
  highlightColour,
  SettingsContext,
  type HighlightId,
  type Settings,
  type StationLabels,
  type ThemeMode,
} from './settings';

type Tab = 'nearest' | 'plan';

// Read once at load: the share target query is removed from the URL right away.
const sharedAtLoad = takeSharedText();

const stored = <T extends string>(key: string, allowed: T[], fallback: T): T => {
  const v = localStorage.getItem(key) as T | null;
  return v && allowed.includes(v) ? v : fallback;
};

export function App() {
  const [lang, setLang] = useState<Lang>(() =>
    stored<Lang>('lang', ['en', 'ar'], navigator.language.startsWith('ar') ? 'ar' : 'en'),
  );
  const [tab, setTab] = useState<Tab>(() =>
    sharedAtLoad
      ? 'nearest'
      : readPlanHash()
        ? 'plan'
        : stored<Tab>('tab', ['nearest', 'plan'], 'nearest'),
  );
  const [tiles, setTiles] = useState(() => localStorage.getItem('tiles') === '1');
  const [category, setCategory] = useState<TicketCategory>(() =>
    stored<TicketCategory>(
      'category',
      ['standard', 'senior60AndArmyPolice', 'specialNeedsAndVeterans'],
      'standard',
    ),
  );
  const [tour, setTour] = useState(
    () => !sharedAtLoad && !readPlanHash() && localStorage.getItem('toured') !== '1',
  );
  const closeTour = () => {
    localStorage.setItem('toured', '1');
    setTour(false);
  };
  const [theme, setTheme] = useState<ThemeMode>(() =>
    stored<ThemeMode>('theme', ['light', 'dark', 'auto'], 'auto'),
  );
  const [highlight, setHighlight] = useState<HighlightId>(() =>
    stored<HighlightId>('highlight', ['amber', 'violet', 'pink', 'cyan'], 'amber'),
  );
  const [alerts, setAlerts] = useState<AlertPrefs>(loadAlerts);
  const [timeFormat, setTimeFormat] = useState<TimeFormat>(() =>
    stored<TimeFormat>('timeFormat', ['12', '24'], '24'),
  );
  const [stationLabels, setStationLabels] = useState<StationLabels>(() =>
    stored<StationLabels>('stationLabels', ['always', 'zoom', 'off'], 'always'),
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [resolver, setResolver] = useState<PlaceResolver | null>(null);

  const [resolverFailed, setResolverFailed] = useState(false);

  useEffect(() => {
    let live = true;
    loadPlaceResolver().then(
      (r) => live && setResolver(r),
      () => live && setResolverFailed(true),
    );
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('theme', theme);
    localStorage.setItem('highlight', highlight);
    applyTheme(theme, highlight);
    if (theme !== 'auto') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('auto', highlight);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme, highlight]);

  useEffect(() => saveAlerts(alerts), [alerts]);
  useEffect(() => localStorage.setItem('timeFormat', timeFormat), [timeFormat]);
  useEffect(() => localStorage.setItem('stationLabels', stationLabels), [stationLabels]);

  const settings = useMemo<Settings>(
    () => ({
      theme,
      setTheme,
      highlight,
      alerts,
      setAlerts,
      setHighlight,
      timeFormat,
      setTimeFormat,
      stationLabels,
      setStationLabels,
      highlightColour: highlightColour(highlight),
    }),
    [theme, highlight, alerts, timeFormat, stationLabels],
  );

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    localStorage.setItem('lang', lang);
  }, [lang]);

  const i18n = useMemo<I18n>(() => {
    const dict = dictionaries[lang];
    return { lang, setLang, t: (k) => dict[k] };
  }, [lang]);
  const { t } = i18n;

  return (
    <I18nContext.Provider value={i18n}>
      <SettingsContext.Provider value={settings}>
        <div className={tab === 'plan' ? 'app plan' : 'app'}>
          <header className="top">
            <h1>{t('appName')}</h1>
            <div className="actions">
              <button
                type="button"
                className="pill"
                aria-label={t('settings')}
                onClick={() => setSettingsOpen(true)}
              >
                <Icon name="gear" />
              </button>
              <button
                type="button"
                className="pill"
                aria-label={t('help')}
                onClick={() => setTour(true)}
              >
                ?
              </button>
              <button
                type="button"
                className="pill"
                onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
              >
                {t('language')}
              </button>
            </div>
          </header>

          <nav className="tabs" aria-label={t('appName')}>
            {(['nearest', 'plan'] as const).map((id) => (
              <button
                key={id}
                type="button"
                aria-current={tab === id ? 'page' : undefined}
                className={tab === id ? 'active' : ''}
                onClick={() => {
                  setTab(id);
                  localStorage.setItem('tab', id);
                }}
              >
                <span className="tab-ico" aria-hidden="true">
                  <Icon name={id === 'nearest' ? 'pin' : 'metro'} size={22} />
                </span>
                {id === 'nearest' ? t('tabNearest') : t('tabPlan')}
              </button>
            ))}
          </nav>

          {!resolver && (
            <p className={resolverFailed ? 'note warn' : 'note'}>
              {t(resolverFailed ? 'placesFailed' : 'loadingPlaces')}
            </p>
          )}

          <main>
            {tab === 'nearest' ? (
              <NearestPage resolver={resolver} tiles={tiles} shared={sharedAtLoad} />
            ) : (
              <PlannerPage resolver={resolver} tiles={tiles} category={category} />
            )}
          </main>

          {tour && <Tour onClose={closeTour} />}
          {settingsOpen && (
            <SettingsSheet
              category={category}
              onCategory={(v) => {
                setCategory(v);
                localStorage.setItem('category', v);
              }}
              tiles={tiles}
              onTiles={(v) => {
                setTiles(v);
                localStorage.setItem('tiles', v ? '1' : '0');
              }}
              onClose={() => setSettingsOpen(false)}
            />
          )}

          {tab === 'nearest' && <Footer />}
        </div>
      </SettingsContext.Provider>
    </I18nContext.Provider>
  );
}
