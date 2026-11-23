import { describe, expect, it } from 'vitest';
import { comparePass, comparePassPlans, tripFare, ticketPrice, type FaresData } from './fares';

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

describe('comparePass', () => {
  const withPass: FaresData = { ...fares, subscriptions: { monthly: { people: [390, 440] } } };

  it('finds the break-even and savings against single tickets', () => {
    const r = comparePass(withPass, 10, 44)!; // 11 stations -> 2nd tier, 12 EGP, zone 2
    expect(r.zones).toBe(2);
    expect(r.ticketTotal).toBe(528);
    expect(r.savings).toBe(88);
    expect(r.breakEvenRides).toBe(37);
  });

  it('has no monthly pass for categories without one', () => {
    expect(comparePass(withPass, 10, 44, 'specialNeedsAndVeterans')).toBeNull();
  });
});

describe('comparePassPlans', () => {
  const withPasses: FaresData = {
    ...fares,
    subscriptions: { monthly: { people: [390, 440] }, quarterly: { people: [1045, 1190] } },
  };

  it('compares monthly and quarterly passes over their own periods', () => {
    const [m, q] = comparePassPlans(withPasses, 10, 44);
    expect(m).toMatchObject({ period: 'monthly', price: 440, ticketTotal: 528, savings: 88 });
    expect(q).toMatchObject({
      period: 'quarterly',
      price: 1190,
      ticketTotal: 1584,
      savings: 394,
      perMonth: 397,
    });
  });

  it('returns nothing for categories without passes', () => {
    expect(comparePassPlans(withPasses, 10, 44, 'specialNeedsAndVeterans')).toEqual([]);
  });
});
