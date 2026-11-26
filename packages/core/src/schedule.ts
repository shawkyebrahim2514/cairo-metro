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
  /** Next upcoming last-train terminal departure ("HH:MM"), or null if all have departed. */
  lastTrain: string | null;
}

export interface ServiceOptions {
  /** IANA time zone (e.g. 'Africa/Cairo'); defaults to the Date's local time zone. */
  timeZone?: string;
}

const CLOSING_SOON_MIN = 45;
const FALLBACK_END = '00:00';
/** Approximate run-out minutes after the last terminal departure when serviceEnds is unspecified. */
const FALLBACK_RUNOUT_MIN = 45;

const toMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/** Minutes since the start of the service day (05:00); times after midnight count as 24h+. */
const dayMin = (minutes: number): number => (minutes < 5 * 60 ? minutes + 24 * 60 : minutes);

function clockMinutes(now: Date, timeZone?: string): number {
  if (!timeZone) return now.getHours() * 60 + now.getMinutes();
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now);
    const h = Number(parts.find((p) => p.type === 'hour')?.value ?? now.getHours()) % 24;
    const m = Number(parts.find((p) => p.type === 'minute')?.value ?? now.getMinutes());
    return h * 60 + m;
  } catch {
    return now.getHours() * 60 + now.getMinutes();
  }
}

/**
 * Service state for one line at a local time. Published times are estimates and vary by season,
 * so "closing-soon" is only a nudge to double-check, not a guarantee.
 */
export function lineService(
  hours: HoursData,
  line: LineId,
  now: Date,
  options?: ServiceOptions,
): LineService | null {
  const h = hours.lines[line];
  if (!h) return null;
  const at = dayMin(clockMinutes(now, options?.timeZone));
  const start = dayMin(toMin(h.firstTrain));
  const sortedLast = h.lastTrains
    .map((t) => ({ time: t.time, min: dayMin(toMin(t.time)) }))
    .sort((a, b) => a.min - b.min);
  const earliestLast = sortedLast[0] ?? null;
  const latestLast = sortedLast[sortedLast.length - 1] ?? null;
  const end = h.serviceEnds
    ? dayMin(toMin(h.serviceEnds))
    : latestLast
      ? latestLast.min + FALLBACK_RUNOUT_MIN
      : dayMin(toMin(FALLBACK_END));
  const warnFrom = (earliestLast?.min ?? end) - CLOSING_SOON_MIN;

  let state: ServiceState = 'open';
  if (at < start || at > Math.max(end, latestLast?.min ?? end)) state = 'closed';
  else if (at >= warnFrom) state = 'closing-soon';

  // Pick the earliest terminal last train that hasn't departed yet; null once all have departed.
  const upcomingLast = sortedLast.find((t) => t.min >= at)?.time ?? null;
  const headway = h.headwayMinutes;
  return {
    line,
    state,
    headway,
    avgWaitMin: headway ? (headway.min + headway.max) / 4 : null,
    lastTrain: upcomingLast,
  };
}

const RANK: Record<ServiceState, number> = { open: 0, 'closing-soon': 1, closed: 2 };

/** Service for every line a trip uses, plus the worst state. */
export function tripService(
  hours: HoursData,
  lines: LineId[],
  now: Date,
  options?: ServiceOptions,
): { state: ServiceState; lines: LineService[] } {
  const items = [...new Set(lines)]
    .map((l) => lineService(hours, l, now, options))
    .filter((s): s is LineService => s !== null);
  const state = items.reduce<ServiceState>(
    (worst, s) => (RANK[s.state] > RANK[worst] ? s.state : worst),
    'open',
  );
  return { state, lines: items };
}
