export type LineId = 'L1' | 'L2' | 'L3';

export interface LocalizedName {
  en: string;
  ar: string;
}

export interface StationLineEntry {
  line: LineId;
  branch: string;
  /** 0-based position within the branch. */
  order: number;
}

export interface Station {
  id: string;
  name: LocalizedName;
  /** Alternative spellings used for search (all lowercase not required). */
  aliases: string[];
  lat: number;
  lng: number;
  lines: StationLineEntry[];
  interchange: boolean;
  /** Seconds to walk between platforms; only meaningful for interchanges. */
  transferSec: number | null;
  status: 'open' | 'planned';
  /** True once a human confirmed this station in the data viewer. */
  verified: boolean;
  wikidata: string | null;
  osmNodeIds: number[];
  notes: string[];
}

export interface Segment {
  from: string;
  to: string;
  distanceM: number;
  /** Estimated in-train time including dwell at the destination station. */
  rideSec: number;
  estimated: true;
}

export interface Branch {
  id: string;
  name: LocalizedName;
  /** Ordered station ids. */
  stations: string[];
  segments: Segment[];
}

export interface Line {
  id: LineId;
  name: LocalizedName;
  colour: string;
  operator: string;
  branches: Branch[];
}

/** A named place from the offline index (mall, university, landmark, district...). */
export interface Place {
  id: string;
  /** Either name may be empty when OSM has only one language. */
  en: string;
  ar: string;
  /** Curated extra names (from data/curated/place-aliases.json). */
  aliases?: string[];
  /** OSM tag value such as 'mall', 'university' or 'suburb'. */
  type: string;
  lat: number;
  lng: number;
}

export interface PlacesData {
  generatedAt: string;
  license: string;
  places: Place[];
}

export interface MetroData {
  generatedAt: string;
  attribution: string[];
  stations: Station[];
  lines: Line[];
}
