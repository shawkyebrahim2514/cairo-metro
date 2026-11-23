import { useEffect, useMemo, useRef, useState } from 'react';
import { searchStations, type Station } from '@cairo-metro/core';
import { Icon } from '../components/Icon';
import { StationSheet } from '../components/StationSheet';
import { lineColour, metro, stationsById, type PlaceResolver } from '../data';
import { type Endpoint } from '../endpoint';
import { stationName, useI18n } from '../i18n';
import { schematic, schematicPath, type SPt } from '../schematic';

interface View {
  cx: number;
  cy: number;
  w: number;
}

const MIN_W = 150;
const BOUNDS = { x: 90, y: 20, w: 840, h: 1580 };
const FONT = 15;

interface Placed {
  x: number;
  y: number;
  anchor: 'start' | 'end' | 'middle';
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Picks a free spot beside each station for its name, skipping dots, lines and earlier names. */
function layoutLabels(names: Map<string, string>, samples: SPt[]): Map<string, Placed> {
  const taken: { x: number; y: number; w: number; h: number }[] = [];
  const hit = (r: { x: number; y: number; w: number; h: number }) =>
    taken.some((q) => r.x < q.x + q.w && r.x + r.w > q.x && r.y < q.y + q.h && r.y + r.h > q.y) ||
    samples.some((p) => p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h);
  for (const p of schematic.positions.values())
    taken.push({ x: p.x - 9, y: p.y - 9, w: 18, h: 18 });

  const out = new Map<string, Placed>();
  const order = [...metro.stations].sort((a, b) => Number(b.interchange) - Number(a.interchange));
  for (const s of order) {
    const p = schematic.positions.get(s.id);
    const text = names.get(s.id);
    if (!p || !text) continue;
    const w = text.length * FONT * 0.55 + 4;
    const h = FONT + 2;
    const tries: [number, number, Placed['anchor']][] = [
      [p.x + 14, p.y, 'start'],
      [p.x - 14, p.y, 'end'],
      [p.x, p.y - 16, 'middle'],
      [p.x, p.y + 16 + FONT * 0.6, 'middle'],
      [p.x + 12, p.y - 12, 'start'],
      [p.x + 12, p.y + 22, 'start'],
      [p.x - 12, p.y - 12, 'end'],
      [p.x - 12, p.y + 22, 'end'],
    ];
    for (const [x, y, anchor] of tries) {
      const left = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
      const rect = { x: left, y: y - FONT * 0.8, w, h };
      if (!hit(rect)) {
        taken.push(rect);
        out.set(s.id, { x, y: y + FONT * 0.35, anchor });
        break;
      }
    }
    // Interchanges are always named, even when every spot is crowded.
    if (s.interchange && !out.has(s.id))
      out.set(s.id, { x: p.x + 14, y: p.y - 14, anchor: 'start' });
  }
  return out;
}

/** The whole network as a pan-and-zoom line diagram with station search. */
export function DiagramPage({
  resolver,
  onPlan,
}: {
  resolver: PlaceResolver | null;
  onPlan: (preset: { from?: Endpoint; to?: Endpoint }) => void;
}) {
  const { t, lang } = useI18n();
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 360, h: 520 });
  const [view, setView] = useState<View>({ cx: 460, cy: 680, w: 440 });
  const [selected, setSelected] = useState<Station | null>(null);
  const [open, setOpen] = useState<Station | null>(null);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const moved = useRef(false);
  const pinch = useRef(0);
  const downAt = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const paths = useMemo(
    () =>
      metro.lines.flatMap((line) =>
        line.branches.map((b) => ({
          key: b.id,
          colour: lineColour.get(line.id) ?? '#888',
          pts: schematicPath(b.stations),
        })),
      ),
    [],
  );

  const labels = useMemo(() => {
    const samples: SPt[] = [];
    for (const { pts } of paths) {
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1]!;
        const b = pts[i]!;
        const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 6));
        for (let k = 0; k <= n; k++) {
          samples.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
        }
      }
    }
    const names = new Map(metro.stations.map((s) => [s.id, stationName(s, lang)]));
    return layoutLabels(names, samples);
  }, [paths, lang]);

  const matches = useMemo(
    () => (query.trim() ? searchStations(metro.stations, query, 6).map((m) => m.station) : []),
    [query],
  );

  const h = view.w * (size.h / size.w);
  const vx = view.cx - view.w / 2;
  const vy = view.cy - h / 2;
  const toWorld = (clientX: number, clientY: number) => {
    const r = box.current!.getBoundingClientRect();
    return {
      x: vx + ((clientX - r.left) / r.width) * view.w,
      y: vy + ((clientY - r.top) / r.height) * h,
    };
  };
  const zoomAt = (factor: number, at?: SPt) =>
    setView((v) => {
      const w = clamp(v.w * factor, MIN_W, BOUNDS.w * 1.4);
      const k = w / v.w;
      const p = at ?? { x: v.cx, y: v.cy };
      return { w, cx: p.x + (v.cx - p.x) * k, cy: p.y + (v.cy - p.y) * k };
    });
  const fit = () => {
    const scale = Math.min(size.w / BOUNDS.w, size.h / BOUNDS.h);
    setView({ cx: BOUNDS.x + BOUNDS.w / 2, cy: BOUNDS.y + BOUNDS.h / 2, w: size.w / scale });
  };
  const focusOn = (s: Station) => {
    const p = schematic.positions.get(s.id);
    if (p) setView((v) => ({ ...v, cx: p.x, cy: p.y, w: Math.min(v.w, 380) }));
    setSelected(s);
    setOpen(s);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    downAt.current = { x: e.clientX, y: e.clientY };
    moved.current = false;
    pinch.current = 0;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    if (e.pointerType === 'mouse' && e.buttons === 0) {
      // the button was released outside the svg
      pointers.current.delete(e.pointerId);
      pinch.current = 0;
      return;
    }
    const cur = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, cur);
    const pts = [...pointers.current.values()];
    if (pts.length >= 2) {
      const d = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
      if (pinch.current) {
        const mid = toWorld((pts[0]!.x + pts[1]!.x) / 2, (pts[0]!.y + pts[1]!.y) / 2);
        zoomAt(pinch.current / d, mid);
      }
      pinch.current = d;
      moved.current = true;
      return;
    }
    const dx = cur.x - prev.x;
    const dy = cur.y - prev.y;
    if (!moved.current && Math.hypot(cur.x - downAt.current.x, cur.y - downAt.current.y) < 4)
      return;
    moved.current = true;
    const k = view.w / size.w;
    setView((v) => ({ ...v, cx: v.cx - dx * k, cy: v.cy - dy * k }));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    pinch.current = 0;
  };
  const onWheel = (e: React.WheelEvent) =>
    zoomAt(e.deltaY > 0 ? 1.15 : 1 / 1.15, toWorld(e.clientX, e.clientY));

  const tap = (s: Station) => {
    if (moved.current) return;
    setSelected(s);
    setOpen(s);
  };

  const zoomed = view.w < 520;

  return (
    <div className="diagram-page">
      <div className="diagram-search">
        <Icon name="search" size={18} />
        <input
          type="search"
          value={query}
          placeholder={t('diagramSearch')}
          aria-label={t('diagramSearch')}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
        />
        {focused && query.trim() && (
          <ul className="diagram-suggest" role="listbox">
            {matches.length === 0 && <li className="muted">{t('diagramNoMatch')}</li>}
            {matches.map((s) => (
              <li key={s.id} role="option" aria-selected={false}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    focusOn(s);
                    setQuery('');
                  }}
                >
                  {[...new Set(s.lines.map((l) => l.line))].map((l) => (
                    <i key={l} className="dot" style={{ background: lineColour.get(l) }} />
                  ))}
                  {stationName(s, lang)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="diagram-box" ref={box}>
        <svg
          role="group"
          aria-label={t('diagramMap')}
          direction="ltr"
          viewBox={`${vx} ${vy} ${view.w} ${h}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
        >
          {paths.map((p) => (
            <polyline
              key={p.key}
              points={p.pts.map((q) => `${q.x},${q.y}`).join(' ')}
              fill="none"
              stroke={p.colour}
              strokeWidth={9}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {metro.stations.map((s) => {
            const p = schematic.positions.get(s.id);
            if (!p) return null;
            const label = labels.get(s.id);
            const showLabel = (label && zoomed) || selected?.id === s.id;
            const lab =
              label ?? ({ x: p.x + 14, y: p.y + FONT * 0.35, anchor: 'start' } satisfies Placed);
            return (
              <g
                key={s.id}
                className={selected?.id === s.id ? 'dg-station sel' : 'dg-station'}
                role="button"
                tabIndex={0}
                aria-label={stationName(s, lang)}
                onClick={() => tap(s)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    focusOn(s);
                  }
                }}
              >
                <circle cx={p.x} cy={p.y} r={16} fill="transparent" />
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={s.interchange ? 9 : 5.5}
                  className={s.interchange ? 'dg-dot x' : 'dg-dot'}
                  stroke={s.interchange ? undefined : lineColour.get(s.lines[0]!.line)}
                />
                {showLabel && (
                  <text x={lab.x} y={lab.y} textAnchor={lab.anchor} fontSize={FONT}>
                    {stationName(s, lang)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        <div className="diagram-zoom">
          <button type="button" aria-label={t('diagramZoomIn')} onClick={() => zoomAt(1 / 1.4)}>
            +
          </button>
          <button type="button" aria-label={t('diagramZoomOut')} onClick={() => zoomAt(1.4)}>
            −
          </button>
          <button type="button" aria-label={t('diagramFit')} onClick={fit}>
            <Icon name="route" size={18} />
          </button>
        </div>
      </div>

      {open && (
        <StationSheet
          station={stationsById.get(open.id)!}
          resolver={resolver}
          onFrom={() => onPlan({ from: { kind: 'station', station: open } })}
          onTo={() => onPlan({ to: { kind: 'station', station: open } })}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}
