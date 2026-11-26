import { useRef, useState } from 'react';
import { useModal } from '../useModal';
import { localDigits, useI18n, type Key } from '../i18n';

const STEPS: { title: Key; body: Key }[] = [
  { title: 'tour1Title', body: 'tour1Body' },
  { title: 'tour2Title', body: 'tour2Body' },
  { title: 'tour3Title', body: 'tour3Body' },
  { title: 'tour4Title', body: 'tour4Body' },
];

export function Tour({ onClose }: { onClose: () => void }) {
  const { t, lang } = useI18n();
  const [step, setStep] = useState(0);
  const nextRef = useRef<HTMLButtonElement>(null);
  const last = step === STEPS.length - 1;
  const s = STEPS[step]!;

  const modal = useModal(onClose, () => nextRef.current);

  return (
    <div className="tour-scrim" onClick={onClose}>
      <div
        className="tour"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        ref={modal.ref}
        onKeyDown={modal.onKeyDown}
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        <h2 id="tour-title">{t(s.title)}</h2>
        <p aria-live="polite">{t(s.body)}</p>
        <div className="tour-nav">
          <button type="button" className="link" onClick={onClose}>
            {t('tourSkip')}
          </button>
          <small>
            {localDigits(step + 1, lang)} {t('tourStep')} {localDigits(STEPS.length, lang)}
          </small>
          <button
            type="button"
            className="primary"
            ref={nextRef}
            onClick={() => (last ? onClose() : setStep(step + 1))}
          >
            {last ? t('tourDone') : t('tourNext')}
          </button>
        </div>
      </div>
    </div>
  );
}
