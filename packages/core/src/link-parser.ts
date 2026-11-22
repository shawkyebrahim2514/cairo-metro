import type { LatLng } from './geo';

export type ParsedPlace =
  | { kind: 'coords'; point: LatLng; label?: string }
  /** A name to geocode (from a /place/Name URL, q=Name, or plain text). */
  | { kind: 'text'; query: string }
  /** A shortened link that must be expanded by following its redirect. */
  | { kind: 'short'; url: string };

const NUM = '-?\\d{1,3}(?:\\.\\d+)?';
const PAIR = new RegExp(`^\\s*\\(?\\s*(${NUM})\\s*[,;\\s]\\s*(${NUM})\\s*\\)?\\s*$`);
const SHORT_HOSTS = /^(?:maps\.app\.goo\.gl|goo\.gl|g\.co|share\.google)$/i;

function valid(lat: number, lng: number): LatLng | null {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
    ? { lat, lng }
    : null;
}

function pair(text: string): LatLng | null {
  const m = PAIR.exec(text);
  return m ? valid(parseFloat(m[1]!), parseFloat(m[2]!)) : null;
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s.replace(/\+/g, ' '));
  } catch {
    return s;
  }
}

function placeLabel(pathname: string): string | undefined {
  const m = /\/maps\/place\/([^/@]+)/.exec(pathname) ?? /\/place\/([^/@]+)/.exec(pathname);
  const label = m ? safeDecode(m[1]!).trim() : '';
  return label && !pair(label) ? label : undefined;
}

/**
 * Parse whatever the user pasted: a Google Maps URL (long or short), "lat,lng" text,
 * or a place name. Returns null for empty input.
 */
export function parsePlaceInput(input: string): ParsedPlace | null {
  const text = input.trim();
  if (!text) return null;

  const direct = pair(text);
  if (direct) return { kind: 'coords', point: direct };

  const urlMatch = /(?:https?:\/\/)?(?:[\w-]+\.)+[a-z]{2,}(?:[/?#]\S*)?/i.exec(text);
  const looksLikeUrl = /^https?:\/\//i.test(text) || (urlMatch !== null && urlMatch[0] === text);
  if (!looksLikeUrl) return { kind: 'text', query: text };

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return { kind: 'text', query: text };
  }

  const isGoogleMaps =
    (/(^|\.)google\.[a-z.]+$/i.test(url.hostname) && /^\/maps|^\/search/.test(url.pathname)) ||
    /^maps\.google\.[a-z.]+$/i.test(url.hostname);
  if (SHORT_HOSTS.test(url.hostname) || (/(^|\.)google\./i.test(url.hostname) && !isGoogleMaps)) {
    return { kind: 'short', url: url.toString() };
  }
  if (!isGoogleMaps && !/(^|\.)maps\./i.test(url.hostname)) {
    return { kind: 'text', query: text };
  }

  const href = safeDecode(url.pathname) + url.search + url.hash;
  const label = placeLabel(url.pathname);

  // 1. !3d<lat>!4d<lng> is the actual pin of a place; @lat,lng is only the map viewport.
  const pin = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(href);
  if (pin) {
    const p = valid(parseFloat(pin[1]!), parseFloat(pin[2]!));
    if (p) return { kind: 'coords', point: p, label };
  }

  // 2. Explicit query parameters.
  for (const key of ['q', 'query', 'destination', 'daddr', 'll', 'center', 'saddr']) {
    const v = url.searchParams.get(key);
    if (!v) continue;
    const p = pair(v);
    if (p) return { kind: 'coords', point: p, label };
    if (key === 'q' || key === 'query' || key === 'destination' || key === 'daddr') {
      return { kind: 'text', query: v.trim() };
    }
  }

  // 3. Directions link: take the last stop (the destination).
  const dir = /\/maps\/dir\/(.+)/.exec(url.pathname);
  if (dir) {
    const stops = dir[1]!
      .split('/')
      .filter((s) => s && !s.startsWith('@') && !s.startsWith('data='))
      .map(safeDecode);
    const last = stops[stops.length - 1];
    if (last) {
      const p = pair(last);
      return p ? { kind: 'coords', point: p } : { kind: 'text', query: last };
    }
  }

  // 4. Viewport centre.
  const at = new RegExp(`@(${NUM}),(${NUM})`).exec(href);
  if (at) {
    const p = valid(parseFloat(at[1]!), parseFloat(at[2]!));
    if (p) return { kind: 'coords', point: p, label };
  }

  // 5. Place name only, or a search path.
  if (label) return { kind: 'text', query: label };
  const search = /\/maps\/search\/([^/@]+)/.exec(url.pathname);
  if (search) {
    const q = safeDecode(search[1]!).trim();
    const p = pair(q);
    return p ? { kind: 'coords', point: p } : { kind: 'text', query: q };
  }
  return null;
}
