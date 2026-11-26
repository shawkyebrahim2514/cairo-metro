import { describe, expect, it } from 'vitest';
import { lineService, tripService, type HoursData } from './schedule';

const hours: HoursData = {
  lines: {
    L1: {
      firstTrain: '05:15',
      lastTrains: [
        { from: 'Helwan', to: 'New El-Marg', time: '23:40' },
        { from: 'New El-Marg', to: 'Helwan', time: '23:45' },
      ],
      serviceEnds: '01:00',
      headwayMinutes: { min: 4, max: 4 },
    },
    L3: {
      firstTrain: '05:15',
      lastTrains: [
        { from: 'Adly Mansour', to: 'Rod El-Farag Axis', time: '23:29' },
        { from: 'Rod El-Farag Axis', to: 'Adly Mansour', time: '23:55' },
      ],
      serviceEnds: null,
      headwayMinutes: { min: 4, max: 8 },
    },
  },
};

const at = (hh: number, mm: number) => new Date(2026, 10, 23, hh, mm);

describe('lineService', () => {
  it('is open during the day with an average wait', () => {
    const s = lineService(hours, 'L1', at(12, 0))!;
    expect(s.state).toBe('open');
    expect(s.avgWaitMin).toBe(2);
    expect(lineService(hours, 'L3', at(12, 0))!.avgWaitMin).toBe(3);
  });

  it('warns shortly before the last train and closes after service ends', () => {
    expect(lineService(hours, 'L1', at(23, 10))!.state).toBe('closing-soon');
    expect(lineService(hours, 'L1', at(0, 30))!.state).toBe('closing-soon');
    expect(lineService(hours, 'L1', at(0, 30))!.lastTrain).toBeNull();
    expect(lineService(hours, 'L1', at(1, 30))!.state).toBe('closed');
    expect(lineService(hours, 'L1', at(4, 0))!.state).toBe('closed');
    expect(lineService(hours, 'L1', at(5, 20))!.state).toBe('open');
  });

  it('warns before the earliest L3 last train and keeps L3 running past midnight', () => {
    const early = lineService(hours, 'L3', at(23, 0))!;
    expect(early.state).toBe('closing-soon');
    expect(early.lastTrain).toBe('23:29');
    expect(lineService(hours, 'L3', at(0, 15))!.state).toBe('closing-soon');
    expect(lineService(hours, 'L3', at(1, 0))!.state).toBe('closed');
  });

  it('evaluates service in the requested IANA time zone', () => {
    // 2026-01-15T01:00:00Z is 03:00 in Africa/Cairo (UTC+2) -> closed.
    const nightUtc = new Date('2026-01-15T01:00:00Z');
    expect(lineService(hours, 'L1', nightUtc, { timeZone: 'Africa/Cairo' })!.state).toBe('closed');
    // 2026-01-15T10:00:00Z is 12:00 in Africa/Cairo -> open.
    const noonUtc = new Date('2026-01-15T10:00:00Z');
    expect(lineService(hours, 'L1', noonUtc, { timeZone: 'Africa/Cairo' })!.state).toBe('open');
  });

  it('returns null for unknown lines', () => {
    expect(lineService(hours, 'L9' as never, at(12, 0))).toBeNull();
  });
});

describe('tripService', () => {
  it('reports the worst state across lines', () => {
    expect(tripService(hours, ['L1', 'L3', 'L1'], at(23, 20)).state).toBe('closing-soon');
    expect(tripService(hours, ['L1'], at(12, 0)).lines).toHaveLength(1);
  });
});
