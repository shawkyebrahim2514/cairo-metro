// Builds the offline places index (malls, universities, hospitals, landmarks, districts...) from OSM.
// Usage: npm run data:places  -> writes data/places.json (ODbL, © OpenStreetMap contributors)
import { mkdirSync, writeFileSync } from 'node:fs';
import { normalizeForSearch } from '../packages/core/src/search';
import type { Place } from '../packages/core/src/types';

const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const USER_AGENT = 'cairo-metro-app/0.1 (places index script)';
// Greater Cairo: south, west, north, east.
const BBOX = '29.75,31.0,30.3,31.6';

// Edit these lists to change what ends up in the index.
const AMENITIES =
  'university|college|hospital|clinic|school|marketplace|place_of_worship|bank|cinema|theatre|library|police|townhall|courthouse|restaurant|cafe|fast_food|pharmacy';
const SHOPS = 'mall|department_store|supermarket';
const LEISURE = 'park|stadium|sports_centre';
const PLACES = 'suburb|neighbourhood|quarter|city_block|square';
const SKIP_TOURISM = new Set(['information', 'artwork']);
const TYPE_KEYS = ['amenity', 'shop', 'tourism', 'leisure', 'place'] as const;

const query = `[out:json][timeout:180];
(
  nwr["name"]["amenity"~"^(${AMENITIES})$"](${BBOX});
  nwr["name"]["shop"~"^(${SHOPS})$"](${BBOX});
  nwr["name"]["tourism"](${BBOX});
  nwr["name"]["leisure"~"^(${LEISURE})$"](${BBOX});
  nwr["name"]["place"~"^(${PLACES})$"](${BBOX});
);
out center tags;`;

interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

const hasArabic = (s: string) => /[\u0600-\u06FF]/.test(s);
const clean = (s: string | undefined) =>
  (s ?? '')
    .replace(/[\u200E\u200F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

function toPlace(el: OsmElement): Place | null {
  const tags = el.tags ?? {};
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (lat === undefined || lng === undefined) return null;

  const key = TYPE_KEYS.find((k) => tags[k]);
  const type = key ? tags[key]! : '';
  if (!type || (key === 'tourism' && SKIP_TOURISM.has(type))) return null;

  const name = clean(tags.name);
  let en = clean(tags['name:en']);
  let ar = clean(tags['name:ar']);
  if (!en && name && !hasArabic(name)) en = name;
  if (!ar && name && hasArabic(name)) ar = name;
  if (!en && !ar) return null;

  const round = (n: number) => Math.round(n * 1e5) / 1e5;
  return { id: `${el.type[0]}${el.id}`, en, ar, type, lat: round(lat), lng: round(lng) };
}

async function fetchElements(): Promise<OsmElement[]> {
  let lastError: unknown;
  for (const url of OVERPASS_URLS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': USER_AGENT,
          Accept: 'application/json',
        },
        body: new URLSearchParams({ data: query }),
      });
      if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
      return ((await res.json()) as { elements: OsmElement[] }).elements;
    } catch (err) {
      lastError = err;
      console.warn(String(err));
    }
  }
  throw lastError;
}

async function run(): Promise<void> {
  const elements = await fetchElements();

  // The same venue is often mapped as both a node and a building outline; keep one.
  const seen = new Map<string, Place>();
  for (const el of elements) {
    const p = toPlace(el);
    if (!p) continue;
    const k = `${normalizeForSearch(p.en || p.ar)}|${p.lat.toFixed(3)}|${p.lng.toFixed(3)}`;
    const existing = seen.get(k);
    seen.set(k, existing ? { ...p, en: p.en || existing.en, ar: p.ar || existing.ar } : p);
  }
  const places = [...seen.values()].sort((a, b) => a.id.localeCompare(b.id));

  mkdirSync('data', { recursive: true });
  writeFileSync(
    'data/places.json',
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      license: 'ODbL, © OpenStreetMap contributors',
      places,
    }) + '\n',
  );
  const byType = new Map<string, number>();
  for (const p of places) byType.set(p.type, (byType.get(p.type) ?? 0) + 1);
  console.log(`Saved ${places.length} places (from ${elements.length} OSM elements)`);
  console.log(
    [...byType]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([t, n]) => `${t}:${n}`)
      .join('  '),
  );
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
