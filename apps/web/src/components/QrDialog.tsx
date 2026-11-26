import { useMemo, useRef } from 'react';
import { useModal } from '../useModal';
import { useI18n } from '../i18n';
import { qrMatrix, qrPath } from '../qr';

/** Shows a QR code of a trip link so another phone can open the same route. */
export function QrDialog({ url, onClose }: { url: string; onClose: () => void }) {
  const { t } = useI18n();
  const closeRef = useRef<HTMLButtonElement>(null);
  const modal = useModal(onClose, () => closeRef.current);
  const qr = useMemo(() => {
    const m = qrMatrix(url);
    return m ? qrPath(m) : null;
  }, [url]);

  return (
    <div className="tour-scrim" onClick={onClose}>
      <div
        className="tour qr-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="qr-title"
        ref={modal.ref}
        onKeyDown={modal.onKeyDown}
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        <h2 id="qr-title">{t('qrTitle')}</h2>
        {qr ? (
          <svg
            className="qr"
            viewBox={`0 0 ${qr.size} ${qr.size}`}
            role="img"
            aria-label={t('qrTitle')}
            shapeRendering="crispEdges"
          >
            <rect width={qr.size} height={qr.size} fill="#fff" />
            <path d={qr.d} fill="#000" />
          </svg>
        ) : (
          <p className="note warn">{t('qrTooLong')}</p>
        )}
        <p>{t('qrHint')}</p>
        <div className="tour-nav">
          <button type="button" className="primary" ref={closeRef} onClick={onClose}>
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
}
