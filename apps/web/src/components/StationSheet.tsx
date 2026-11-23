import { useMemo, useRef } from 'react';
import type { Station } from '@cairo-metro/core';
import { hoursData, lineColour, type PlaceResolver } from '../data';
import { formatDistance, localDigits, stationName, useI18n } from '../i18n';
import { useModal } from '../useModal';

const lineNo = (line: string) => line.replace(/\D/g, '');

/** Details of a tapped station: lines, first/last train, nearby places and quick From/To buttons. */
export function StationSheet({
  station,
  resolver,
  onFrom,
  onTo,
  onClose,
}: {
  station: Station;
  resolver: PlaceResolver | null;
  onFrom: () => void;
  onTo: () => void;
  onClose: () => void;
}) {
  const { t, lang } = useI18n();
  const closeRef = useRef<HTMLButtonElement>(null);
  const modal = useModal(onClose, () => closeRef.current);
  const lines = [...new Set(station.lines.map((l) => l.line))];
  const nearby = useMemo(() => resolver?.placesNear(station, 600, 8) ?? [], [resolver, station]);
  const n = (v: number | string) => localDigits(v, lang);
  const other = lang === 'ar' ? station.name.en : station.name.ar;

  return (
    <div className="tour-scrim" onClick={onClose}>
      <div
        className="tour station-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="station-title"
        ref={modal.ref}
        onKeyDown={modal.onKeyDown}
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        <h2 id="station-title">{stationName(station, lang)}</h2>
        {other && <p className="muted">{other}</p>}

        <h3>{t('stationLines')}</h3>
        <div className="station-lines">
          {lines.map((line) => {
            const h = hoursData.lines[line];
            const last = h?.lastTrains?.map((x) => x.time).join(' / ');
            return (
              <div className="station-line" key={line}>
                <span className="badge line-pill" style={{ background: lineColour.get(line) }}>
                  {t('line')} {n(lineNo(line))}
                </span>
                {h && (
                  <span className="muted">
                    {t('stationFirstLast')}: {n(h.firstTrain)} – {n(last ?? h.serviceEnds ?? '')}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <p className="note">{t('stationWomen')}</p>

        <h3>{t('stationNearby')}</h3>
        {nearby.length === 0 ? (
          <p className="muted">{t('stationNoNearby')}</p>
        ) : (
          <ul className="station-nearby">
            {nearby.map(({ place, walkMeters }) => (
              <li key={place.id}>
                <span>
                  {(lang === 'ar' ? place.ar || place.en : place.en || place.ar) as string}
                </span>
                <span className="muted">{formatDistance(walkMeters, t, lang)}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="tour-nav station-actions">
          <button type="button" className="primary" onClick={onFrom}>
            {t('stationFrom')}
          </button>
          <button type="button" className="primary" onClick={onTo}>
            {t('stationTo')}
          </button>
          <button type="button" ref={closeRef} onClick={onClose}>
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
}
