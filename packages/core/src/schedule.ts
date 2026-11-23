import type { LineId } from './types';

export interface LineHours {
  firstTrain: string;
  lastTrains: { from: string; to: string; time: string }[];
  /** Time the line stops serving passengers (may be after midnight). */
  serviceEnds: string | null;
  headwayMinutes: { min: number; max: number } | null;
}

export interface HoursData {
  lines: Record<string, LineHours>;
}

export type ServiceState = 'open' | 'closing-soon' | 'closed';

export interface LineService {
  line: LineId;
  state: ServiceState;
  headway: { min: number; max: number } | null;
  /** Average wait for a train, assuming riders arrive at random. */
  avgWaitMin: number | null;
  /** Local "HH:MM" of the last train leaving a terminal, as published. */
  lastTrain: string | null;
}

const CLOSING_SOON_MIN = 45;
const FALLBACK_END = '00:00';

const toMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/** Minutes since the start of the service day (05:00); times after midnight count as 24h+. */
const dayMin = (minutes: number): number => (minutes < 5 * 60 ? minutes + 24 * 60 : minutes);

/**
 * Service state for one line at a local time. Published times are estimates and vary by season,
 * so "closing-soon" is only a nudge to double-check, not a guarantee.
 */
export function lineService(hours: HoursData, line: LineId, now: Date): LineService | null {
  const h = hours.lines[line];
  if (!h) return null;
  const at = dayMin(now.getHours() * 60 + now.getMinutes());
  const start = dayMin(toMin(h.firstTrain));
  const end = dayMin(toMin(h.serviceEnds ?? FALLBACK_END));
  const lastTrains = h.lastTrains
    .map((t) => t.time)
    .sort((a, b) => dayMin(toMin(b)) - dayMin(toMin(a)));
  const lastTrain = lastTrains[0] ?? null;
  const lastMin = lastTrain ? dayMin(toMin(lastTrain)) : end;

  let state: ServiceState = 'open';
  if (at < start || at > Math.max(end, lastMin)) state = 'closed';
  else if (at >= lastMin - CLOSING_SOON_MIN) state = 'closing-soon';

  const headway = h.headwayMinutes;
  return {
    line,
    state,
    headway,
    avgWaitMin: headway ? (headway.min + headway.max) / 4 : null,
    lastTrain,
  };
}

const RANK: Record<ServiceState, number> = { open: 0, 'closing-soon': 1, closed: 2 };

/** Service for every line a trip uses, plus the worst state. */
export function tripService(
  hours: HoursData,
  lines: LineId[],
  now: Date,
): { state: ServiceState; lines: LineService[] } {
  const items = [...new Set(lines)]
    .map((l) => lineService(hours, l, now))
    .filter((s): s is LineService => s !== null);
  const state = items.reduce<ServiceState>(
    (worst, s) => (RANK[s.state] > RANK[worst] ? s.state : worst),
    'open',
  );
  return { state, lines: items };
}
