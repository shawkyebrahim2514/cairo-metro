export interface TicketTier {
  maxStations: number;
  standard: number;
  senior60AndArmyPolice: number;
  specialNeedsAndVeterans: number;
}

export interface FaresData {
  currency: string;
  ticket: { tiers: TicketTier[] };
}

export type TicketCategory = 'standard' | 'senior60AndArmyPolice' | 'specialNeedsAndVeterans';

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
