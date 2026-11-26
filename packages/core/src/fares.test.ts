import { describe, expect, it } from 'vitest';
import { tripFare, ticketPrice, type FaresData } from './fares';

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

  it('supports an open-ended top tier when maxStations is null', () => {
    const openTop: FaresData = {
      ...fares,
      ticket: {
        tiers: [
          ...fares.ticket.tiers,
          {
            maxStations: null,
            standard: 20,
            senior60AndArmyPolice: 10,
            specialNeedsAndVeterans: 5,
          },
        ],
      },
    };
    expect(ticketPrice(openTop, 40)).toBe(20);
    expect(ticketPrice(openTop, 100, 'senior60AndArmyPolice')).toBe(10);
  });
});

describe('tripFare', () => {
  it('counts the boarding station by default', () => {
    expect(tripFare(fares, 8)).toBe(10);
    expect(tripFare(fares, 9)).toBe(12);
  });

  it('follows the counting rule from the data', () => {
    const noOrigin: FaresData = {
      ...fares,
      ticket: { ...fares.ticket, counting: { includesOrigin: false } },
    };
    expect(tripFare(noOrigin, 9)).toBe(10);
    expect(tripFare(noOrigin, 10)).toBe(12);
  });

  it('has no fare for a zero-stop trip', () => {
    expect(tripFare(fares, 0)).toBeNull();
  });
});
