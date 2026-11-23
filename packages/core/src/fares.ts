export interface TicketTier {
  maxStations: number;
  standard: number;
  senior60AndArmyPolice: number;
  specialNeedsAndVeterans: number;
}

/** How the "N stations" in the official fare table is counted. Edit in fares.json, not in code. */
export interface FareCounting {
  /** True when the boarding station counts toward N (default). */
  includesOrigin: boolean;
}

export interface FaresData {
  currency: string;
  ticket: { counting?: FareCounting; tiers: TicketTier[] };
  subscriptions?: { monthly?: Record<string, number[]> };
}

export type TicketCategory = 'standard' | 'senior60AndArmyPolice' | 'specialNeedsAndVeterans';

/** Which monthly-pass price list applies to a ticket category (none for special needs/veterans). */
const MONTHLY_PASS_KEY: Partial<Record<TicketCategory, string>> = {
  standard: 'people',
  senior60AndArmyPolice: 'senior60',
};

export const DEFAULT_FARE_COUNTING: FareCounting = { includesOrigin: true };

/** Stations counted for pricing a trip that travels `stops` stops (interchanges count once). */
export function billableStations(fares: FaresData, stops: number): number {
  const counting = fares.ticket.counting ?? DEFAULT_FARE_COUNTING;
  return stops + (counting.includesOrigin ? 1 : 0);
}

/** Price for a trip covering `stations` stations, or null if beyond the largest tier. */
export function ticketPrice(
  fares: FaresData,
  stations: number,
  category: TicketCategory = 'standard',
): number | null {
  const tiers = [...fares.ticket.tiers].sort((a, b) => a.maxStations - b.maxStations);
  const tier = tiers.find((t) => stations <= t.maxStations);
  return tier ? tier[category] : null;
}

/** Ticket price for a trip that travels `stops` stops, applying the counting rules. */
export function tripFare(
  fares: FaresData,
  stops: number,
  category: TicketCategory = 'standard',
): number | null {
  return stops > 0 ? ticketPrice(fares, billableStations(fares, stops), category) : null;
}

export interface PassComparison {
  /** Estimated zones (1-4). Station-to-zone data is not available, so this follows the ticket tier. */
  zones: number;
  ticketTotal: number;
  monthlyPass: number;
  /** Positive when the pass is cheaper than single tickets for this many rides. */
  savings: number;
  /** Rides per month from which the pass is cheaper. */
  breakEvenRides: number;
}

/** Compares paying per ride with a monthly pass for a trip repeated `ridesPerMonth` times. */
export function comparePass(
  fares: FaresData,
  stops: number,
  ridesPerMonth: number,
  category: TicketCategory = 'standard',
): PassComparison | null {
  const key = MONTHLY_PASS_KEY[category];
  const prices = key ? fares.subscriptions?.monthly?.[key] : undefined;
  const fare = tripFare(fares, stops, category);
  if (!prices || fare == null || fare <= 0) return null;
  const tiers = [...fares.ticket.tiers].sort((a, b) => a.maxStations - b.maxStations);
  const tierIndex = tiers.findIndex((t) => billableStations(fares, stops) <= t.maxStations);
  const zones = Math.min(Math.max(tierIndex + 1, 1), prices.length);
  const monthlyPass = prices[zones - 1]!;
  const ticketTotal = fare * ridesPerMonth;
  return {
    zones,
    ticketTotal,
    monthlyPass,
    savings: ticketTotal - monthlyPass,
    breakEvenRides: Math.ceil(monthlyPass / fare),
  };
}
