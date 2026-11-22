import { ticketPrice, type FaresData, type TicketCategory } from './fares';
import type { Branch, LineId, MetroData } from './types';

export type RouteMode = 'fastest' | 'fewest-transfers';

export interface RouteOptions {
  mode?: RouteMode;
  /** Extra cost (seconds) added per change of train, on top of the walking time. */
  transferPenaltySec?: number;
  /** Walking time used when an interchange has no transferSec. */
  defaultTransferSec?: number;
  /** Time to change trains between two branches of one line (e.g. Kit-Kat). */
  branchChangeSec?: number;
}

type EdgeKind = 'ride' | 'through' | 'transfer' | 'branch-change';

interface Node {
  stationId: string;
  line: LineId;
  branchId: string;
}

interface Edge {
  to: number;
  sec: number;
  kind: EdgeKind;
  /** Ride edges only: 1 when travelling toward the branch end, -1 toward its start. */
  dir?: 1 | -1;
}

export interface MetroGraph {
  data: MetroData;
  nodes: Node[];
  adj: Edge[][];
  nodesByStation: Map<string, number[]>;
  branches: Map<string, Branch>;
}

export interface RouteLeg {
  line: LineId;
  /** Station ids in travel order, origin of the leg first. */
  stations: string[];
  /** Number of stations travelled to (excludes the boarding station). */
  stops: number;
  rideSec: number;
  /** Terminal station id(s) the train is heading to. */
  towards: string[];
}

export interface RouteTransfer {
  stationId: string;
  fromLine: LineId;
  toLine: LineId;
  sec: number;
}

export interface Route {
  mode: RouteMode;
  from: string;
  to: string;
  legs: RouteLeg[];
  transfers: RouteTransfer[];
  /** All station ids passed, in order, without repeats at transfers. */
  stations: string[];
  stops: number;
  rideSec: number;
  transferSec: number;
  totalSec: number;
  /** Ticket price in EGP, when fares were provided. */
  fare: number | null;
  /** Times come from distance estimates, not a timetable. */
  estimated: true;
}

const DEFAULT_TRANSFER_SEC = 240;
const DEFAULT_BRANCH_CHANGE_SEC = 180;

export function buildGraph(data: MetroData, options: RouteOptions = {}): MetroGraph {
  const defaultTransfer = options.defaultTransferSec ?? DEFAULT_TRANSFER_SEC;
  const branchChange = options.branchChangeSec ?? DEFAULT_BRANCH_CHANGE_SEC;
  const nodes: Node[] = [];
  const index = new Map<string, number>();
  const nodesByStation = new Map<string, number[]>();
  const branches = new Map<string, Branch>();
  const key = (stationId: string, branchId: string) => `${stationId}|${branchId}`;

  for (const line of data.lines) {
    for (const branch of line.branches) {
      branches.set(branch.id, branch);
      for (const stationId of branch.stations) {
        const i = nodes.length;
        nodes.push({ stationId, line: line.id, branchId: branch.id });
        index.set(key(stationId, branch.id), i);
        const list = nodesByStation.get(stationId) ?? [];
        list.push(i);
        nodesByStation.set(stationId, list);
      }
    }
  }

  const adj: Edge[][] = nodes.map(() => []);

  for (const line of data.lines) {
    for (const branch of line.branches) {
      for (const seg of branch.segments) {
        const a = index.get(key(seg.from, branch.id));
        const b = index.get(key(seg.to, branch.id));
        if (a === undefined || b === undefined) continue;
        const forward = branch.stations.indexOf(seg.from) < branch.stations.indexOf(seg.to);
        adj[a]!.push({ to: b, sec: seg.rideSec, kind: 'ride', dir: forward ? 1 : -1 });
        adj[b]!.push({ to: a, sec: seg.rideSec, kind: 'ride', dir: forward ? -1 : 1 });
      }
    }
  }

  const stationById = new Map(data.stations.map((s) => [s.id, s]));
  for (const [stationId, list] of nodesByStation) {
    const transferSec = stationById.get(stationId)?.transferSec ?? defaultTransfer;
    for (const a of list) {
      for (const b of list) {
        if (a === b) continue;
        const na = nodes[a]!;
        const nb = nodes[b]!;
        if (na.line !== nb.line) {
          adj[a]!.push({ to: b, sec: transferSec, kind: 'transfer' });
        } else {
          // The first branch of a line is its trunk; trains run through between trunk and any branch.
          const trunk = data.lines.find((l) => l.id === na.line)!.branches[0]!.id;
          const through = na.branchId === trunk || nb.branchId === trunk;
          adj[a]!.push(
            through
              ? { to: b, sec: 0, kind: 'through' }
              : { to: b, sec: branchChange, kind: 'branch-change' },
          );
        }
      }
    }
  }

  return { data, nodes, adj, nodesByStation, branches };
}

const isChange = (k: EdgeKind) => k === 'transfer' || k === 'branch-change';

function shortestPath(
  graph: MetroGraph,
  from: string,
  to: string,
  penaltySec: number,
): { node: number; edge: Edge | null }[] | null {
  const starts = graph.nodesByStation.get(from);
  const ends = new Set(graph.nodesByStation.get(to));
  if (!starts || ends.size === 0) return null;

  // State = node * 2 + (1 if the last move was a trunk<->branch "through" link).
  // Two through links in a row would let a train hop between two branches via the trunk
  // for free, which is not a real service, so that is disallowed.
  const n = graph.nodes.length * 2;
  const dist = new Array<number>(n).fill(Infinity);
  const prev = new Array<{ state: number; edge: Edge } | null>(n).fill(null);
  const done = new Array<boolean>(n).fill(false);
  for (const s of starts) dist[s * 2] = 0;

  // The graph has ~100 nodes, so a linear scan beats a heap in simplicity at no real cost.
  for (;;) {
    let u = -1;
    for (let i = 0; i < n; i++)
      if (!done[i] && dist[i]! < Infinity && (u < 0 || dist[i]! < dist[u]!)) u = i;
    if (u < 0) return null;
    if (ends.has(u >> 1)) {
      // Each step records the edge that arrives at its node (null for the start).
      const path: { node: number; edge: Edge | null }[] = [];
      let cur = u;
      for (;;) {
        const p = prev[cur] ?? null;
        path.push({ node: cur >> 1, edge: p ? p.edge : null });
        if (!p) break;
        cur = p.state;
      }
      return path.reverse();
    }
    done[u] = true;
    const wasThrough = (u & 1) === 1;
    for (const e of graph.adj[u >> 1]!) {
      if (e.kind === 'through' && wasThrough) continue;
      const next = e.to * 2 + (e.kind === 'through' ? 1 : 0);
      const w = dist[u]! + e.sec + (isChange(e.kind) ? penaltySec : 0);
      if (w < dist[next]!) {
        dist[next] = w;
        prev[next] = { state: u, edge: e };
      }
    }
  }
}
function terminalsToward(graph: MetroGraph, branchId: string, dir: 1 | -1): string[] {
  const branch = graph.branches.get(branchId)!;
  const end = dir === 1 ? branch.stations[branch.stations.length - 1]! : branch.stations[0]!;
  const line = graph.data.lines.find((l) => l.branches.some((b) => b.id === branchId))!;
  const trunk = line.branches[0]!;
  if (branchId === trunk.id && dir === 1) {
    // Heading to a junction: trains continue onto every branch that starts here.
    const onward = line.branches.slice(1).filter((b) => b.stations[0] === end);
    if (onward.length > 0) return onward.map((b) => b.stations[b.stations.length - 1]!);
  }
  return [end];
}

function toRoute(
  graph: MetroGraph,
  path: { node: number; edge: Edge | null }[],
  mode: RouteMode,
  fares?: FaresData,
  category?: TicketCategory,
): Route {
  const legs: RouteLeg[] = [];
  const transfers: RouteTransfer[] = [];
  const stations: string[] = [graph.nodes[path[0]!.node]!.stationId];
  let leg: RouteLeg | null = null;
  let lastRide: { branchId: string; dir: 1 | -1 } | null = null;

  const closeLeg = () => {
    if (leg && lastRide) leg.towards = terminalsToward(graph, lastRide.branchId, lastRide.dir);
    leg = null;
  };

  for (let i = 1; i < path.length; i++) {
    const prevNode = graph.nodes[path[i - 1]!.node]!;
    const node = graph.nodes[path[i]!.node]!;
    const edge = path[i]!.edge!;
    if (edge.kind === 'ride') {
      if (!leg) {
        leg = {
          line: node.line,
          stations: [prevNode.stationId],
          stops: 0,
          rideSec: 0,
          towards: [],
        };
        legs.push(leg);
      }
      leg.stations.push(node.stationId);
      leg.stops++;
      leg.rideSec += edge.sec;
      lastRide = { branchId: node.branchId, dir: edge.dir! };
      stations.push(node.stationId);
    } else if (edge.kind === 'through') {
      continue;
    } else {
      closeLeg();
      transfers.push({
        stationId: node.stationId,
        fromLine: prevNode.line,
        toLine: node.line,
        sec: edge.sec,
      });
    }
  }
  closeLeg();

  const rideSec = legs.reduce((s, l) => s + l.rideSec, 0);
  const transferSec = transfers.reduce((s, t) => s + t.sec, 0);
  const stops = legs.reduce((s, l) => s + l.stops, 0);
  return {
    mode,
    from: stations[0]!,
    to: stations[stations.length - 1]!,
    legs,
    transfers,
    stations,
    stops,
    rideSec,
    transferSec,
    totalSec: rideSec + transferSec,
    fare: fares && stops > 0 ? ticketPrice(fares, stops, category) : null,
    estimated: true,
  };
}

/** Plan a single route. Returns null when either station is unknown or unreachable. */
export function planRoute(
  graph: MetroGraph,
  from: string,
  to: string,
  options: RouteOptions & { fares?: FaresData; fareCategory?: TicketCategory } = {},
): Route | null {
  const mode = options.mode ?? 'fastest';
  const penalty = options.transferPenaltySec ?? (mode === 'fewest-transfers' ? 1800 : 0);
  if (from === to) {
    return graph.nodesByStation.has(from)
      ? {
          mode,
          from,
          to,
          legs: [],
          transfers: [],
          stations: [from],
          stops: 0,
          rideSec: 0,
          transferSec: 0,
          totalSec: 0,
          fare: null,
          estimated: true,
        }
      : null;
  }
  const path = shortestPath(graph, from, to, penalty);
  return path ? toRoute(graph, path, mode, options.fares, options.fareCategory) : null;
}

/** Fastest route plus, when it differs, the route with the fewest transfers. */
export function planRoutes(
  graph: MetroGraph,
  from: string,
  to: string,
  options: Omit<RouteOptions, 'mode'> & { fares?: FaresData; fareCategory?: TicketCategory } = {},
): Route[] {
  const fastest = planRoute(graph, from, to, { ...options, mode: 'fastest' });
  if (!fastest) return [];
  const fewest = planRoute(graph, from, to, { ...options, mode: 'fewest-transfers' });
  if (fewest && fewest.transfers.length < fastest.transfers.length) return [fastest, fewest];
  return [fastest];
}
