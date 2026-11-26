export interface TicketTier {
  /** Inclusive upper bound on stations, or null for an open-ended top tier. */
  maxStations: number | null;
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
}

export type TicketCategory = 'standard' | 'senior60AndArmyPolice' | 'specialNeedsAndVeterans';

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
  const limit = (t: TicketTier) => t.maxStations ?? Infinity;
  const tiers = [...fares.ticket.tiers].sort((a, b) => limit(a) - limit(b));
  const tier = tiers.find((t) => stations <= limit(t));
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
