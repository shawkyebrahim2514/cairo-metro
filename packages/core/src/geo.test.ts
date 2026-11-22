import { describe, expect, it } from 'vitest';
import { haversineMeters } from './geo';

describe('haversineMeters', () => {
  it('is zero for identical points', () => {
    const p = { lat: 30.0444, lng: 31.2357 };
    expect(haversineMeters(p, p)).toBe(0);
  });

  it('measures Tahrir Square to Giza Pyramids (~13 km)', () => {
    const tahrir = { lat: 30.0444, lng: 31.2357 };
    const pyramids = { lat: 29.9792, lng: 31.1342 };
    const d = haversineMeters(tahrir, pyramids);
    expect(d).toBeGreaterThan(11_000);
    expect(d).toBeLessThan(13_000);
  });
});
