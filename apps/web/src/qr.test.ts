import jsQR from 'jsqr';
import { describe, expect, it } from 'vitest';
import { QR_MAX_BYTES, qrMatrix } from './qr';

/** Renders the matrix to RGBA pixels the way a camera frame would look, then decodes it. */
function decode(matrix: boolean[][]): string | null {
  const scale = 4;
  const quiet = 4;
  const n = (matrix.length + quiet * 2) * scale;
  const px = new Uint8ClampedArray(n * n * 4).fill(255);
  matrix.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (!dark) return;
      for (let dy = 0; dy < scale; dy++)
        for (let dx = 0; dx < scale; dx++) {
          const i = (((y + quiet) * scale + dy) * n + (x + quiet) * scale + dx) * 4;
          px[i] = px[i + 1] = px[i + 2] = 0;
        }
    }),
  );
  return jsQR(px, n, n)?.data ?? null;
}

describe('qr generator', () => {
  const link =
    'https://shawkyebrahim2514.github.io/cairo-metro/#/plan?from=s.el-monib&to=s.adly-mansour';
  const samples = [
    'a',
    'Cairo Metro',
    link,
    link + '&x=' + 'z'.repeat(60),
    'محطة السادات '.repeat(8),
    'x'.repeat(QR_MAX_BYTES),
  ];

  it.each(samples.map((s) => [s.slice(0, 24) + '… (' + s.length + ')', s]))(
    'round-trips %s through a real QR decoder',
    (_name, text) => {
      const m = qrMatrix(text);
      expect(m).not.toBeNull();
      expect(decode(m!)).toBe(text);
    },
  );

  it('refuses text that does not fit', () => {
    expect(qrMatrix('x'.repeat(QR_MAX_BYTES + 1))).toBeNull();
  });
});
