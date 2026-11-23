import { useEffect, useMemo, useState } from 'react';
import type { TicketCategory } from '@cairo-metro/core';
import { loadPlaceResolver, type PlaceResolver } from './data';
import { dictionaries, I18nContext, type I18n, type Lang } from './i18n';
import { NearestPage } from './pages/NearestPage';
import { PlannerPage } from './pages/PlannerPage';
import './styles.css';
import { takeSharedText } from './share';
import { readPlanHash } from './storage';

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
      <div className="app">
        <header className="top">
          <h1>{t('appName')}</h1>
          <button
            type="button"
            className="pill"
            onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
          >
            {t('language')}
          </button>
        </header>

        <nav className="tabs" role="tablist">
          {(['nearest', 'plan'] as const).map((id) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              className={tab === id ? 'active' : ''}
              onClick={() => {
                setTab(id);
                localStorage.setItem('tab', id);
              }}
            >
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

        <footer>
          <label className="toggle">
            {t('fareCategory')}{' '}
            <select
              value={category}
              onChange={(e) => {
                const v = e.target.value as TicketCategory;
                setCategory(v);
                localStorage.setItem('category', v);
              }}
            >
              <option value="standard">{t('catStandard')}</option>
              <option value="senior60AndArmyPolice">{t('catSenior')}</option>
              <option value="specialNeedsAndVeterans">{t('catSpecial')}</option>
            </select>
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={tiles}
              onChange={(e) => {
                setTiles(e.target.checked);
                localStorage.setItem('tiles', e.target.checked ? '1' : '0');
              }}
            />{' '}
            {t('mapTiles')}
          </label>
          <small>{t('attribution')}</small>
        </footer>
      </div>
    </I18nContext.Provider>
  );
}
