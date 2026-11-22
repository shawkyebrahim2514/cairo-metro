import { describe, expect, it } from 'vitest';
import { ticketPrice, type FaresData } from './fares';

const fares: FaresData = {
  currency: 'EGP',
  ticket: {
    tiers: [
      { maxStations: 16, standard: 12, senior60AndArmyPolice: 6, specialNeedsAndVeterans: 5 },
      { maxStations: 9, standard: 10, senior60AndArmyPolice: 5, specialNeedsAndVeterans: 5 },
    ],
  },
};

describe('ticketPrice', () => {
  it('picks the smallest tier that covers the trip, regardless of tier order', () => {
    expect(ticketPrice(fares, 9)).toBe(10);
    expect(ticketPrice(fares, 10)).toBe(12);
    expect(ticketPrice(fares, 10, 'senior60AndArmyPolice')).toBe(6);
  });

  it('returns null beyond the largest tier', () => {
    expect(ticketPrice(fares, 17)).toBeNull();
  });
});
