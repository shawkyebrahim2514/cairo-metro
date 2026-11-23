import { useMemo, useState } from 'react';
import { nearestStations } from '@cairo-metro/core';
import { MetroMap, type MapMarker } from '../components/MetroMap';
import { PlaceInput } from '../components/PlaceInput';
import { lineColour, metro, type PlaceResolver } from '../data';
import { endpointName, endpointPoint, pinned, type Endpoint } from '../endpoint';
import { formatDistance, formatMinutes, stationName, useI18n } from '../i18n';

const FAR_METERS = 3000;

export function NearestPage({
  resolver,
  tiles,
}: {
  resolver: PlaceResolver | null;
  tiles: boolean;
}) {
  const { t, lang } = useI18n();
  const [place, setPlace] = useState<Endpoint | null>(null);

  const results = useMemo(
    () => (place ? nearestStations(metro.stations, endpointPoint(place), { limit: 3 }) : []),
    [place],
  );

  const markers = useMemo<MapMarker[]>(() => {
    if (!place) return [];
    const out: MapMarker[] = [
      { point: endpointPoint(place), label: endpointName(place, lang), primary: true },
    ];
    for (const r of results) {
      out.push({
        point: { lat: r.station.lat, lng: r.station.lng },
        label: stationName(r.station, lang),
        colour: lineColour.get(r.lines[0]!),
      });
    }
    return out;
  }, [place, results, lang]);

  const far = results.length > 0 && results[0]!.straightMeters > FAR_METERS;

  return (
    <>
      <PlaceInput
        label={t('tabNearest')}
        endpoint={place}
        onChange={setPlace}
        resolver={resolver}
      />
      {!resolver && <p className="note">{t('loadingPlaces')}</p>}
      {!place && <p className="note">{t('nearestHint')}</p>}
      {far && <p className="note warn">{t('farWarning')}</p>}
      <MetroMap markers={markers} tiles={tiles} onPick={(p) => setPlace(pinned(p, t))} />
      <p className="note">{t('mapHint')}</p>
      {results.length > 0 && (
        <>
          <h2>{t('nearestTitle')}</h2>
          <ul className="cards">
            {results.map((r) => (
              <li key={r.station.id} className="card">
                <strong>{stationName(r.station, lang)}</strong>{' '}
                {r.lines.map((l) => (
                  <span key={l} className="badge" style={{ background: lineColour.get(l) }}>
                    {l}
                  </span>
                ))}
                {r.station.interchange && <small> · {t('interchange')}</small>}
                <p className="meta">
                  {formatDistance(r.walkMeters, t, lang)} {t('walk')} ·{' '}
                  {formatMinutes(r.walkSec, t, lang)}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
