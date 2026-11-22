// Fetches the Wikipedia station list (wikitext) and Wikidata entities for cross-checking OSM data.
// Usage: node scripts/fetch-crosscheck.ts -> writes data/raw/wikipedia-wikidata-stations.json
import { mkdirSync, writeFileSync } from 'node:fs';

const UA = 'cairo-metro-app/0.1 (data cross-check script)';
const PAGE = 'List_of_Cairo_Metro_stations';

interface WikiRow {
  qid: string;
  arabic: string;
}

interface WikidataEntity {
  labels?: Record<string, { value: string }>;
  claims?: {
    P625?: { mainsnak?: { datavalue?: { value?: { latitude: number; longitude: number } } } }[];
  };
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return (await res.json()) as T;
}

function parseLines(wikitext: string): Record<string, WikiRow[]> {
  const lines: Record<string, WikiRow[]> = {};
  let current: string | undefined;
  for (const raw of wikitext.split('\n')) {
    const heading = raw.match(/^==\s*Line (\d)\s*==/);
    if (heading) {
      current = `L${heading[1]}`;
      lines[current] = [];
      continue;
    }
    if (/^==[^=]/.test(raw)) current = undefined;
    const row = raw.match(/\{\{Wdtable row\/station\d?\|(.*)\}\}/);
    if (current && row) {
      const body = row[1]!;
      const qid = body.match(/qid=(Q\d+)/)?.[1];
      const arabic = body.match(/arabic=\s*([^|}]+)/)?.[1]?.trim() ?? '';
      if (qid) lines[current]!.push({ qid, arabic });
    }
  }
  return lines;
}

const page = await getJson<{ parse: { wikitext: string } }>(
  `https://en.wikipedia.org/w/api.php?action=parse&page=${PAGE}&prop=wikitext&format=json&formatversion=2`,
);
const lines = parseLines(page.parse.wikitext);
const qids = [...new Set(Object.values(lines).flatMap((rows) => rows.map((r) => r.qid)))];

const entities: Record<string, unknown> = {};
for (let i = 0; i < qids.length; i += 40) {
  const chunk = qids.slice(i, i + 40);
  const data = await getJson<{ entities: Record<string, WikidataEntity> }>(
    `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${chunk.join('|')}&props=labels|claims&languages=en|ar&format=json`,
  );
  for (const [id, e] of Object.entries(data.entities)) {
    const coord = e.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
    entities[id] = {
      en: e.labels?.en?.value ?? null,
      ar: e.labels?.ar?.value ?? null,
      lat: coord?.latitude ?? null,
      lng: coord?.longitude ?? null,
    };
  }
}

mkdirSync('data/raw', { recursive: true });
writeFileSync(
  'data/raw/wikipedia-wikidata-stations.json',
  JSON.stringify(
    {
      fetchedAt: new Date().toISOString(),
      sources: [`https://en.wikipedia.org/wiki/${PAGE}`, 'https://www.wikidata.org'],
      license: 'CC BY-SA 4.0 (Wikipedia) / CC0 (Wikidata)',
      lines,
      entities,
    },
    null,
    1,
  ) + '\n',
);
console.log(
  Object.entries(lines)
    .map(([k, v]) => `${k}: ${v.length}`)
    .join(', '),
  `| entities: ${Object.keys(entities).length}`,
);
