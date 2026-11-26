import type { Station } from './types';

const ARTICLES = new Set(['el', 'al', 'il', 'ell', 'ul']);

/** Strip the Arabic definite article, diacritics and letter variants (while folding any Latin tokens too). */
function normalizeArabicToken(t: string): string {
  const clean = t
    .replace(/[\u064B-\u065F\u0670\u0640\u200E\u200F]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ک/g, 'ك')
    .replace(/ی/g, 'ي');
  return clean.startsWith('ال') && clean.length > 4 ? clean.slice(2) : clean;
}

function normalizeMixed(text: string): string {
  return text
    .split(/[\s\-_.'’]+/)
    .filter(Boolean)
    .map((t) => (/[\u0600-\u06FF]/.test(t) ? normalizeArabicToken(t) : normalizeLatin(t)))
    .filter(Boolean)
    .join(' ');
}

function foldLatinToken(token: string): string {
  return (
    token
      // Digraphs first so they are not split by single-letter folds.
      .replace(/sh/g, 'x')
      .replace(/kh/g, 'k')
      .replace(/gh/g, 'g')
      .replace(/th/g, 't')
      .replace(/ph/g, 'f')
      .replace(/ee/g, 'i')
      .replace(/oo|ou/g, 'u')
      // Common transliteration alternatives: e/i, o/u, p/b, y/i, c/q/k, v/f.
      .replace(/e/g, 'i')
      .replace(/o/g, 'u')
      .replace(/y/g, 'i')
      .replace(/p/g, 'b')
      .replace(/[cq]/g, 'k')
      .replace(/v/g, 'f')
      // "aa" and "a" (or "ss" and "s", ...) are treated as the same letter.
      .replace(/(.)\1+/g, '$1')
      // Trailing silent "h" (Zahra / Zahraa / Zahrah).
      .replace(/(.{2,})h$/, '$1')
  );
}

function normalizeLatin(text: string): string {
  const tokens = text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean);

  // Drop "El"/"Al" whether it is a separate token (El Marg, El-Marg) or glued (Elmarg).
  const stripped = tokens
    .map((t, i) => {
      if (ARTICLES.has(t)) return '';
      const glued = /^(el|al|il)(.{3,})$/.exec(t);
      return i === 0 && glued ? glued[2]! : t;
    })
    .filter(Boolean);
  const kept = stripped.length > 0 ? stripped : tokens;
  return kept.map(foldLatinToken).join(' ');
}

/** Canonical search key: tokens joined by a single space. Works for Latin, Arabic, and mixed input. */
export function normalizeForSearch(text: string): string {
  if (/[\u0600-\u06FF]/.test(text)) return normalizeMixed(text);
  return normalizeLatin(text);
}

function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(
        prev[j]! + 1,
        cur[j - 1]! + 1,
        prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      cur.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length]!;
}

/** Lower is better; null means no match. */
function scoreKey(query: string, candidate: string): number | null {
  if (!query || !candidate) return null;
  if (candidate === query) return 0;
  if (candidate.startsWith(query)) return 1;
  if (candidate.split(' ').some((t) => t.startsWith(query))) return 2;
  // Every typed word starts some word of the name, in any order ("hospital demerdash").
  const qTokens = query.split(' ');
  if (qTokens.length > 1) {
    const cTokens = candidate.split(' ');
    if (qTokens.every((q) => cTokens.some((c) => c.startsWith(q)))) return 2.5;
  }
  if (candidate.includes(query)) return 3;
  // Also match without spaces (user typed "newmarg" or "kitkat").
  const qc = query.replace(/ /g, '');
  const cc = candidate.replace(/ /g, '');
  if (qc !== query || cc !== candidate) {
    if (cc === qc) return 0.5;
    if (cc.includes(qc)) return 3.5;
  }
  const max = query.length <= 4 ? 0 : query.length <= 8 ? 1 : 2;
  if (max > 0) {
    const d = editDistance(qc, cc, max);
    if (d <= max) return 4 + d;
    // Typo tolerance against a prefix of the candidate (partially typed names).
    const dp = editDistance(qc, cc.slice(0, qc.length), max);
    if (dp <= max) return 5 + dp;
  }
  return null;
}

export interface StationMatch {
  station: Station;
  score: number;
}

export interface Match<T> {
  item: T;
  score: number;
}

/** Precomputes normalised names once so that searching thousands of items stays fast. */
export function createSearchIndex<T>(
  items: T[],
  namesOf: (item: T) => string[],
  /** Breaks ties between equally good matches; higher comes first. */
  weightOf: (item: T) => number = () => 0,
) {
  const entries = items.map((item) => ({
    item,
    weight: weightOf(item),
    label: namesOf(item).find(Boolean) ?? '',
    keys: [...new Set(namesOf(item).map(normalizeForSearch).filter(Boolean))],
  }));
  return {
    search(query: string, limit = 8): Match<T>[] {
      const q = normalizeForSearch(query);
      if (!q) return [];
      const matches: (Match<T> & { label: string; weight: number })[] = [];
      for (const e of entries) {
        let best: number | null = null;
        for (const key of e.keys) {
          const s = scoreKey(q, key);
          if (s !== null && (best === null || s < best)) best = s;
        }
        if (best !== null)
          matches.push({ item: e.item, score: best, label: e.label, weight: e.weight });
      }
      return matches
        .sort((a, b) => a.score - b.score || b.weight - a.weight || a.label.localeCompare(b.label))
        .slice(0, limit)
        .map(({ item, score }) => ({ item, score }));
    },
  };
}

const stationIndexCache = new WeakMap<Station[], ReturnType<typeof createSearchIndex<Station>>>();

/** Search stations by English/Arabic name and aliases, tolerant to transliteration variants. */
export function searchStations(stations: Station[], query: string, limit = 8): StationMatch[] {
  let idx = stationIndexCache.get(stations);
  if (!idx) {
    idx = createSearchIndex(stations, (s) => [s.name.en, s.name.ar, ...s.aliases]);
    stationIndexCache.set(stations, idx);
  }
  return idx.search(query, limit).map((m) => ({ station: m.item, score: m.score }));
}
