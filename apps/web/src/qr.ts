// Minimal QR Code generator (byte mode, error correction level L, versions 1-10),
// written in-house to keep the app free of runtime dependencies.

type Block = [count: number, dataBytes: number];
interface VersionSpec {
  ecPerBlock: number;
  blocks: Block[];
  align: number[];
}

const SPECS: Record<number, VersionSpec> = {
  1: { ecPerBlock: 7, blocks: [[1, 19]], align: [] },
  2: { ecPerBlock: 10, blocks: [[1, 34]], align: [6, 18] },
  3: { ecPerBlock: 15, blocks: [[1, 55]], align: [6, 22] },
  4: { ecPerBlock: 20, blocks: [[1, 80]], align: [6, 26] },
  5: { ecPerBlock: 26, blocks: [[1, 108]], align: [6, 30] },
  6: { ecPerBlock: 18, blocks: [[2, 68]], align: [6, 34] },
  7: { ecPerBlock: 20, blocks: [[2, 78]], align: [6, 22, 38] },
  8: { ecPerBlock: 24, blocks: [[2, 97]], align: [6, 24, 42] },
  9: { ecPerBlock: 30, blocks: [[2, 116]], align: [6, 26, 46] },
  10: {
    ecPerBlock: 18,
    blocks: [
      [2, 68],
      [2, 69],
    ],
    align: [6, 28, 50],
  },
};

const dataCodewords = (v: number) => SPECS[v]!.blocks.reduce((s, [c, d]) => s + c * d, 0);
const bit = (value: number, i: number) => ((value >>> i) & 1) !== 0;

// Reed-Solomon over GF(256) with polynomial 0x11d.
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]!;
}
const gfMul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : EXP[LOG[a]! + LOG[b]!]!);

function rsRemainder(data: number[], degree: number): number[] {
  let gen = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array<number>(gen.length + 1).fill(0);
    gen.forEach((c, j) => {
      next[j] = next[j]! ^ gfMul(c, EXP[i]!);
      next[j + 1] = next[j + 1]! ^ c;
    });
    gen = next;
  }
  // gen is little-endian (x^0 first) and monic; use it from the highest power down.
  const g = gen.slice(0, degree).reverse();
  const rem = new Array<number>(degree).fill(0);
  for (const b of data) {
    const factor = b ^ rem.shift()!;
    rem.push(0);
    g.forEach((c, i) => {
      rem[i] = rem[i]! ^ gfMul(c, factor);
    });
  }
  return rem;
}

function encodeData(bytes: Uint8Array, version: number): number[] {
  const bits: number[] = [];
  const push = (value: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  push(0b0100, 4);
  push(bytes.length, version < 10 ? 8 : 16);
  bytes.forEach((b) => push(b, 8));
  const capacity = dataCodewords(version) * 8;
  push(0, Math.min(4, capacity - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);
  const out: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    out.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  }
  for (let pad = 0xec; out.length < dataCodewords(version); pad ^= 0xec ^ 0x11) out.push(pad);
  return out;
}

function interleave(data: number[], version: number): number[] {
  const { ecPerBlock, blocks } = SPECS[version]!;
  const dataBlocks: number[][] = [];
  let at = 0;
  for (const [count, size] of blocks) {
    for (let i = 0; i < count; i++) {
      dataBlocks.push(data.slice(at, at + size));
      at += size;
    }
  }
  const ecBlocks = dataBlocks.map((b) => rsRemainder(b, ecPerBlock));
  const out: number[] = [];
  const longest = Math.max(...dataBlocks.map((b) => b.length));
  for (let i = 0; i < longest; i++) for (const b of dataBlocks) if (i < b.length) out.push(b[i]!);
  for (let i = 0; i < ecPerBlock; i++) for (const b of ecBlocks) out.push(b[i]!);
  return out;
}

const MASKS: ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

class Grid {
  readonly size: number;
  readonly modules: boolean[][];
  readonly isFunction: boolean[][];

  constructor(public readonly version: number) {
    this.size = 17 + 4 * version;
    this.modules = Array.from({ length: this.size }, () =>
      new Array<boolean>(this.size).fill(false),
    );
    this.isFunction = Array.from({ length: this.size }, () =>
      new Array<boolean>(this.size).fill(false),
    );
  }

  private set(x: number, y: number, dark: boolean) {
    this.modules[y]![x] = dark;
    this.isFunction[y]![x] = true;
  }

  drawFunctionPatterns() {
    const { size } = this;
    for (let i = 0; i < size; i++) {
      this.set(6, i, i % 2 === 0);
      this.set(i, 6, i % 2 === 0);
    }
    for (const [cx, cy] of [
      [3, 3],
      [size - 4, 3],
      [3, size - 4],
    ] as const) {
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          const x = cx + dx;
          const y = cy + dy;
          if (x < 0 || y < 0 || x >= size || y >= size) continue;
          const dist = Math.max(Math.abs(dx), Math.abs(dy));
          this.set(x, y, dist !== 2 && dist !== 4);
        }
      }
    }
    const pos = SPECS[this.version]!.align;
    const last = pos.length - 1;
    pos.forEach((py, i) =>
      pos.forEach((px, j) => {
        if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
        for (let dy = -2; dy <= 2; dy++)
          for (let dx = -2; dx <= 2; dx++)
            this.set(px + dx, py + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }),
    );
    this.drawFormat(0);
    if (this.version >= 7) this.drawVersion();
  }

  drawFormat(mask: number) {
    const { size } = this;
    const data = (0b01 << 3) | mask; // level L
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;
    for (let i = 0; i <= 5; i++) this.set(8, i, bit(bits, i));
    this.set(8, 7, bit(bits, 6));
    this.set(8, 8, bit(bits, 7));
    this.set(7, 8, bit(bits, 8));
    for (let i = 9; i < 15; i++) this.set(14 - i, 8, bit(bits, i));
    for (let i = 0; i < 8; i++) this.set(size - 1 - i, 8, bit(bits, i));
    for (let i = 8; i < 15; i++) this.set(8, size - 15 + i, bit(bits, i));
    this.set(8, size - 8, true);
  }

  private drawVersion() {
    let rem = this.version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (this.version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const a = this.size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      this.set(a, b, bit(bits, i));
      this.set(b, a, bit(bits, i));
    }
  }

  drawCodewords(data: number[]) {
    const { size } = this;
    let i = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? size - 1 - vert : vert;
          if (!this.isFunction[y]![x] && i < data.length * 8) {
            this.modules[y]![x] = bit(data[i >>> 3]!, 7 - (i & 7));
            i++;
          }
        }
      }
    }
  }

  applyMask(mask: number) {
    for (let y = 0; y < this.size; y++)
      for (let x = 0; x < this.size; x++)
        if (!this.isFunction[y]![x] && MASKS[mask]!(x, y))
          this.modules[y]![x] = !this.modules[y]![x];
  }

  penalty(): number {
    const { size, modules: m } = this;
    let score = 0;
    const line = (get: (i: number) => boolean) => {
      let run = 1;
      for (let i = 1; i < size; i++) {
        if (get(i) === get(i - 1)) {
          run++;
          if (run === 5) score += 3;
          else if (run > 5) score += 1;
        } else run = 1;
      }
      const s = Array.from({ length: size }, (_, i) => (get(i) ? '1' : '0')).join('');
      for (const pat of ['10111010000', '00001011101']) {
        let at = s.indexOf(pat);
        while (at !== -1) {
          score += 40;
          at = s.indexOf(pat, at + 1);
        }
      }
    };
    for (let y = 0; y < size; y++) line((x) => m[y]![x]!);
    for (let x = 0; x < size; x++) line((y) => m[y]![x]!);
    for (let y = 0; y < size - 1; y++)
      for (let x = 0; x < size - 1; x++) {
        const c = m[y]![x]!;
        if (c === m[y]![x + 1] && c === m[y + 1]![x] && c === m[y + 1]![x + 1]) score += 3;
      }
    const dark = m.reduce((s, row) => s + row.filter(Boolean).length, 0);
    const total = size * size;
    score += Math.floor(Math.abs(dark * 20 - total * 10) / total) * 10;
    return score;
  }
}

/** The most bytes of text that fit in the largest supported symbol. */
export const QR_MAX_BYTES = Math.floor((dataCodewords(10) * 8 - 4 - 16) / 8);

/** Returns the QR matrix (true = dark) for the text, or null when it is too long. */
export function qrMatrix(text: string): boolean[][] | null {
  const bytes = new TextEncoder().encode(text);
  let version = 0;
  for (let v = 1; v <= 10; v++) {
    const countBits = v < 10 ? 8 : 16;
    if (4 + countBits + bytes.length * 8 <= dataCodewords(v) * 8) {
      version = v;
      break;
    }
  }
  if (version === 0) return null;

  const codewords = interleave(encodeData(bytes, version), version);
  const grid = new Grid(version);
  grid.drawFunctionPatterns();
  grid.drawCodewords(codewords);

  let best = 0;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    grid.applyMask(mask);
    grid.drawFormat(mask);
    const score = grid.penalty();
    if (score < bestScore) {
      best = mask;
      bestScore = score;
    }
    grid.applyMask(mask);
  }
  grid.applyMask(best);
  grid.drawFormat(best);
  return grid.modules;
}

/** SVG path data for the dark modules, with a 4-module quiet zone. Pair with viewBox `0 0 n n`. */
export function qrPath(matrix: boolean[][], quiet = 4): { d: string; size: number } {
  const parts: string[] = [];
  matrix.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (!row[x]) {
        x++;
        continue;
      }
      const start = x;
      while (x < row.length && row[x]) x++;
      parts.push(`M${start + quiet} ${y + quiet}h${x - start}v1h${start - x}z`);
    }
  });
  return { d: parts.join(''), size: matrix.length + quiet * 2 };
}
