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

  it('turns a diagonal trip to fill a tall box, start at the top', () => {
    const pts = [
      { lat: 30.0, lng: 31.0 },
      { lat: 30.05, lng: 31.05 },
      { lat: 30.1, lng: 31.1 },
    ];
    const box = { x: 0, y: 0, w: 300, h: 900 };
    const plain = fitView(pts, box, 20);
    const turned = fitView(pts, box, 20, true);
    expect(turned.angle).not.toBe(0);
    const span = (v: typeof plain) =>
      Math.abs(v(pts[2]!.lat, pts[2]!.lng).y - v(pts[0]!.lat, pts[0]!.lng).y);
    expect(span(turned)).toBeGreaterThan(span(plain) * 1.5);
    expect(turned(pts[0]!.lat, pts[0]!.lng).y).toBeLessThan(turned(pts[2]!.lat, pts[2]!.lng).y);
  });

  it('leaves a trip that already fits unturned', () => {
    const pts = [
      { lat: 29.9, lng: 31.3 },
      { lat: 30.0, lng: 31.3 },
      { lat: 30.1, lng: 31.3 },
    ];
    expect(fitView(pts, { x: 0, y: 0, w: 300, h: 900 }, 20, true).angle).toBe(0);
  });

  it('does not blow up on a single point', () => {
    const view = fitView([{ lat: 30, lng: 31 }], { x: 0, y: 0, w: 200, h: 200 }, 10);
    const { x, y } = view(30, 31);
    expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
  });
});
