import type { LatLng, Station } from '@cairo-metro/core';
import { stationsById } from './data';
import { stationName, type I18n, type Lang } from './i18n';

export type Endpoint =
  { kind: 'station'; station: Station } | { kind: 'point'; point: LatLng; name: string };

/** Compact text form used in shareable links and saved trips: `s.<stationId>` or `p.<lat>,<lng>,<name>`. */
export function encodeEndpoint(e: Endpoint): string {
  return e.kind === 'station'
    ? `s.${e.station.id}`
    : `p.${e.point.lat.toFixed(5)},${e.point.lng.toFixed(5)},${e.name}`;
}

export function decodeEndpoint(text: string | null | undefined): Endpoint | null {
  if (!text) return null;
  if (text.startsWith('s.')) {
    const station = stationsById.get(text.slice(2));
    return station ? { kind: 'station', station } : null;
  }
  if (text.startsWith('p.')) {
    const [lat, lng, ...name] = text.slice(2).split(',');
    const point = { lat: Number(lat), lng: Number(lng) };
    if (!lat || !lng || !Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return null;
    return { kind: 'point', point, name: name.join(',') };
  }
  return null;
}

export const endpointPoint = (e: Endpoint): LatLng =>
  e.kind === 'station' ? { lat: e.station.lat, lng: e.station.lng } : e.point;

export const endpointName = (e: Endpoint, lang: Lang): string =>
  e.kind === 'station' ? stationName(e.station, lang) : e.name;

export const pinned = (point: LatLng, t: I18n['t']): Endpoint => ({
  kind: 'point',
  point,
  name: t('pinned'),
});
