import { describe, expect, it } from 'vitest';
import { walkLink } from './walkLink';

const a = { lat: 30.0444, lng: 31.2357 };
const b = { lat: 30.045, lng: 31.24 };

describe('walkLink', () => {
  it('builds a Google Maps walking route', () => {
    const url = new URL(walkLink(a, b, false));
    expect(url.host).toBe('www.google.com');
    expect(url.searchParams.get('travelmode')).toBe('walking');
    expect(url.searchParams.get('origin')).toBe('30.044400,31.235700');
    expect(url.searchParams.get('destination')).toBe('30.045000,31.240000');
  });

  it('builds an Apple Maps walking route on iOS', () => {
    const url = new URL(walkLink(a, b, true));
    expect(url.host).toBe('maps.apple.com');
    expect(url.searchParams.get('dirflg')).toBe('w');
    expect(url.searchParams.get('saddr')).toBe('30.044400,31.235700');
  });
});
