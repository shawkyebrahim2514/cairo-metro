import { metro } from './data';

export interface SPt {
  x: number;
  y: number;
}

/** Fixed spots on the diagram: terminals and every station where lines meet. */
const ANCHORS: Record<string, SPt> = {
  helwan: { x: 300, y: 1560 },
  sadat: { x: 400, y: 760 },
  nasser: { x: 400, y: 600 },
  'el-shohadaa': { x: 520, y: 480 },
  attaba: { x: 560, y: 600 },
  'new-el-marg': { x: 640, y: 60 },
  'shubra-el-kheima': { x: 440, y: 60 },
  'adly-mansour': { x: 880, y: 200 },
  'kit-kat': { x: 140, y: 460 },
  'cairo-university': { x: 140, y: 820 },
  'el-monib': { x: 140, y: 1180 },
  'rod-el-farag-axis': { x: 140, y: 100 },
};

type Step = string | [number, number];

/** Each branch runs through its anchors and bend points; stations between anchors are spread evenly along the path. */
const SPEC: Record<string, Step[]> = {
  'L1-main': [
    'helwan',
    [300, 960],
    [400, 860],
    'sadat',
    'nasser',
    'el-shohadaa',
    [520, 420],
    [640, 300],
    'new-el-marg',
  ],
  'L2-main': [
    'shubra-el-kheima',
    [440, 400],
    'el-shohadaa',
    [560, 520],
    'attaba',
    [560, 680],
    [480, 760],
    'sadat',
    [340, 820],
    'cairo-university',
    'el-monib',
  ],
  'L3-main': ['adly-mansour', [880, 480], [760, 600], 'attaba', 'nasser', [280, 600], 'kit-kat'],
  'L3-imbaba': ['kit-kat', 'rod-el-farag-axis'],
  'L3-cairo-univ': ['kit-kat', 'cairo-university'],
};

export interface Schematic {
  positions: Map<string, SPt>;
  /** Bend points between two neighbouring stations, in the order a to b. */
  bends: Map<string, SPt[]>;
  width: number;
  height: number;
}

function build(): Schematic {
  const positions = new Map<string, SPt>();
  const bends = new Map<string, SPt[]>();
  for (const [id, p] of Object.entries(ANCHORS)) positions.set(id, p);

  for (const line of metro.lines) {
    for (const branch of line.branches) {
      const spec = SPEC[branch.id];
      if (!spec) continue;
      const verts: SPt[] = spec.map((s) =>
        typeof s === 'string' ? ANCHORS[s]! : { x: s[0], y: s[1] },
      );
      const arcs: number[] = [0];
      for (let i = 1; i < verts.length; i++) {
        arcs.push(
          arcs[i - 1]! + Math.hypot(verts[i]!.x - verts[i - 1]!.x, verts[i]!.y - verts[i - 1]!.y),
        );
      }
      const at = (d: number): SPt => {
        for (let i = 1; i < verts.length; i++) {
          if (d <= arcs[i]! + 1e-6) {
            const span = arcs[i]! - arcs[i - 1]!;
            const k = span === 0 ? 0 : (d - arcs[i - 1]!) / span;
            return {
              x: verts[i - 1]!.x + (verts[i]!.x - verts[i - 1]!.x) * k,
              y: verts[i - 1]!.y + (verts[i]!.y - verts[i - 1]!.y) * k,
            };
          }
        }
        return verts[verts.length - 1]!;
      };

      const ids = branch.stations;
      const anchorAt: [number, number][] = []; // [station index, arc]
      spec.forEach((s, vi) => {
        if (typeof s !== 'string') return;
        const si = ids.indexOf(s);
        if (si >= 0) anchorAt.push([si, arcs[vi]!]);
      });
      const arcOf = new Map<number, number>();
      for (let a = 0; a + 1 < anchorAt.length; a++) {
        const [i, ai] = anchorAt[a]!;
        const [j, aj] = anchorAt[a + 1]!;
        for (let k = i; k <= j; k++) arcOf.set(k, ai + ((k - i) / (j - i)) * (aj - ai));
      }
      ids.forEach((id, k) => {
        const d = arcOf.get(k);
        if (d !== undefined && !positions.has(id)) positions.set(id, at(d));
      });
      for (let k = 0; k + 1 < ids.length; k++) {
        const d0 = arcOf.get(k);
        const d1 = arcOf.get(k + 1);
        if (d0 === undefined || d1 === undefined) continue;
        const between = verts.filter(
          (v, vi) => typeof spec[vi] !== 'string' && arcs[vi]! > d0 + 1e-6 && arcs[vi]! < d1 - 1e-6,
        );
        if (between.length) {
          bends.set(`${ids[k]}>${ids[k + 1]}`, between);
          bends.set(`${ids[k + 1]}>${ids[k]}`, [...between].reverse());
        }
      }
    }
  }

  let maxX = 0;
  let maxY = 0;
  for (const p of positions.values()) {
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { positions, bends, width: maxX, height: maxY };
}

export const schematic: Schematic = build();

/** The drawn path through consecutive stations, with the diagram's bends included. */
export function schematicPath(ids: string[]): SPt[] {
  const out: SPt[] = [];
  ids.forEach((id, i) => {
    if (i > 0) out.push(...(schematic.bends.get(`${ids[i - 1]}>${id}`) ?? []));
    const p = schematic.positions.get(id);
    if (p) out.push(p);
  });
  return out;
}
