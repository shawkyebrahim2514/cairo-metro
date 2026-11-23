import { useEffect, useMemo, useRef, useState } from 'react';
import { parsePlaceInput, searchStations, type ResolvedPlace } from '@cairo-metro/core';
import { metro, type PlaceResolver } from '../data';
import { endpointName, pinned, type Endpoint } from '../endpoint';
import { stationName, useI18n } from '../i18n';

interface Suggestion {
  key: string;
  label: string;
  sub: string;
  endpoint: Endpoint;
}

interface Props {
  label: string;
  endpoint: Endpoint | null;
  onChange: (e: Endpoint | null) => void;
  resolver: PlaceResolver | null;
  showGps?: boolean;
  /** Text to prefill on mount (e.g. a shared link), shown with suggestions. */
  seedText?: string | null;
}

const fromPlace = (p: ResolvedPlace, sub: string, key: string): Suggestion => ({
  key,
  label: p.name,
  sub,
  endpoint: { kind: 'point', point: p.point, name: p.name },
});

export function PlaceInput({
  label,
  endpoint,
  onChange,
  resolver,
  showGps = true,
  seedText,
}: Props) {
  const { t, lang } = useI18n();
  const [text, setText] = useState(seedText ?? '');
  const [open, setOpen] = useState(Boolean(seedText));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

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
        out.push(fromPlace({ ...r.place, name: r.place.name || t('pinned') }, t('pinned'), 'link'));
      } else if (r?.status === 'ambiguous') {
        r.candidates.forEach((c, i) => out.push(fromPlace(c, t('placeLabel'), `c${i}`)));
      } else if (r?.status === 'needs-name') {
        hint = t('needsName');
      } else if (parsed?.kind === 'coords') {
        out.push({
          key: 'coords',
          label: t('pinned'),
          sub: `${parsed.point.lat.toFixed(5)}, ${parsed.point.lng.toFixed(5)}`,
          endpoint: pinned(parsed.point, t),
        });
      }
      return { suggestions: out, hint };
    }

    for (const m of searchStations(metro.stations, q, 4)) {
      const lines = [...new Set(m.station.lines.map((l) => l.line))].join(' / ');
      out.push({
        key: `s-${m.station.id}`,
        label: stationName(m.station, lang),
        sub: `${t('stationLabel')} · ${lines}`,
        endpoint: { kind: 'station', station: m.station },
      });
    }
    resolver
      ?.searchPlaces(q, 6)
      .forEach((p, i) => out.push(fromPlace(p, p.placeType ?? '', `p${i}`)));
    return { suggestions: out, hint };
  }, [text, endpoint, lang, resolver, t]);

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
      <label>
        <span className="label">{label}</span>
        <div className="field">
          <input
            value={text}
            placeholder={t('searchPlaceholder')}
            onChange={(e) => {
              setText(e.target.value);
              setOpen(true);
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
              ×
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
              {busy ? '…' : '◎'}
            </button>
          )}
        </div>
      </label>
      {error && <p className="note error">{error}</p>}
      {hint && <p className="note">{hint}</p>}
      {open && suggestions.length > 0 && (
        <ul className="suggestions" role="listbox">
          {suggestions.map((s) => (
            <li key={s.key} role="option" aria-selected={false}>
              <button type="button" onClick={() => choose(s)}>
                <span>{s.label}</span>
                <small>{s.sub}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
