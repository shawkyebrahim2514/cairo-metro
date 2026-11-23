import type { LineId, NearbyPlace, Station } from '@cairo-metro/core';
import { lineColour, metro, stationsById } from './data';
import { schematic, schematicPath, type SPt } from './schematic';
import { endpointName, endpointPoint, type Endpoint } from './endpoint';
import { formatMinutes, localDigits, stationName, type I18n, type Lang } from './i18n';
import { qrMatrix, qrPath } from './qr';
import type { Trip } from './trip';

export type ImageStyle = 'route' | 'network' | 'schematic';
export type ImageCrop = 'trip' | 'network';
export type ImageTheme = 'app' | 'light' | 'dark';
export type ImageFormat = 'portrait' | 'square' | 'story';
export type ImageColour = 'lines' | 'accent';

export interface ImageOptions {
  /** "route" draws only the trip; "network" draws every line faded behind it. */
  style: ImageStyle;
  /** Network style only: zoom to the trip or show the whole network. */
  crop: ImageCrop;
  theme: ImageTheme;
  lang: Lang;
  format: ImageFormat;
  colour: ImageColour;
  routeNames: boolean;
  otherNames: boolean;
  walking: boolean;
  places: boolean;
  stats: boolean;
  fare: boolean;
  eta: boolean;
  steps: boolean;
  /** List every station under the map (long trips only). */
  list: boolean;
  /** Turn the map so a diagonal trip fills the picture (trip crop only). */
  rotate: boolean;
  women: boolean;
  qr: boolean;
  branding: boolean;
}

export const DEFAULT_IMAGE_OPTIONS: ImageOptions = {
  style: 'network',
  crop: 'trip',
  theme: 'app',
  lang: 'en',
  format: 'portrait',
  colour: 'lines',
  routeNames: true,
  otherNames: false,
  walking: true,
  places: false,
  stats: true,
  fare: true,
  eta: true,
  steps: true,
  list: true,
  rotate: true,
  women: false,
  qr: false,
  branding: true,
};

interface Input {
  trip: Trip;
  from: Endpoint;
  to: Endpoint;
  options: ImageOptions;
  t: I18n['t'];
  /** Light/dark chosen in the app, used when the image theme is "app". */
  appTheme: 'light' | 'dark';
  /** The app's highlight colour, used when the route colour is "accent". */
  accent: string;
  clock: (d: Date) => string;
  nearby?: NearbyPlace[];
  url?: string;
}

const W = 1080;
const M = 60;
const FONT = '"Segoe UI", system-ui, Tahoma, Arial, sans-serif';
const HEADER_H = 330;
const MIN_MAP_H = 380;
const FORMAT_H: Record<ImageFormat, number> = { portrait: 0, square: 1080, story: 1920 };

const PALETTE = {
  light: {
    bg: '#eef1f6',
    card: '#fff',
    text: '#0f172a',
    body: '#1e293b',
    muted: '#526071',
    rule: '#d7dee9',
    mapBg: '#f8fafc',
    fade: 0.3,
    teal: '#0f766e',
  },
  dark: {
    bg: '#0b1220',
    card: '#131c2e',
    text: '#f1f5f9',
    body: '#e2e8f0',
    muted: '#9fb0c6',
    rule: '#26334a',
    mapBg: '#0f1829',
    fade: 0.45,
    teal: '#2dd4bf',
  },
} as const;

type Rect = { x: number; y: number; w: number; h: number };
type Pt = { x: number; y: number };
const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const lineNo = (line: string) => line.replace(/\D/g, '');
const COS_CAIRO = Math.cos(30.05 * (Math.PI / 180));

/** Smallest map span shown, so a very short trip is not zoomed in absurdly. */
const MIN_SPAN = 0.012;

/** From this many stations a trip counts as long: taller map, every-station list. */
const LONG_TRIP = 14;
const MIN_LONG_MAP_H = 620;

type Pair = { x: number; y: number };

/** Points in the flat map frame (x east, y south), turned by `theta`. */
function frame(points: { lat: number; lng: number }[], theta: number) {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const pts = points.map((p) => {
    const x = p.lng * COS_CAIRO;
    const y = -p.lat;
    return { x: x * c - y * s, y: x * s + y * c };
  });
  const grow = (lo: number, hi: number) => {
    const extra = Math.max(0, MIN_SPAN - (hi - lo)) / 2;
    return [lo - extra, hi + extra] as const;
  };
  const [minX, maxX] = grow(Math.min(...pts.map((p) => p.x)), Math.max(...pts.map((p) => p.x)));
  const [minY, maxY] = grow(Math.min(...pts.map((p) => p.y)), Math.max(...pts.map((p) => p.y)));
  return { pts, minX, maxX, minY, maxY };
}

/** The turn that lays the trip's main direction along the vertical (or horizontal) axis, start first. */
function bestTurn(points: { lat: number; lng: number }[], vertical: boolean): number {
  const base: Pair[] = points.map((p) => ({ x: p.lng * COS_CAIRO, y: -p.lat }));
  const mx = base.reduce((a, p) => a + p.x, 0) / base.length;
  const my = base.reduce((a, p) => a + p.y, 0) / base.length;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const p of base) {
    sxx += (p.x - mx) ** 2;
    syy += (p.y - my) ** 2;
    sxy += (p.x - mx) * (p.y - my);
  }
  const phi = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  let theta = (vertical ? Math.PI / 2 : 0) - phi;
  const { pts } = frame(points, theta);
  const a = pts[0]!;
  const b = pts[pts.length - 1]!;
  // start at the top (or the left)
  if (vertical ? a.y > b.y : a.x > b.x) theta += Math.PI;
  return theta;
}

/** Height over width of the trip once its main direction is laid along the vertical. */
export function tripAspect(points: { lat: number; lng: number }[], rotate: boolean): number {
  const f = frame(points, rotate && points.length > 2 ? bestTurn(points, true) : 0);
  return (f.maxY - f.minY) / (f.maxX - f.minX);
}

/**
 * Maps lat/lng points into a box (equirectangular, centred, uniform scale). With `rotate`, the map
 * is turned so the trip fills the box better; the turn (radians) is exposed as `angle`.
 */
export function fitView(
  points: { lat: number; lng: number }[],
  box: Rect,
  pad: number,
  rotate = false,
) {
  const fitFor = (theta: number) => {
    const f = frame(points, theta);
    const scale = Math.min(
      (box.w - 2 * pad) / (f.maxX - f.minX),
      (box.h - 2 * pad) / (f.maxY - f.minY),
    );
    return { ...f, scale, theta };
  };
  let best = fitFor(0);
  if (rotate && points.length > 2) {
    const turned = fitFor(bestTurn(points, box.h > box.w));
    // only turn the map when it clearly helps
    if (turned.scale > best.scale * 1.15) best = turned;
  }
  const { minX, maxX, minY, maxY, scale, theta } = best;
  const offX = box.x + (box.w - (maxX - minX) * scale) / 2;
  const offY = box.y + (box.h - (maxY - minY) * scale) / 2;
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const project = (lat: number, lng: number): Pt => {
    const x = lng * COS_CAIRO;
    const y = -lat;
    return {
      x: offX + (x * c - y * s - minX) * scale,
      y: offY + (x * s + y * c - minY) * scale,
    };
  };
  return Object.assign(project, { angle: theta });
}

/** Draws a shareable PNG of the planned trip, shaped by the chosen options. */
export async function renderTripImage(input: Input): Promise<Blob> {
  const { trip, from, to, options: o, t, clock } = input;
  const { route } = trip;
  const lang = o.lang;
  const rtl = lang === 'ar';
  const pal = PALETTE[o.theme === 'app' ? input.appTheme : o.theme];
  const dark = pal === PALETTE.dark;
  const n = (v: number | string) => localDigits(v, lang);
  const name = (id: string) => stationName(stationsById.get(id)!, lang);
  const legColour = (line: LineId) =>
    o.colour === 'accent' ? input.accent : (lineColour.get(line) ?? '#2563eb');

  const ids = route.stations;
  const pts = ids.map((id) => stationsById.get(id) as Station);
  const schem = o.style === 'schematic';
  const ends = schem ? [pts[0]!, pts[pts.length - 1]!] : [endpointPoint(from), endpointPoint(to)];
  const network = o.style !== 'route';
  const wholeNetwork = network && o.crop === 'network';
  // The diagram is mapped onto pseudo coordinates so the same projection serves both styles.
  const geo = (p: SPt) => ({ lat: -p.y / 10000, lng: p.x / (10000 * COS_CAIRO) });
  const at = (s: { id: string; lat: number; lng: number }) =>
    schem ? geo(schematic.positions.get(s.id)!) : s;
  const focus = [...pts.map(at), ...(schem ? [] : ends)];
  const everything = [...metro.stations.map(at), ...(schem ? [] : ends)];
  const rotating = o.rotate && !schem && !wholeNetwork;
  const long = ids.length >= LONG_TRIP;

  // Vertical layout. A long trip gets a taller map and a list of every station.
  const rows = route.legs.length * 2 - 1 + (trip.walkIn ? 1 : 0) + (trip.walkOut ? 1 : 0);
  const top = HEADER_H + (o.stats ? 190 : 30);
  const tail = (o.women ? 70 : 0) + (o.qr ? 230 : o.branding ? 120 : 40);
  const listOn = o.list && long;
  const mapPad = wholeNetwork ? 40 : 90;
  let rowH = 78;
  let stepsH = 0;
  let listH = 0;
  let listCols = 2;
  let listRowH = 40;
  const listHeight = (cols: number, rh: number) => Math.ceil(ids.length / cols) * rh + 70;
  let mapH = 520;
  if (long && !wholeNetwork) {
    const ratio = tripAspect(focus, rotating);
    mapH = Math.min(1400, Math.max(520, Math.round((W - 2 * M - 2 * mapPad) * ratio) + 2 * mapPad));
  }
  let H = FORMAT_H[o.format];
  if (H === 0) {
    stepsH = o.steps ? rows * rowH + 40 : 0;
    if (listOn) listH = listHeight(listCols, listRowH);
    H = top + mapH + 30 + stepsH + listH + tail;
  } else {
    const avail = H - top - 30 - tail;
    const minMap = long ? MIN_LONG_MAP_H : MIN_MAP_H;
    if (listOn) {
      for (const [cols, rh] of [
        [2, 40],
        [3, 36],
        [3, 30],
      ] as const) {
        if (avail - listHeight(cols, rh) >= minMap) {
          listCols = cols;
          listRowH = rh;
          listH = listHeight(cols, rh);
          break;
        }
      }
    }
    if (o.steps && !long) {
      const room = avail - listH - minMap;
      if (rows * rowH + 40 <= room) stepsH = rows * rowH + 40;
      else {
        rowH = Math.floor((room - 40) / rows);
        stepsH = rowH >= 52 ? rows * rowH + 40 : 0;
      }
    }
    mapH = avail - stepsH - listH;
  }

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.direction = rtl ? 'rtl' : 'ltr';

  const text = (
    s: string,
    x: number,
    y: number,
    f: { size: number; weight?: number; color?: string; align?: 'start' | 'end' | 'center' },
  ) => {
    ctx.font = `${f.weight ?? 400} ${f.size}px ${FONT}`;
    ctx.fillStyle = f.color ?? pal.text;
    const align = f.align ?? 'start';
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
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, W, H);
  const grad = ctx.createLinearGradient(0, 0, W, 320);
  grad.addColorStop(0, '#0f766e');
  grad.addColorStop(1, '#1d4ed8');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, HEADER_H);
  if (o.branding) {
    text(t('appName'), edgeStart, 90, { size: 34, weight: 700, color: 'rgba(255,255,255,0.85)' });
  }
  if (o.eta) {
    const now = new Date();
    const arrive = new Date(now.getTime() + trip.totalSec * 1000);
    text(`${n(clock(now))} → ${n(clock(arrive))}`, edgeEnd, 90, {
      size: 32,
      weight: 700,
      color: 'rgba(255,255,255,0.9)',
      align: 'end',
    });
  }
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
  if (o.stats) {
    const nt = route.transfers.length;
    const stats: [string, string][] = [
      [formatMinutes(trip.totalSec, t, lang), t('tripTime')],
      [n(route.stops + 1), t('sharedStations')],
      [nt === 0 ? t('direct') : n(nt), nt === 0 ? t('noChanges') : t('transfers')],
    ];
    if (o.fare) stats.push([route.fare != null ? n(route.fare) : '-', t('fare')]);
    const gap = 16;
    const tileW = (W - 2 * M - (stats.length - 1) * gap) / stats.length;
    stats.forEach(([big, small], i) => {
      const x = rtl ? W - M - tileW - i * (tileW + gap) : M + i * (tileW + gap);
      ctx.fillStyle = pal.card;
      ctx.shadowColor = dark ? 'transparent' : 'rgba(15,23,42,0.12)';
      ctx.shadowBlur = 18;
      round(x, HEADER_H + 20, tileW, 150, 24);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      text(fit(big, tileW - 16, 40, 800), x + tileW / 2, HEADER_H + 95, {
        size: 40,
        weight: 800,
        color: pal.teal,
        align: 'center',
      });
      text(fit(small, tileW - 16, 24, 500), x + tileW / 2, HEADER_H + 140, {
        size: 24,
        weight: 500,
        color: pal.muted,
        align: 'center',
      });
    });
  }

  // Map.
  const box: Rect = { x: M, y: top, w: W - 2 * M, h: mapH };
  ctx.fillStyle = pal.card;
  round(box.x, box.y, box.w, box.h, 28);
  ctx.fill();
  ctx.save();
  round(box.x, box.y, box.w, box.h, 28);
  ctx.clip();
  ctx.fillStyle = pal.mapBg;
  ctx.fillRect(box.x, box.y, box.w, box.h);

  const proj = fitView(wholeNetwork ? everything : focus, box, mapPad, rotating);
  const turn = (proj as unknown as { angle: number }).angle;
  const P = (s: { id: string; lat: number; lng: number }) => {
    const g = at(s);
    return proj(g.lat, g.lng);
  };
  const pathOf = (ids2: string[]): Pt[] =>
    schem
      ? schematicPath(ids2).map((q) => {
          const g = geo(q);
          return proj(g.lat, g.lng);
        })
      : ids2.map((id) => P(stationsById.get(id)!));

  const stroke = (a: Pt[], colour: string, width: number, dash?: number[]) => {
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
  const dot = (p: Pt, colour: string, r: number, ring = 8) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.lineWidth = ring;
    ctx.strokeStyle = colour;
    ctx.stroke();
  };
  const small = wholeNetwork;

  // Faded network behind the route.
  if (network) {
    ctx.globalAlpha = pal.fade;
    for (const line of metro.lines) {
      for (const branch of line.branches) {
        const pl = pathOf(branch.stations);
        stroke(pl, lineColour.get(line.id) ?? '#888', small ? 5 : 9);
      }
    }
    ctx.globalAlpha = Math.min(1, pal.fade + 0.3);
    for (const s of metro.stations) {
      const p = P(s);
      ctx.beginPath();
      ctx.arc(p.x, p.y, small ? 3.5 : 6, 0, Math.PI * 2);
      ctx.fillStyle = pal.card;
      ctx.fill();
      ctx.lineWidth = small ? 2 : 3;
      ctx.strokeStyle = s.interchange ? pal.text : (lineColour.get(s.lines[0]!.line) ?? '#888');
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // Walking legs and pins.
  const first = P(pts[0]!);
  const last = P(pts[pts.length - 1]!);
  const fromP = schem ? first : proj(ends[0]!.lat, ends[0]!.lng);
  const toP = schem ? last : proj(ends[1]!.lat, ends[1]!.lng);
  if (o.walking && !schem) {
    if (from.kind === 'point') stroke([fromP, first], dark ? '#cbd5e1' : '#64748b', 6, [4, 14]);
    if (to.kind === 'point') stroke([last, toP], dark ? '#cbd5e1' : '#64748b', 6, [4, 14]);
  }

  // The route: glow, halo, then the line colour.
  for (const leg of route.legs) {
    const pl = pathOf(leg.stations);
    const colour = legColour(leg.line);
    if (network) {
      ctx.globalAlpha = 0.28;
      stroke(pl, colour, small ? 30 : 38);
      ctx.globalAlpha = 1;
    }
    stroke(pl, dark ? '#0b1220' : '#fff', small ? 18 : 22);
    stroke(pl, colour, small ? 11 : 13);
  }
  // Dots follow the station spacing so they never merge into a white band over the line.
  const route2d = pts.map((s) => P(s));
  let pathLen = 0;
  for (let i = 1; i < route2d.length; i++) {
    pathLen += Math.hypot(route2d[i]!.x - route2d[i - 1]!.x, route2d[i]!.y - route2d[i - 1]!.y);
  }
  const spacing = pathLen / Math.max(1, route2d.length - 1);
  const dotR = Math.min(small ? 4 : 7, spacing * 0.28);
  if (dotR >= 2.5) {
    for (const p of route2d) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, dotR, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }
  }

  // Labels avoid the stations and labels already placed.
  const placed: Rect[] = pts.map((q) => {
    const p = P(q);
    return { x: p.x - 14, y: p.y - 14, w: 28, h: 28 };
  });
  const label = (
    s: string,
    p: Pt,
    size: number,
    weight: number,
    colour: string,
    reach = 32,
    force = false,
  ) => {
    ctx.font = `${weight} ${size}px ${FONT}`;
    const text = fit(s, size > 20 ? 300 : 200, size, weight);
    const w = ctx.measureText(text).width;
    const h = size + 4;
    const tries: [number, number][] = [
      [reach, size * 0.35],
      [-reach - w, size * 0.35],
      [-w / 2, -reach + 6],
      [-w / 2, reach + size * 0.6],
      [reach, -reach + 6],
      [-reach - w, -reach + 6],
      [reach, reach + size * 0.6],
      [-reach - w, reach + size * 0.6],
    ];
    for (const [dx, dy] of tries) {
      const r = { x: p.x + dx, y: p.y + dy - size, w, h };
      const inside =
        r.x >= box.x + 8 &&
        r.x + r.w <= box.x + box.w - 8 &&
        r.y >= box.y + 8 &&
        r.y + r.h <= box.y + box.h - 8;
      if (inside && (force || !placed.some((q) => overlaps(q, r)))) {
        placed.push(r);
        ctx.font = `${weight} ${size}px ${FONT}`;
        ctx.textAlign = 'left';
        ctx.direction = rtl ? 'rtl' : 'ltr';
        ctx.lineWidth = 6;
        ctx.strokeStyle = pal.mapBg;
        ctx.strokeText(text, r.x, r.y + size);
        ctx.fillStyle = colour;
        ctx.fillText(text, r.x, r.y + size);
        return;
      }
    }
  };
  const pin = (p: Pt, colour: string) => {
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.bezierCurveTo(p.x - 28, p.y - 26, p.x - 24, p.y - 66, p.x, p.y - 66);
    ctx.bezierCurveTo(p.x + 24, p.y - 66, p.x + 28, p.y - 26, p.x, p.y);
    ctx.fillStyle = colour;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(p.x, p.y - 44, 9, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    placed.push({ x: p.x - 30, y: p.y - 68, w: 60, h: 70 });
  };

  dot(first, legColour(route.legs[0]!.line), small ? 10 : 15, small ? 6 : 8);
  for (const tr of route.transfers) {
    const s = stationsById.get(tr.stationId)!;
    dot(P(s), '#f59e0b', small ? 9 : 13, small ? 6 : 8);
  }
  dot(last, legColour(route.legs[route.legs.length - 1]!.line), small ? 10 : 15, small ? 6 : 8);

  const fromIsPlace = from.kind === 'point' && !schem;
  const toIsPlace = to.kind === 'point' && !schem;
  if (fromIsPlace) pin(fromP, dark ? '#14b8a6' : '#0f766e');
  if (toIsPlace) pin(toP, '#2563eb');

  // Labels by priority: endpoints and transfers, route stations, places, then the rest.
  const big = small ? 22 : 26;
  if (fromIsPlace)
    label(endpointName(from, lang), { x: fromP.x, y: fromP.y - 36 }, big, 800, pal.text, 30, true);
  if (toIsPlace)
    label(endpointName(to, lang), { x: toP.x, y: toP.y - 36 }, big, 800, pal.text, 30, true);
  label(name(route.from), first, big, 800, pal.text);
  label(name(route.to), last, big, 800, pal.text);
  for (const tr of route.transfers) {
    const s = stationsById.get(tr.stationId)!;
    label(name(tr.stationId), P(s), big - 2, 700, pal.text);
  }
  if (o.routeNames) {
    for (const s of pts) {
      if (s.id === route.from || s.id === route.to) continue;
      if (route.transfers.some((tr) => tr.stationId === s.id)) continue;
      label(stationName(s, lang), P(s), small ? 17 : 22, 600, pal.body, 20);
    }
  }
  let credit = false;
  if (o.places && !schem && input.nearby?.length) {
    credit = true;
    for (const { place } of input.nearby) {
      const p = proj(place.lat, place.lng);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#f97316';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#fff';
      ctx.stroke();
      placed.push({ x: p.x - 8, y: p.y - 8, w: 16, h: 16 });
    }
    for (const { place } of input.nearby) {
      const label2 = (lang === 'ar' ? place.ar || place.en : place.en || place.ar) as string;
      label(label2, proj(place.lat, place.lng), 19, 600, dark ? '#fdba74' : '#c2410c', 14);
    }
  }
  if (network && o.otherNames) {
    const onRoute = new Set(ids);
    for (const s of metro.stations) {
      if (onRoute.has(s.id)) continue;
      label(stationName(s, lang), P(s), small ? 15 : 19, 500, pal.muted, 12);
    }
  }
  if (credit) {
    ctx.direction = 'ltr';
    ctx.font = `500 18px ${FONT}`;
    ctx.textAlign = rtl ? 'right' : 'left';
    ctx.fillStyle = pal.muted;
    ctx.fillText(
      '© OpenStreetMap contributors',
      rtl ? box.x + box.w - 16 : box.x + 16,
      box.y + box.h - 14,
    );
  }
  // A small north arrow when the map was turned.
  if (Math.abs(Math.sin(turn / 2)) > 0.01) {
    const cx = rtl ? box.x + 70 : box.x + box.w - 70;
    const cy = box.y + 70;
    const dx = Math.sin(turn);
    const dy = -Math.cos(turn);
    ctx.beginPath();
    ctx.arc(cx, cy, 30, 0, Math.PI * 2);
    ctx.fillStyle = pal.card;
    ctx.globalAlpha = 0.9;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.moveTo(cx + dx * 22, cy + dy * 22);
    ctx.lineTo(cx - dy * 9 - dx * 10, cy + dx * 9 - dy * 10);
    ctx.lineTo(cx + dy * 9 - dx * 10, cy - dx * 9 - dy * 10);
    ctx.closePath();
    ctx.fillStyle = '#dc2626';
    ctx.fill();
    ctx.direction = 'ltr';
    text(t('imgNorth'), cx + dx * 40, cy + dy * 40 + 8, {
      size: 20,
      weight: 800,
      color: pal.muted,
      align: 'center',
    });
    ctx.direction = rtl ? 'rtl' : 'ltr';
  }
  ctx.restore();

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
    text(fit(body, max, 28, 600), x, y, { size: 28, weight: 600, color: pal.body });
    y += rowH;
  };

  if (stepsH > 0) {
    if (trip.walkIn) stepLine(null, null, `${t('walkToStation')} ${name(trip.walkIn.station.id)}`);
    route.legs.forEach((leg, i) => {
      stepLine(
        `${t('line')} ${n(lineNo(leg.line))}`,
        legColour(leg.line),
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
  }

  // Every station of a long trip, in columns.
  if (listH > 0) {
    const lineOf = new Map<string, LineId>();
    for (const leg of route.legs)
      for (const id of leg.stations) if (!lineOf.has(id)) lineOf.set(id, leg.line);
    const changes = new Set(route.transfers.map((x) => x.stationId));
    const ly = box.y + box.h + 60 + (stepsH > 0 ? stepsH : 0);
    text(`${t('imgAllStations')} (${n(ids.length)})`, edgeStart, ly, {
      size: 30,
      weight: 800,
      color: pal.text,
    });
    const per = Math.ceil(ids.length / listCols);
    const colW = (W - 2 * M) / listCols;
    const size = listRowH >= 36 ? 26 : 22;
    ids.forEach((id, i) => {
      const col = Math.floor(i / per);
      const row = i % per;
      const x = rtl ? W - M - col * colW : M + col * colW;
      const yy = ly + 44 + row * listRowH + listRowH * 0.6;
      const swap = changes.has(id);
      const colour = swap ? '#f59e0b' : legColour(lineOf.get(id) ?? route.legs[0]!.line);
      ctx.beginPath();
      ctx.arc(rtl ? x - 10 : x + 10, yy - size * 0.32, 8, 0, Math.PI * 2);
      ctx.fillStyle = colour;
      ctx.fill();
      const ends2 = i === 0 || i === ids.length - 1;
      text(
        fit(`${swap ? '⇄ ' : ''}${name(id)}`, colW - 48, size, ends2 || swap ? 800 : 500),
        rtl ? x - 34 : x + 34,
        yy,
        {
          size,
          weight: ends2 || swap ? 800 : 500,
          color: ends2 || swap ? pal.text : pal.body,
        },
      );
    });
  }

  // Women-only cars tip, then the footer.
  const footTop = H - (o.qr ? 230 : o.branding ? 120 : 40);
  if (o.women) {
    ctx.font = `600 24px ${FONT}`;
    text(fit(t('stationWomen'), W - 2 * M, 24, 600), edgeStart, footTop - 24, {
      size: 24,
      weight: 600,
      color: pal.muted,
    });
  }
  if (o.qr || o.branding) {
    ctx.fillStyle = pal.rule;
    ctx.fillRect(M, footTop, W - 2 * M, 2);
  }
  if (o.branding) {
    text('shawkyebrahim2514.github.io/cairo-metro', edgeStart, footTop + (o.qr ? 70 : 64), {
      size: 26,
      weight: 600,
      color: pal.teal,
    });
    text(
      new Date().toLocaleDateString(rtl ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short' }),
      o.qr ? edgeStart : edgeEnd,
      footTop + (o.qr ? 114 : 64),
      { size: 24, color: pal.muted, align: o.qr ? 'start' : 'end' },
    );
  }
  if (o.qr && input.url) {
    const m = qrMatrix(input.url);
    if (m) {
      const { d, size } = qrPath(m, 2);
      const side = 170;
      const qx = rtl ? M : W - M - side;
      const qy = footTop + 30;
      ctx.fillStyle = '#fff';
      round(qx - 8, qy - 8, side + 16, side + 16, 14);
      ctx.fill();
      ctx.save();
      ctx.translate(qx, qy);
      ctx.scale(side / size, side / size);
      ctx.fillStyle = '#000';
      ctx.fill(new Path2D(d));
      ctx.restore();
    }
  }

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'),
  );
}
