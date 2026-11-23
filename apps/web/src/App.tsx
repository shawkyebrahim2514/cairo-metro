import { useEffect, useMemo, useState } from 'react';
import { loadPlaceResolver, type PlaceResolver } from './data';
import { dictionaries, I18nContext, type I18n, type Lang } from './i18n';
import { NearestPage } from './pages/NearestPage';
import { PlannerPage } from './pages/PlannerPage';
import './styles.css';
import { takeSharedText } from './share';

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
    sharedAtLoad ? 'nearest' : stored<Tab>('tab', ['nearest', 'plan'], 'nearest'),
  );
  const [tiles, setTiles] = useState(() => localStorage.getItem('tiles') === '1');
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
            <PlannerPage resolver={resolver} tiles={tiles} />
          )}
        </main>

        <footer>
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
