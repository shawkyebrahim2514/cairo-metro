// Builds data/metro.json (stations + lines) and data/crosscheck.json from raw snapshots.
// Usage: npm run data:build
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { haversineMeters } from '../packages/core/src/geo';
import type {
  Branch,
  Line,
  LineId,
  LocalizedName,
  MetroData,
  Segment,
  Station,
  StationLineEntry,
} from '../packages/core/src/types';

interface OsmNode {
  type: 'node';
  id: number;
  lat: number;
  lon: number;
  tags: Record<string, string>;
}
interface OsmRelation {
  type: 'relation';
  id: number;
  tags: Record<string, string>;
  members: { type: string; ref: number; role: string }[];
}
interface WikiEntity {
  en: string | null;
  ar: string | null;
  lat: number;
  lng: number;
}
interface CuratedFile {
  lines: Record<
    LineId,
    {
      name: LocalizedName;
      colour: string;
      operator: string;
      branches: { id: string; name: LocalizedName }[];
    }
  >;
  defaultTransferSec: number;
  stationOverrides: Record<
    string,
    { name?: Partial<LocalizedName>; aliases?: string[]; transferSec?: number; notes?: string[] }
  >;
}

const osm = JSON.parse(readFileSync('data/raw/osm-cairo-metro.json', 'utf8'));
const wiki = JSON.parse(readFileSync('data/raw/wikipedia-wikidata-stations.json', 'utf8')) as {
  lines: Record<string, { qid: string; arabic: string }[]>;
  entities: Record<string, WikiEntity>;
};
const curated = JSON.parse(readFileSync('data/curated/curated.json', 'utf8')) as CuratedFile;
interface VerificationFile {
  stations: Record<string, { verified?: boolean; name?: Partial<LocalizedName> }>;
}
interface AltNamesFile {
  stations: Record<string, { names?: string[]; remove?: string[] }>;
}
const altNamesPath = 'data/curated/alt-names.json';
const altNames: AltNamesFile = existsSync(altNamesPath)
  ? JSON.parse(readFileSync(altNamesPath, 'utf8'))
  : { stations: {} };

const verificationPath = 'data/curated/verification.json';
const verification: VerificationFile = existsSync(verificationPath)
  ? JSON.parse(readFileSync(verificationPath, 'utf8'))
  : { stations: {} };

const nodes = new Map<number, OsmNode>(
  (osm.elements as (OsmNode | OsmRelation)[])
    .filter((e): e is OsmNode => e.type === 'node')
    .map((n) => [n.id, n]),
);
const relations = new Map<number, OsmRelation>(
  (osm.elements as (OsmNode | OsmRelation)[])
    .filter((e): e is OsmRelation => e.type === 'relation')
    .map((r) => [r.id, r]),
);

function stops(relId: number, reverse = false): OsmNode[] {
  const rel = relations.get(relId);
  if (!rel) throw new Error(`Relation ${relId} missing from snapshot`);
  const list = rel.members
    .filter((m) => m.type === 'node' && m.role.startsWith('stop'))
    .map((m) => {
      const n = nodes.get(m.ref);
      if (!n) throw new Error(`Node ${m.ref} missing`);
      return n;
    });
  return reverse ? list.reverse() : list;
}

// ---------- text helpers ----------
const hasArabic = (s: string) => /[\u0600-\u06FF]/.test(s);
function cleanAr(s: string): string {
  return s
    .replace(/[\u200e\u200f\u202a-\u202e]/g, '')
    .replace(/ک/g, 'ك')
    .replace(/ی/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim();
}
function cleanEn(s: string): string {
  return s
    .replace(/\(.*?\)/g, '')
    .replace(/\b(sub)?way station\b/gi, '')
    .replace(/\bmetro station\b/gi, '')
    .replace(/\bstation\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, '');
const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// ---------- branch definitions (OSM relations) ----------
interface BranchStop {
  a: OsmNode;
  b: OsmNode;
}
interface BranchDef {
  line: LineId;
  id: string;
  stops: BranchStop[];
}

function pair(forward: OsmNode[], backward: OsmNode[], label: string): BranchStop[] {
  if (forward.length !== backward.length) {
    throw new Error(`${label}: direction lists differ (${forward.length} vs ${backward.length})`);
  }
  return forward.map((a, i) => {
    const b = backward[i]!;
    const d = haversineMeters({ lat: a.lat, lng: a.lon }, { lat: b.lat, lng: b.lon });
    if (d > 600) throw new Error(`${label}: stop ${i} direction nodes ${Math.round(d)}m apart`);
    return { a, b };
  });
}

const l1 = pair(stops(421705), stops(2826217, true), 'L1');
const l2 = pair(stops(7927231), stops(421706, true), 'L2');
const l3x = pair(stops(2063304), stops(7686561, true), 'L3 Rod El-Farag');
const l3y = pair(stops(17625746), stops(17625744, true), 'L3 Cairo Univ');
const kitKat = l3x.findIndex((s) => /kit/i.test(s.a.tags['name:en'] ?? s.a.tags.name ?? ''));
if (kitKat < 0) throw new Error('Kit-Kat not found in L3 relation');

const branchDefs: BranchDef[] = [
  { line: 'L1', id: 'L1-main', stops: l1 },
  { line: 'L2', id: 'L2-main', stops: l2 },
  { line: 'L3', id: 'L3-main', stops: l3x.slice(0, kitKat + 1) },
  { line: 'L3', id: 'L3-imbaba', stops: l3x.slice(kitKat) },
  { line: 'L3', id: 'L3-cairo-univ', stops: l3y.slice(kitKat) },
];

// ---------- unique per-line stops, matched to Wikidata ----------
interface Entry {
  key: string;
  line: LineId;
  lat: number;
  lng: number;
  nodes: OsmNode[];
  memberships: { branch: string; order: number }[];
  qid?: string;
  matchDistanceM?: number;
}
const entries: Entry[] = [];
for (const def of branchDefs) {
  def.stops.forEach((s, order) => {
    const lat = (s.a.lat + s.b.lat) / 2;
    const lng = (s.a.lon + s.b.lon) / 2;
    const existing = entries.find(
      (e) => e.line === def.line && haversineMeters(e, { lat, lng }) < 100,
    );
    if (existing) {
      existing.memberships.push({ branch: def.id, order });
      for (const n of [s.a, s.b]) if (!existing.nodes.includes(n)) existing.nodes.push(n);
    } else {
      entries.push({
        key: `${def.line}:${s.a.id}`,
        line: def.line,
        lat,
        lng,
        nodes: [s.a, s.b],
        memberships: [{ branch: def.id, order }],
      });
    }
  });
}

const warnings: string[] = [];
for (const lineId of ['L1', 'L2', 'L3'] as const) {
  const lineEntries = entries.filter((e) => e.line === lineId);
  const rows = wiki.lines[lineId] ?? [];
  const pairs: { e: Entry; qid: string; d: number }[] = [];
  for (const e of lineEntries) {
    for (const r of rows) {
      const w = wiki.entities[r.qid]!;
      pairs.push({ e, qid: r.qid, d: haversineMeters(e, { lat: w.lat, lng: w.lng }) });
    }
  }
  pairs.sort((x, y) => x.d - y.d);
  const usedQ = new Set<string>();
  for (const p of pairs) {
    if (p.e.qid || usedQ.has(p.qid)) continue;
    p.e.qid = p.qid;
    p.e.matchDistanceM = Math.round(p.d);
    usedQ.add(p.qid);
  }
  const unmatched = lineEntries.filter((e) => !e.qid);
  if (unmatched.length) throw new Error(`${lineId}: ${unmatched.length} OSM stops unmatched`);
  if (usedQ.size !== rows.length) {
    warnings.push(`${lineId}: Wikipedia lists ${rows.length} stations, matched ${usedQ.size}`);
  }
}

// ---------- merge into physical stations ----------
const byQid = new Map<string, Entry[]>();
for (const e of entries) byQid.set(e.qid!, [...(byQid.get(e.qid!) ?? []), e]);

const arabicFromWiki = new Map<string, string>();
for (const rows of Object.values(wiki.lines)) {
  for (const r of rows) arabicFromWiki.set(r.qid, r.arabic);
}

const usedIds = new Set<string>();
const stations: Station[] = [];
const checks: Record<string, unknown>[] = [];

for (const [qid, group] of byQid) {
  const allNodes = group.flatMap((g) => g.nodes);
  const lat = allNodes.reduce((s, n) => s + n.lat, 0) / allNodes.length;
  const lng = allNodes.reduce((s, n) => s + n.lon, 0) / allNodes.length;
  const w = wiki.entities[qid]!;
  const review = verification.stations[qid];
  const override = {
    ...curated.stationOverrides[qid],
    name: { ...curated.stationOverrides[qid]?.name, ...review?.name },
  };

  const osmEn = allNodes
    .map((n) => n.tags['name:en'])
    .filter((s): s is string => !!s && !hasArabic(s))
    .map(cleanEn);
  const wikiEn = w.en ? cleanEn(w.en) : '';
  const en = override.name.en ?? osmEn[0] ?? wikiEn;

  const osmAr = allNodes
    .flatMap((n) => [n.tags['name:ar'], hasArabic(n.tags.name ?? '') ? n.tags.name : undefined])
    .filter((s): s is string => !!s)
    .map(cleanAr);
  const wikiAr = cleanAr(arabicFromWiki.get(qid) ?? '');
  const ar = override.name.ar ?? (wikiAr || osmAr[0] || cleanAr(w.ar ?? ''));

  const aliasPool = [
    ...osmEn,
    wikiEn,
    ...allNodes.flatMap((n) => [
      n.tags.alt_name,
      n.tags['alt_name:en'],
      n.tags.int_name,
      n.tags.old_name,
      n.tags['old_name:en'],
      n.tags.name && !hasArabic(n.tags.name) ? n.tags.name : undefined,
    ]),
    ...osmAr,
    cleanAr(w.ar ?? ''),
    ...(override.aliases ?? []),
  ]
    .filter((s): s is string => !!s)
    .flatMap((s) => s.split(';'))
    .map((s) => (hasArabic(s) ? cleanAr(s) : cleanEn(s)))
    .filter(Boolean);
  const seen = new Set([norm(en), norm(ar)]);
  const aliases: string[] = [];
  for (const a of aliasPool) {
    if (!seen.has(norm(a))) {
      seen.add(norm(a));
      aliases.push(a);
    }
  }

  let id = slugify(en) || qid.toLowerCase();
  if (usedIds.has(id)) id = `${id}-${qid.toLowerCase()}`;
  usedIds.add(id);

  // Alternative names people really use (curated separately so they can be reviewed in one place).
  const removed = new Set((altNames.stations[id]?.remove ?? []).map(norm));
  for (const a of altNames.stations[id]?.names ?? []) {
    const clean = hasArabic(a) ? cleanAr(a) : cleanEn(a);
    if (clean && !seen.has(norm(clean))) {
      seen.add(norm(clean));
      aliases.push(clean);
    }
  }

  for (let i = aliases.length - 1; i >= 0; i--)
    if (removed.has(norm(aliases[i]!))) aliases.splice(i, 1);

  const linesEntries: StationLineEntry[] = group.flatMap((g) =>
    g.memberships.map((m) => ({ line: g.line, branch: m.branch, order: m.order })),
  );
  const lineSet = new Set(linesEntries.map((l) => l.line));
  const interchange = lineSet.size > 1;

  const notes = [...(override.notes ?? [])];
  if (allNodes.some((n) => n.tags.construction)) {
    notes.push('OSM still tags this stop with construction=*; verify it is open.');
  }
  if (allNodes.some((n) => n.tags.fixme)) {
    notes.push(`OSM fixme: ${allNodes.map((n) => n.tags.fixme).find(Boolean)}`);
  }

  stations.push({
    id,
    name: { en, ar },
    aliases,
    lat: +lat.toFixed(6),
    lng: +lng.toFixed(6),
    lines: linesEntries,
    interchange,
    transferSec: interchange ? (override.transferSec ?? curated.defaultTransferSec) : null,
    status: 'open',
    verified: review?.verified === true,
    wikidata: qid,
    osmNodeIds: allNodes.map((n) => n.id).sort((a, b) => a - b),
    notes,
  });

  const wikiDist = Math.round(haversineMeters({ lat, lng }, { lat: w.lat, lng: w.lng }));
  checks.push({
    stationId: id,
    qid,
    wikidataEn: w.en,
    wikipediaAr: wikiAr || null,
    osmAr: [...new Set(osmAr)],
    osmEn: [...new Set(osmEn)],
    coordDistanceM: wikiDist,
    flags: [
      wikiDist > 300 ? 'coords-differ' : null,
      wikiAr && osmAr.length && !osmAr.some((a) => norm(a) === norm(wikiAr))
        ? 'arabic-name-differs'
        : null,
      !osmEn.length ? 'osm-english-missing' : null,
      wikiEn && osmEn.length && norm(wikiEn) !== norm(osmEn[0]!) ? 'english-name-differs' : null,
    ].filter(Boolean),
  });
}

// ---------- lines, segments ----------
const stationByQid = new Map(stations.map((s) => [s.wikidata!, s]));
const entryStation = (e: Entry) => stationByQid.get(e.qid!)!;
const CRUISE_MS = 12;
const DWELL_S = 30;
const CURVE = 1.1;

const lines: Line[] = (['L1', 'L2', 'L3'] as const).map((lineId) => {
  const meta = curated.lines[lineId];
  const branches: Branch[] = meta.branches.map((bm) => {
    const members = entries
      .filter((e) => e.line === lineId)
      .flatMap((e) =>
        e.memberships.filter((m) => m.branch === bm.id).map((m) => ({ e, order: m.order })),
      )
      .sort((x, y) => x.order - y.order);
    const ids = members.map((m) => entryStation(m.e).id);
    const segs: Segment[] = [];
    for (let i = 1; i < members.length; i++) {
      const a = entryStation(members[i - 1]!.e);
      const b = entryStation(members[i]!.e);
      const distanceM = Math.round(haversineMeters(a, b));
      segs.push({
        from: a.id,
        to: b.id,
        distanceM,
        rideSec: Math.round(DWELL_S + (distanceM * CURVE) / CRUISE_MS),
        estimated: true,
      });
    }
    return { id: bm.id, name: bm.name, stations: ids, segments: segs };
  });
  return {
    id: lineId,
    name: meta.name,
    colour: meta.colour,
    operator: meta.operator,
    branches,
  };
});

// order cross-check against Wikipedia
for (const lineId of ['L1', 'L2'] as const) {
  const ours = lines.find((l) => l.id === lineId)!.branches[0]!.stations;
  const theirs = (wiki.lines[lineId] ?? []).map((r) => stationByQid.get(r.qid)?.id);
  const same = ours.join() === theirs.join() || ours.join() === [...theirs].reverse().join();
  if (!same) warnings.push(`${lineId}: station order differs from Wikipedia list`);
}

stations.sort((a, b) => a.id.localeCompare(b.id));
const data: MetroData = {
  generatedAt: osm.fetchedAt,
  attribution: [
    '© OpenStreetMap contributors (ODbL)',
    'Wikipedia (CC BY-SA 4.0) / Wikidata (CC0) for cross-checking',
  ],
  stations,
  lines,
};
writeFileSync('data/metro.json', JSON.stringify(data, null, 1) + '\n');
writeFileSync(
  'data/crosscheck.json',
  JSON.stringify(
    {
      sources: ['OpenStreetMap', 'Wikipedia', 'Wikidata'],
      warnings,
      matchDistances: entries.map((e) => ({
        line: e.line,
        qid: e.qid,
        distanceM: e.matchDistanceM,
      })),
      stations: checks,
    },
    null,
    1,
  ) + '\n',
);

const perLine = lines.map((l) => `${l.id}: ${new Set(l.branches.flatMap((b) => b.stations)).size}`);
console.log(
  `Built ${stations.length} stations (${stations.filter((s) => s.interchange).length} interchanges) | ${perLine.join(', ')}`,
);
for (const w of warnings) console.warn('WARN', w);
