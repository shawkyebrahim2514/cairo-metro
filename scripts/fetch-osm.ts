// Fetches Cairo Metro route relations and their member nodes from OSM (Overpass).
// Usage: node scripts/fetch-osm.ts   -> writes data/raw/osm-cairo-metro.json
import { mkdirSync, writeFileSync } from 'node:fs';

const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const USER_AGENT = 'cairo-metro-app/0.1 (data snapshot script)';

// Line 1 (both directions), Line 2 (both), Line 3 (all branches/directions).
const RELATION_IDS = [421705, 2826217, 421706, 7927231, 2063304, 7686561, 17625744, 17625746];

const query = `[out:json][timeout:180];
rel(id:${RELATION_IDS.join(',')})->.routes;
.routes out body;
node(r.routes)->.members;
.members out body;`;

async function run(): Promise<void> {
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
      const json = (await res.json()) as { osm3s?: unknown; elements: unknown[] };
      const out = {
        fetchedAt: new Date().toISOString(),
        source: url,
        license: 'ODbL, © OpenStreetMap contributors',
        osm3s: json.osm3s,
        elements: json.elements,
      };
      mkdirSync('data/raw', { recursive: true });
      writeFileSync('data/raw/osm-cairo-metro.json', JSON.stringify(out, null, 1) + '\n');
      console.log(`Saved ${json.elements.length} elements from ${url}`);
      return;
    } catch (err) {
      lastError = err;
      console.warn(String(err));
    }
  }
  throw lastError;
}

await run();
