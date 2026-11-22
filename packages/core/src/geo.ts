export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6_371_008.8;
const toRad = (deg: number) => (deg * Math.PI) / 180;

export interface BBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

/** Generous box around Greater Cairo. */
export const GREATER_CAIRO_BBOX: BBox = { south: 29.6, west: 30.8, north: 30.4, east: 31.8 };

export function inBBox(p: LatLng, box: BBox): boolean {
  return p.lat >= box.south && p.lat <= box.north && p.lng >= box.west && p.lng <= box.east;
}

export function bboxOf(points: LatLng[]): BBox | null {
  if (points.length === 0) return null;
  return {
    south: Math.min(...points.map((p) => p.lat)),
    north: Math.max(...points.map((p) => p.lat)),
    west: Math.min(...points.map((p) => p.lng)),
    east: Math.max(...points.map((p) => p.lng)),
  };
}

/** Great-circle distance in meters. */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}
