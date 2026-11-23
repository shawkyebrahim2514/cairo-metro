import { useRef, type ReactNode } from 'react';
import { useI18n } from '../i18n';

export type Snap = 'peek' | 'half' | 'full';
const order: Snap[] = ['peek', 'half', 'full'];

interface Props {
  snap: Snap;
  onSnap: (s: Snap) => void;
  children: ReactNode;
}

/** Bottom sheet over the map: tap or drag the handle to move between peek, half and full. */
export function Sheet({ snap, onSnap, children }: Props) {
  const { t } = useI18n();
  const startY = useRef<number | null>(null);
  const moved = useRef(false);

  const step = (dir: 1 | -1) => {
    const i = order.indexOf(snap) + dir;
    if (i >= 0 && i < order.length) onSnap(order[i]!);
  };

  return (
    <section className={`sheet ${snap}`} aria-label={t('tripSheet')}>
      <button
        type="button"
        className="sheet-handle"
        aria-label={snap === 'full' ? t('sheetLower') : t('sheetRaise')}
        aria-expanded={snap !== 'peek'}
        onPointerCancel={() => (startY.current = null)}
        onPointerDown={(e) => {
          startY.current = e.clientY;
          moved.current = false;
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerUp={(e) => {
          const y0 = startY.current;
          startY.current = null;
          if (y0 == null) return;
          const dy = e.clientY - y0;
          if (Math.abs(dy) > 30) {
            moved.current = true;
            step(dy < 0 ? 1 : -1);
          }
        }}
        onClick={() => {
          // a plain tap cycles up, and from full goes back to peek
          if (moved.current) return;
          onSnap(snap === 'full' ? 'peek' : snap === 'peek' ? 'half' : 'full');
        }}
      >
        <span />
      </button>
      <div
        className="sheet-body"
        onFocus={() => {
          // typing in a search box needs room for the suggestions
          if (snap === 'peek') onSnap('half');
        }}
      >
        {children}
      </div>
    </section>
  );
}
