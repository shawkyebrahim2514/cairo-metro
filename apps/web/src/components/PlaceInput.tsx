import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  nearestStations,
  parsePlaceInput,
  searchStations,
  type LineId,
  type ResolvedPlace,
} from '@cairo-metro/core';
import { lineColour, metro, type PlaceResolver } from '../data';
import { endpointName, pinned, type Endpoint } from '../endpoint';
import { formatDistance, stationName, useI18n } from '../i18n';

type Group = 'stations' | 'places' | 'other';
type Filter = 'all' | 'stations' | 'places';

interface Suggestion {
  key: string;
  label: string;
  sub: string;
  endpoint: Endpoint;
  group: Group;
  /** Line ids for station suggestions, shown as coloured dots. */
  lines?: LineId[];
}

interface Props {
  label: string;
  endpoint: Endpoint | null;
  onChange: (e: Endpoint | null) => void;
  resolver: PlaceResolver | null;
  showGps?: boolean;
  /** Colour of the dot in front of the field. */
  tone?: 'from' | 'to';
  /** Text to prefill on mount (e.g. a shared link), shown with suggestions. */
  seedText?: string | null;
}

const fromPlace = (p: ResolvedPlace, sub: string, key: string, group: Group): Suggestion => ({
  key,
  label: p.name,
  sub,
  endpoint: { kind: 'point', point: p.point, name: p.name },
  group,
});

export function PlaceInput({
  label,
  endpoint,
  onChange,
  resolver,
  showGps = true,
  tone,
  seedText,
}: Props) {
  const { t, lang } = useI18n();
  const [text, setText] = useState(seedText ?? '');
  const [open, setOpen] = useState(Boolean(seedText));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const inputId = useId();
  const [active, setActive] = useState(-1);

  const typedRef = useRef(false);
  const prevEndpointRef = useRef<Endpoint | null>(null);
  const gpsToken = useRef(0);

  // Keep the visible text in sync when the endpoint changes from outside (map tap, swap, language).
  // Clearing caused by the user typing must not wipe what they typed.
  useEffect(() => {
    gpsToken.current++;
    if (typedRef.current) {
      typedRef.current = false;
    } else if (endpoint) {
      setText(endpointName(endpoint, lang));
    } else if (prevEndpointRef.current) {
      setText('');
    }
    prevEndpointRef.current = endpoint;
  }, [endpoint, lang]);

  useEffect(() => {
    return () => {
      gpsToken.current++;
    };
  }, []);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const { suggestions, hint } = useMemo(() => {
    const q = text.trim();
    if (!q || (endpoint && q === endpointName(endpoint, lang))) {
      return { suggestions: [] as Suggestion[], hint: '' };
    }
    const parsed = parsePlaceInput(q);
    const out: Suggestion[] = [];
    let hint = '';

    if (parsed?.kind === 'coords' || parsed?.kind === 'short' || /https?:\/\//.test(q)) {
      const r = resolver?.resolve(q);
      if (r?.status === 'resolved') {
        out.push(
          fromPlace(
            { ...r.place, name: r.place.name || t('pinned') },
            t('pinned'),
            'link',
            'other',
          ),
        );
      } else if (r?.status === 'ambiguous') {
        r.candidates.forEach((c, i) => out.push(fromPlace(c, t('placeLabel'), `c${i}`, 'other')));
      } else if (r?.status === 'needs-name') {
        hint = t('needsName');
      } else if (parsed?.kind === 'coords') {
        out.push({
          key: 'coords',
          label: t('pinned'),
          sub: `${parsed.point.lat.toFixed(5)}, ${parsed.point.lng.toFixed(5)}`,
          endpoint: pinned(parsed.point, t),
          group: 'other',
        });
      }
      return { suggestions: out, hint };
    }

    for (const m of searchStations(metro.stations, q, filter === 'stations' ? 8 : 4)) {
      const lines = [...new Set(m.station.lines.map((l) => l.line))];
      out.push({
        key: `s-${m.station.id}`,
        label: stationName(m.station, lang),
        sub: `${t('stationLabel')} · ${lines}`,
        endpoint: { kind: 'station', station: m.station },
        group: 'stations',
        lines,
      });
    }
    resolver?.searchPlaces(q, filter === 'places' ? 10 : 6).forEach((p, i) => {
      const near = nearestStations(metro.stations, p.point, { limit: 1 })[0];
      const nearText = near
        ? `${t('nearestPrefix')}: ${stationName(near.station, lang)} · ${formatDistance(near.walkMeters, t, lang)}`
        : '';
      out.push(
        fromPlace(p, [p.placeType, nearText].filter(Boolean).join(' · '), `p${i}`, 'places'),
      );
    });
    return { suggestions: out, hint };
  }, [text, endpoint, lang, resolver, t, filter]);

  const visible = suggestions.filter(
    (s) => s.group === 'other' || filter === 'all' || s.group === filter,
  );
  const groups: { group: Group; items: Suggestion[] }[] = (['other', 'stations', 'places'] as const)
    .map((group) => ({ group, items: visible.filter((s) => s.group === group) }))
    .filter((g) => g.items.length > 0);

  const flat = groups.flatMap((g) => g.items);

  const locate = () => {
    const token = ++gpsToken.current;
    setBusy(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (token !== gpsToken.current) return;
        setBusy(false);
        onChange({
          kind: 'point',
          point: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          name: t('useMyLocation'),
        });
      },
      () => {
        if (token !== gpsToken.current) return;
        setBusy(false);
        setError(t('locationDenied'));
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const choose = (s: Suggestion) => {
    gpsToken.current++;
    setBusy(false);
    onChange(s.endpoint);
    setText(endpointName(s.endpoint, lang));
    setOpen(false);
  };

  return (
    <div className="place-input" ref={rootRef}>
      <label className="label" htmlFor={inputId}>
        {label}
      </label>
      <div>
        <div className="field">
          {tone && <i className={`dot ${tone}`} aria-hidden="true" />}
          <input
            id={inputId}
            value={text}
            placeholder={t('searchPlaceholder')}
            onChange={(e) => {
              setText(e.target.value);
              setOpen(true);
              setActive(-1);
              gpsToken.current++;
              setBusy(false);
              if (endpoint) {
                typedRef.current = true;
                onChange(null);
              }
            }}
            onFocus={() => setOpen(true)}
            autoComplete="off"
            enterKeyHint="search"
            role="combobox"
            aria-expanded={open && suggestions.length > 0}
            aria-controls={open && suggestions.length > 0 ? listId : undefined}
            aria-activedescendant={
              active >= 0 && flat[active] ? `${listId}-${flat[active]!.key}` : undefined
            }
            aria-autocomplete="list"
            onKeyDown={(e) => {
              if (e.key === 'Escape') setOpen(false);
              else if (e.key === 'ArrowDown' && flat.length) {
                e.preventDefault();
                setOpen(true);
                setActive((a) => (a + 1) % flat.length);
              } else if (e.key === 'ArrowUp' && flat.length) {
                e.preventDefault();
                setActive((a) => (a <= 0 ? flat.length - 1 : a - 1));
              } else if (e.key === 'Enter' && open && flat[active]) {
                e.preventDefault();
                choose(flat[active]!);
              }
            }}
          />
          {text && (
            <button
              type="button"
              className="icon"
              aria-label={t('clear')}
              onClick={() => {
                gpsToken.current++;
                setBusy(false);
                setText('');
                onChange(null);
              }}
            >
              <span aria-hidden="true">×</span>
            </button>
          )}
          {showGps && 'geolocation' in navigator && (
            <button
              type="button"
              className="icon"
              title={t('useMyLocation')}
              aria-label={t('useMyLocation')}
              onClick={locate}
              disabled={busy}
            >
              <span aria-hidden="true">{busy ? '…' : '◎'}</span>
            </button>
          )}
        </div>
      </div>
      <p className="sr-only" role="status">
        {open && suggestions.length > 0 ? `${suggestions.length} ${t('resultsCount')}` : ''}
      </p>
      {error && <p className="note error">{error}</p>}
      {hint && <p className="note">{hint}</p>}
      {open && suggestions.length > 0 && (
        <div className="suggestions">
          <div className="chips" role="group" aria-label={t('searchPlaceholder')}>
            {(['all', 'stations', 'places'] as const).map((f) => (
              <button
                key={f}
                type="button"
                className={filter === f ? 'chip on' : 'chip'}
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
              >
                {t(
                  f === 'all' ? 'filterAll' : f === 'stations' ? 'filterStations' : 'filterPlaces',
                )}
              </button>
            ))}
          </div>
          <ul id={listId} role="listbox" aria-label={label}>
            {groups.map(({ group, items }) => (
              <li key={group} className="group" role="presentation">
                {group !== 'other' && (
                  <h4>{t(group === 'stations' ? 'groupStations' : 'groupPlaces')}</h4>
                )}
                <ul role="presentation">
                  {items.map((s) => (
                    <li key={s.key} role="presentation">
                      <button
                        type="button"
                        role="option"
                        id={`${listId}-${s.key}`}
                        aria-selected={flat[active]?.key === s.key}
                        className={flat[active]?.key === s.key ? 'active' : undefined}
                        tabIndex={-1}
                        onClick={() => choose(s)}
                      >
                        <span className={`ico ${s.group}`} aria-hidden="true">
                          {s.group === 'stations' ? 'M' : s.group === 'places' ? 'P' : '📍'}
                        </span>
                        <span className="t">
                          <b>{s.label}</b>
                          <small>{s.sub}</small>
                        </span>
                        {s.lines && (
                          <span className="lines" aria-hidden="true">
                            {s.lines.map((l) => (
                              <i key={l} style={{ background: lineColour.get(l) }} />
                            ))}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
