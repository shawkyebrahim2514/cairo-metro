import { describe, expect, it } from 'vitest';
import { fitView } from './tripImage';

describe('fitView', () => {
  it('projects points inside the box', () => {
    const view = fitView(
      [
        { lat: 30.0, lng: 31.2 },
        { lat: 30.05, lng: 31.3 },
      ],
      { x: 0, y: 0, w: 400, h: 300 },
      10,
    );
    for (const p of [
      { lat: 30.0, lng: 31.2 },
      { lat: 30.05, lng: 31.3 },
    ]) {
      const { x, y } = view(p.lat, p.lng);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(400);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(300);
    }
  });

  it('does not blow up on a single point', () => {
    const view = fitView([{ lat: 30, lng: 31 }], { x: 0, y: 0, w: 200, h: 200 }, 10);
    const { x, y } = view(30, 31);
    expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
  });
});
