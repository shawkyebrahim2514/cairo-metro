import { decodeEndpoint, encodeEndpoint, type Endpoint } from './endpoint';

export interface SavedTrip {
  from: string;
  to: string;
  starred: boolean;
}

const KEY = 'trips';
const MAX_RECENT = 6;

const same = (a: SavedTrip, from: string, to: string) => a.from === from && a.to === to;

export function loadTrips(): SavedTrip[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (x): x is SavedTrip =>
        typeof x?.from === 'string' && typeof x?.to === 'string' && typeof x?.starred === 'boolean',
    );
  } catch {
    return [];
  }
}

function persist(trips: SavedTrip[]): SavedTrip[] {
  const stars = trips.filter((t) => t.starred);
  const recents = trips.filter((t) => !t.starred).slice(0, MAX_RECENT);
  const next = [...stars, ...recents];
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

/** Puts a trip first among the recents; keeps its star if it already exists. */
export function recordTrip(trips: SavedTrip[], from: Endpoint, to: Endpoint): SavedTrip[] {
  const f = encodeEndpoint(from);
  const t = encodeEndpoint(to);
  const existing = trips.find((x) => same(x, f, t));
  if (existing?.starred) return trips;
  return persist([{ from: f, to: t, starred: false }, ...trips.filter((x) => x !== existing)]);
}

export function toggleStar(trips: SavedTrip[], from: Endpoint, to: Endpoint): SavedTrip[] {
  const f = encodeEndpoint(from);
  const t = encodeEndpoint(to);
  const existing = trips.find((x) => same(x, f, t));
  const rest = trips.filter((x) => x !== existing);
  return persist([{ from: f, to: t, starred: !existing?.starred }, ...rest]);
}

export const isStarred = (trips: SavedTrip[], from: Endpoint, to: Endpoint) =>
  trips.some((x) => x.starred && same(x, encodeEndpoint(from), encodeEndpoint(to)));

export function openTrip(trip: SavedTrip): { from: Endpoint; to: Endpoint } | null {
  const from = decodeEndpoint(trip.from);
  const to = decodeEndpoint(trip.to);
  return from && to ? { from, to } : null;
}

/** Shareable link state: `#/plan?from=...&to=...`. */
export function readPlanHash(): { from: Endpoint; to: Endpoint } | null {
  const [path, query = ''] = window.location.hash.replace(/^#/, '').split('?');
  if (path !== '/plan') return null;
  const p = new URLSearchParams(query);
  const from = decodeEndpoint(p.get('from'));
  const to = decodeEndpoint(p.get('to'));
  return from && to ? { from, to } : null;
}

export function planUrl(from: Endpoint, to: Endpoint): string {
  const p = new URLSearchParams({ from: encodeEndpoint(from), to: encodeEndpoint(to) });
  return `${window.location.origin}${window.location.pathname}#/plan?${p}`;
}
