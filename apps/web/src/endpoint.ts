import type { LatLng, Station } from '@cairo-metro/core';
import { stationName, type I18n, type Lang } from './i18n';

export type Endpoint =
  { kind: 'station'; station: Station } | { kind: 'point'; point: LatLng; name: string };

export const endpointPoint = (e: Endpoint): LatLng =>
  e.kind === 'station' ? { lat: e.station.lat, lng: e.station.lng } : e.point;

export const endpointName = (e: Endpoint, lang: Lang): string =>
  e.kind === 'station' ? stationName(e.station, lang) : e.name;

export const pinned = (point: LatLng, t: I18n['t']): Endpoint => ({
  kind: 'point',
  point,
  name: t('pinned'),
});
