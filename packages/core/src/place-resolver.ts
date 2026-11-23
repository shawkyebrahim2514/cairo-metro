import type { LatLng } from './geo';
import { parsePlaceInput } from './link-parser';
import { createSearchIndex } from './search';
import type { Place } from './types';

export interface ResolvedPlace {
  name: string;
  point: LatLng;
  /** Where the answer came from. */
  source: 'coordinates' | 'place-index';
  placeType?: string;
}

export type ResolveResult =
  | { status: 'resolved'; place: ResolvedPlace }
  /** Several plausible places; let the user pick. */
  | { status: 'ambiguous'; candidates: ResolvedPlace[] }
  /** A bare short link with no name or coordinates; ask for the place name. */
  | { status: 'needs-name'; url: string }
  | { status: 'not-found'; query: string }
  | { status: 'empty' };

export interface SharedText {
  url?: string;
  /** First non-URL line, which Google Maps uses for the place name. */
  name?: string;
  address?: string;
}

/**
 * Split the text delivered by the Web Share Target (usually "Name\nAddress\nhttps://maps.app.goo.gl/...").
 * Also works for "Name - https://..." on a single line.
 */
export function parseSharedText(text: string): SharedText {
  const urlMatch = /https?:\/\/\S+/.exec(text);
  const url = urlMatch?.[0].replace(/[)\].,;]+$/, '');
  const rest = (urlMatch ? text.replace(urlMatch[0], '\n') : text)
    .split(/\r?\n/)
    .map((l) => l.replace(/^[\s\-–—:]+|[\s\-–—:]+$/g, ''))
    .filter(Boolean);
  const result: SharedText = {};
  if (url) result.url = url;
  if (rest[0]) result.name = rest[0];
  if (rest.length > 1) result.address = rest.slice(1).join(', ');
  return result;
}

const toResolved = (p: Place): ResolvedPlace => ({
  name: p.en || p.ar,
  point: { lat: p.lat, lng: p.lng },
  source: 'place-index',
  placeType: p.type,
});

/** Landmarks a rider is likely to mean rank above generic shops and clinics when names tie. */
const TYPE_WEIGHT: Record<string, number> = {
  university: 5,
  mall: 5,
  attraction: 5,
  museum: 5,
  castle: 5,
  fort: 5,
  monument: 5,
  airport: 5,
  train_station: 5,
  stadium: 4,
  zoo: 4,
  theatre: 4,
  hospital: 4,
  suburb: 4,
  square: 4,
  hotel: 3,
  park: 3,
  neighbourhood: 3,
  college: 3,
  place_of_worship: 2,
  marketplace: 2,
};
export const placeWeight = (p: Place) => TYPE_WEIGHT[p.type] ?? 1;

/** Resolves pasted/shared input to coordinates using only local data (no network). */
export function createPlaceResolver(places: Place[]) {
  const index = createSearchIndex(places, (p) => [p.en, p.ar, ...(p.aliases ?? [])], placeWeight);

  function searchPlaces(query: string, limit = 8): ResolvedPlace[] {
    return index.search(query, limit).map((m) => toResolved(m.item));
  }

  function fromName(query: string): ResolveResult {
    const hits = index.search(query, 5);
    const first = hits[0];
    if (!first) return { status: 'not-found', query };
    // A clearly better first hit wins; otherwise the user chooses.
    const second = hits[1];
    if (first.score <= 1 && (!second || second.score > first.score)) {
      return { status: 'resolved', place: toResolved(first.item) };
    }
    return { status: 'ambiguous', candidates: hits.map((h) => toResolved(h.item)) };
  }

  function resolve(input: string): ResolveResult {
    const text = input.trim();
    if (!text) return { status: 'empty' };

    // Shared text carries a name even when the link is an unresolvable short link.
    const shared = parseSharedText(text);
    const parsed = parsePlaceInput(shared.url ?? text);
    if (parsed?.kind === 'coords') {
      return {
        status: 'resolved',
        place: {
          name: parsed.label ?? shared.name ?? '',
          point: parsed.point,
          source: 'coordinates',
        },
      };
    }
    if (shared.url && parsed?.kind === 'short') {
      for (const candidate of [shared.name, shared.address]) {
        if (!candidate) continue;
        const r = fromName(candidate);
        if (r.status !== 'not-found') return r;
      }
      return { status: 'needs-name', url: shared.url };
    }
    const query = parsed?.kind === 'text' ? parsed.query : (shared.name ?? text);
    return fromName(query);
  }

  return { resolve, searchPlaces };
}
