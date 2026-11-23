import type { LatLng } from '@cairo-metro/core';

const pair = (p: LatLng) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;

/** A link that opens the phone's maps app with a walking route; no data is sent until the user taps it. */
export function walkLink(from: LatLng, to: LatLng, ios: boolean): string {
  return ios
    ? `https://maps.apple.com/?saddr=${pair(from)}&daddr=${pair(to)}&dirflg=w`
    : `https://www.google.com/maps/dir/?api=1&origin=${pair(from)}&destination=${pair(to)}&travelmode=walking`;
}
