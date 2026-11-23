import type { Station } from '@cairo-metro/core';
import { lineColour, stationsById } from './data';
import { endpointName, endpointPoint, type Endpoint } from './endpoint';
import { formatMinutes, localDigits, stationName, type I18n, type Lang } from './i18n';
import type { Trip } from './trip';

interface Options {
  trip: Trip;
  from: Endpoint;
  to: Endpoint;
  lang: Lang;
  t: I18n['t'];
}

const W = 1080;
const M = 60;
const FONT = '"Segoe UI", system-ui, Tahoma, Arial, sans-serif';

type Rect = { x: number; y: number; w: number; h: number };
const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const lineNo = (line: string) => line.replace(/\D/g, '');

/** Draws a shareable PNG of the planned trip: summary, a route diagram and the steps. */
export async function renderTripImage({ trip, from, to, lang, t }: Options): Promise<Blob> {
  const { route } = trip;
  const rtl = lang === 'ar';
  const n = (v: number | string) => localDigits(v, lang);
  const name = (id: string) => stationName(stationsById.get(id)!, lang);

  const rows = route.legs.length * 2 - 1 + (trip.walkIn ? 1 : 0) + (trip.walkOut ? 1 : 0);
  const stepsH = rows * 78;
  const H = 1000 + stepsH + 150;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.direction = rtl ? 'rtl' : 'ltr';

  const text = (
    s: string,
    x: number,
    y: number,
    o: { size: number; weight?: number; color?: string; align?: 'start' | 'end' | 'center' },
  ) => {
    ctx.font = `${o.weight ?? 400} ${o.size}px ${FONT}`;
    ctx.fillStyle = o.color ?? '#0f172a';
    const align = o.align ?? 'start';
    ctx.textAlign = align === 'center' ? 'center' : (align === 'start') !== rtl ? 'left' : 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(s, x, y);
  };
  const edgeStart = rtl ? W - M : M;
  const edgeEnd = rtl ? M : W - M;
  const fit = (s: string, max: number, size: number, weight = 700) => {
    ctx.font = `${weight} ${size}px ${FONT}`;
    if (ctx.measureText(s).width <= max) return s;
    let cut = s;
    while (cut.length > 3 && ctx.measureText(cut + '…').width > max) cut = cut.slice(0, -1);
    return cut + '…';
  };
  const round = (x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  };

  // Background and header.
  ctx.fillStyle = '#eef1f6';
  ctx.fillRect(0, 0, W, H);
  const grad = ctx.createLinearGradient(0, 0, W, 320);
  grad.addColorStop(0, '#0f766e');
  grad.addColorStop(1, '#1d4ed8');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, 330);
  text(t('appName'), edgeStart, 90, { size: 34, weight: 700, color: 'rgba(255,255,255,0.85)' });
  text(fit(endpointName(from, lang), W - 2 * M, 54), edgeStart, 170, {
    size: 54,
    weight: 800,
    color: '#fff',
  });
  text('↓', edgeStart, 218, { size: 38, weight: 700, color: 'rgba(255,255,255,0.8)' });
  text(fit(endpointName(to, lang), W - 2 * M, 54), edgeStart, 288, {
    size: 54,
    weight: 800,
    color: '#fff',
  });

  // Stat tiles.
  const nt = route.transfers.length;
  const stats: [string, string][] = [
    [formatMinutes(trip.totalSec, t, lang), t('tripTime')],
    [n(route.stops + 1), t('sharedStations')],
    [nt === 0 ? t('direct') : n(nt), nt === 0 ? t('noChanges') : t('transfers')],
    [route.fare != null ? n(route.fare) : '-', t('fare')],
  ];
  const tileW = (W - 2 * M - 3 * 16) / 4;
  stats.forEach(([big, small], i) => {
    const x = rtl ? W - M - tileW - i * (tileW + 16) : M + i * (tileW + 16);
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(15,23,42,0.12)';
    ctx.shadowBlur = 18;
    round(x, 350, tileW, 150, 24);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    text(fit(big, tileW - 16, 40, 800), x + tileW / 2, 425, {
      size: 40,
      weight: 800,
      color: '#0f766e',
      align: 'center',
    });
    text(fit(small, tileW - 16, 24, 500), x + tileW / 2, 470, {
      size: 24,
      weight: 500,
      color: '#526071',
      align: 'center',
    });
  });

  // Route diagram.
  const box = { x: M, y: 540, w: W - 2 * M, h: 420 };
  ctx.fillStyle = '#fff';
  round(box.x, box.y, box.w, box.h, 28);
  ctx.fill();

  const ids = route.stations;
  const pts = ids.map((id) => {
    const s = stationsById.get(id) as Station;
    return { id, lat: s.lat, lng: s.lng };
  });
  const ends = [endpointPoint(from), endpointPoint(to)];
  const all = [...pts, ...ends];
  const k = Math.cos(((pts[0]!.lat + pts[pts.length - 1]!.lat) / 2) * (Math.PI / 180));
  const xs = all.map((p) => p.lng * k);
  const ys = all.map((p) => -p.lat);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const pad = 70;
  const scale = Math.min(
    (box.w - 2 * pad) / Math.max(maxX - minX, 1e-9),
    (box.h - 2 * pad) / Math.max(maxY - minY, 1e-9),
  );
  const offX = box.x + (box.w - (maxX - minX) * scale) / 2;
  const offY = box.y + (box.h - (maxY - minY) * scale) / 2;
  const proj = (lat: number, lng: number) => ({
    x: offX + (lng * k - minX) * scale,
    y: offY + (-lat - minY) * scale,
  });

  const stroke = (
    a: { x: number; y: number }[],
    colour: string,
    width: number,
    dash?: number[],
  ) => {
    ctx.beginPath();
    a.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash(dash ?? []);
    ctx.stroke();
    ctx.setLineDash([]);
  };

  const first = proj(pts[0]!.lat, pts[0]!.lng);
  const last = proj(pts[pts.length - 1]!.lat, pts[pts.length - 1]!.lng);
  const fromP = proj(ends[0]!.lat, ends[0]!.lng);
  const toP = proj(ends[1]!.lat, ends[1]!.lng);
  if (from.kind === 'point') stroke([fromP, first], '#94a3b8', 6, [4, 14]);
  if (to.kind === 'point') stroke([last, toP], '#94a3b8', 6, [4, 14]);

  for (const leg of route.legs) {
    const line = leg.stations.map((id) => {
      const s = stationsById.get(id)!;
      return proj(s.lat, s.lng);
    });
    stroke(line, '#fff', 20);
    stroke(line, lineColour.get(leg.line) ?? '#2563eb', 12);
  }
  for (const p of pts) {
    const { x, y } = proj(p.lat, p.lng);
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
  }

  const dot = (p: { x: number; y: number }, colour: string, r: number) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = colour;
    ctx.stroke();
  };
  // Labels avoid the stations (and so the line) already drawn.
  const placed: Rect[] = pts.map((q) => {
    const { x, y } = proj(q.lat, q.lng);
    return { x: x - 14, y: y - 14, w: 28, h: 28 };
  });
  const label = (s: string, p: { x: number; y: number }, bold: boolean) => {
    ctx.font = `${bold ? 800 : 600} 26px ${FONT}`;
    const w = Math.min(ctx.measureText(s).width, 300);
    const h = 30;
    const tries: [number, number][] = [
      [32, 9],
      [-32 - w, 9],
      [-w / 2, -26],
      [-w / 2, 44],
      [32, -26],
      [-32 - w, -26],
    ];
    for (const [dx, dy] of tries) {
      const r = { x: p.x + dx, y: p.y + dy - h, w, h: h + 4 };
      const inside = r.x >= box.x + 8 && r.x + r.w <= box.x + box.w - 8;
      if (inside && !placed.some((q) => overlaps(q, r))) {
        placed.push(r);
        ctx.textAlign = 'left';
        ctx.direction = rtl ? 'rtl' : 'ltr';
        ctx.fillStyle = '#0f172a';
        ctx.fillText(fit(s, 300, 26, bold ? 800 : 600), r.x, r.y + h - 4);
        return;
      }
    }
  };

  dot(first, lineColour.get(route.legs[0]!.line) ?? '#2563eb', 15);
  for (const tr of route.transfers) {
    const s = stationsById.get(tr.stationId)!;
    dot(proj(s.lat, s.lng), '#f59e0b', 13);
  }
  const lastLine = route.legs[route.legs.length - 1]!.line;
  dot(last, lineColour.get(lastLine) ?? '#2563eb', 15);
  label(name(route.from), first, true);
  label(name(route.to), last, true);
  for (const tr of route.transfers) {
    const s = stationsById.get(tr.stationId)!;
    label(name(tr.stationId), proj(s.lat, s.lng), false);
  }
  if (from.kind === 'point') dot(fromP, '#0f766e', 11);
  if (to.kind === 'point') dot(toP, '#2563eb', 11);

  // Steps.
  let y = box.y + box.h + 60;
  const pill = (s: string, colour: string, x: number, yy: number) => {
    ctx.font = `700 28px ${FONT}`;
    const w = ctx.measureText(s).width + 36;
    const px = rtl ? x - w : x;
    ctx.fillStyle = colour;
    round(px, yy - 34, w, 46, 23);
    ctx.fill();
    text(s, px + w / 2, yy, { size: 28, weight: 700, color: '#fff', align: 'center' });
    return w;
  };
  const stepLine = (lead: string | null, colour: string | null, body: string) => {
    let x = edgeStart;
    if (lead && colour) {
      const w = pill(lead, colour, x, y);
      x += (rtl ? -1 : 1) * (w + 16);
    }
    const max = W - 2 * M - (lead ? 190 : 0);
    text(fit(body, max, 28, 600), x, y, { size: 28, weight: 600, color: '#1e293b' });
    y += 78;
  };

  if (trip.walkIn) stepLine(null, null, `${t('walkToStation')} ${name(trip.walkIn.station.id)}`);
  route.legs.forEach((leg, i) => {
    const colour = lineColour.get(leg.line) ?? '#2563eb';
    stepLine(
      `${t('line')} ${n(lineNo(leg.line))}`,
      colour,
      `${t('towards')} ${leg.towards.map(name).join(' / ')} · ${n(leg.stops)} ${
        leg.stops === 1 ? t('stop') : t('stops')
      }`,
    );
    const tr = route.transfers[i];
    if (tr) {
      stepLine(
        '⇄',
        '#f59e0b',
        `${name(tr.stationId)} · ${n(Math.max(1, Math.round(tr.sec / 60)))} ${t('min')}`,
      );
    }
  });
  if (trip.walkOut)
    stepLine(null, null, `${t('walkFromStation')} ${name(trip.walkOut.station.id)}`);

  // Footer.
  ctx.fillStyle = '#d7dee9';
  ctx.fillRect(M, H - 110, W - 2 * M, 2);
  text('shawkyebrahim2514.github.io/cairo-metro', edgeStart, H - 56, {
    size: 26,
    weight: 600,
    color: '#0f766e',
  });
  text(
    new Date().toLocaleDateString(rtl ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short' }),
    edgeEnd,
    H - 56,
    { size: 24, color: '#526071', align: 'end' },
  );

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'),
  );
}
