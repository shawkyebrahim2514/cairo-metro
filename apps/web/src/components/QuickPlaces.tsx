import { useState } from 'react';
import { endpointName, type Endpoint } from '../endpoint';
import { useI18n } from '../i18n';
import { loadPlace, savePlace, type PlaceSlot } from '../storage';
import { Icon } from './Icon';

interface Props {
  /** The endpoint a new Home or Work would be saved from (the picked From, else To). */
  candidate: Endpoint | null;
  onPick: (e: Endpoint) => void;
}

const SLOTS: PlaceSlot[] = ['home', 'work'];

/** One-tap Home and Work shortcuts that fill the next empty box. */
export function QuickPlaces({ candidate, onPick }: Props) {
  const { t, lang } = useI18n();
  const [places, setPlaces] = useState<Record<PlaceSlot, Endpoint | null>>(() => ({
    home: loadPlace('home'),
    work: loadPlace('work'),
  }));

  const update = (slot: PlaceSlot, e: Endpoint | null) => {
    savePlace(slot, e);
    setPlaces((p) => ({ ...p, [slot]: e }));
  };

  return (
    <div className="quick" role="group" aria-label={`${t('home')} / ${t('work')}`}>
      {SLOTS.map((slot) => {
        const place = places[slot];
        const label = t(slot);
        if (!place) {
          const setLabel = t(slot === 'home' ? 'setHome' : 'setWork');
          return (
            <button
              key={slot}
              type="button"
              className="quick-chip empty"
              disabled={!candidate}
              title={candidate ? undefined : t('placeHint')}
              onClick={() => candidate && update(slot, candidate)}
            >
              <Icon name={slot === 'home' ? 'home' : 'work'} size={16} /> + {setLabel}
            </button>
          );
        }
        return (
          <span key={slot} className="quick-chip set">
            <button
              type="button"
              className="quick-go"
              onClick={() => onPick(place)}
              title={endpointName(place, lang)}
            >
              <Icon name={slot === 'home' ? 'home' : 'work'} size={16} />
              <b>{label}</b>
              <span>{endpointName(place, lang)}</span>
            </button>
            <button
              type="button"
              className="quick-x"
              aria-label={`${t('removePlace')} ${label}`}
              onClick={() => update(slot, null)}
            >
              <Icon name="close" size={14} />
            </button>
          </span>
        );
      })}
    </div>
  );
}
