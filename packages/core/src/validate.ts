import { haversineMeters } from './geo';
import type { MetroData } from './types';

export interface ValidationIssue {
  severity: 'error' | 'warning';
  code: string;
  message: string;
}

export interface ValidateOptions {
  /** Expected distinct stations per line, e.g. { L1: 35 }. */
  expectedLineCounts?: Record<string, number>;
  /** [south, west, north, east] */
  bounds?: [number, number, number, number];
}

const GREATER_CAIRO: [number, number, number, number] = [29.7, 30.9, 30.3, 31.6];
const hasArabic = (s: string) => /[\u0600-\u06FF]/.test(s);

export function validateMetroData(data: MetroData, opts: ValidateOptions = {}): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (severity: ValidationIssue['severity'], code: string, message: string) =>
    issues.push({ severity, code, message });
  const [south, west, north, east] = opts.bounds ?? GREATER_CAIRO;

  const ids = new Set<string>();
  for (const s of data.stations) {
    if (ids.has(s.id)) add('error', 'duplicate-id', `Duplicate station id "${s.id}"`);
    ids.add(s.id);
    if (!s.name.en.trim()) add('error', 'missing-name-en', `${s.id}: English name missing`);
    else if (hasArabic(s.name.en))
      add('error', 'name-en-arabic', `${s.id}: English name has Arabic`);
    if (!s.name.ar.trim()) add('error', 'missing-name-ar', `${s.id}: Arabic name missing`);
    else if (!hasArabic(s.name.ar))
      add('error', 'name-ar-latin', `${s.id}: Arabic name not Arabic`);
    if (s.lat < south || s.lat > north || s.lng < west || s.lng > east) {
      add('error', 'out-of-bounds', `${s.id}: coordinates outside Greater Cairo`);
    }
    const lineCount = new Set(s.lines.map((l) => l.line)).size;
    if (lineCount === 0) add('error', 'no-line', `${s.id}: not on any line`);
    if (s.interchange !== lineCount > 1) {
      add('error', 'interchange-flag', `${s.id}: interchange flag does not match its lines`);
    }
    if (s.interchange && (s.transferSec === null || s.transferSec <= 0)) {
      add('error', 'transfer-time', `${s.id}: interchange without transfer time`);
    }
  }

  const referenced = new Set<string>();
  const adjacency = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    if (!adjacency.has(a)) adjacency.set(a, new Set());
    if (!adjacency.has(b)) adjacency.set(b, new Set());
    adjacency.get(a)!.add(b);
    adjacency.get(b)!.add(a);
  };
  const byId = new Map(data.stations.map((s) => [s.id, s]));

  for (const line of data.lines) {
    const lineStations = new Set<string>();
    for (const branch of line.branches) {
      branch.stations.forEach((id) => {
        lineStations.add(id);
        referenced.add(id);
        if (!byId.has(id)) add('error', 'unknown-station', `${branch.id}: unknown station "${id}"`);
      });
      if (branch.segments.length !== branch.stations.length - 1) {
        add('error', 'segment-count', `${branch.id}: segments do not match stations`);
      }
      branch.segments.forEach((seg, i) => {
        if (seg.from !== branch.stations[i] || seg.to !== branch.stations[i + 1]) {
          add('error', 'segment-order', `${branch.id}: segment ${i} is out of order`);
        }
        link(seg.from, seg.to);
        const a = byId.get(seg.from);
        const b = byId.get(seg.to);
        if (a && b) {
          const d = haversineMeters(a, b);
          if (d < 250 || d > 6000) {
            add('warning', 'segment-distance', `${seg.from} -> ${seg.to}: ${Math.round(d)} m`);
          }
        }
        if (seg.rideSec <= 0) add('error', 'ride-time', `${seg.from} -> ${seg.to}: ride time <= 0`);
      });
    }
    const expected = opts.expectedLineCounts?.[line.id];
    if (expected !== undefined && lineStations.size !== expected) {
      add('error', 'line-count', `${line.id}: ${lineStations.size} stations, expected ${expected}`);
    }
  }

  for (const s of data.stations) {
    if (!referenced.has(s.id)) add('error', 'orphan', `${s.id}: not part of any branch`);
  }

  // Connectivity (interchanges are single nodes, so no extra edges are needed).
  const start = data.stations[0]?.id;
  if (start) {
    const seen = new Set([start]);
    const queue = [start];
    while (queue.length) {
      for (const next of adjacency.get(queue.pop()!) ?? []) {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    if (seen.size !== data.stations.length) {
      add(
        'error',
        'disconnected',
        `Network is not connected (${seen.size}/${data.stations.length})`,
      );
    }
  }

  return issues;
}
