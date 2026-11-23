import { createContext, useContext } from 'react';

export type ThemeMode = 'light' | 'dark' | 'auto';

export const HIGHLIGHTS = [
  { id: 'amber', colour: '#f59e0b' },
  { id: 'violet', colour: '#8b5cf6' },
  { id: 'pink', colour: '#ec4899' },
  { id: 'cyan', colour: '#06b6d4' },
] as const;

export type HighlightId = (typeof HIGHLIGHTS)[number]['id'];

export interface Settings {
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  highlight: HighlightId;
  setHighlight: (h: HighlightId) => void;
  /** The colour value for the selected route highlight. */
  highlightColour: string;
}

export const SettingsContext = createContext<Settings>({
  theme: 'auto',
  setTheme: () => {},
  highlight: 'amber',
  setHighlight: () => {},
  highlightColour: HIGHLIGHTS[0].colour,
});

export const useSettings = () => useContext(SettingsContext);

export const highlightColour = (id: HighlightId) =>
  HIGHLIGHTS.find((h) => h.id === id)?.colour ?? HIGHLIGHTS[0].colour;

/** Resolves "auto" to the system preference. */
export function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode !== 'auto') return mode;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(mode: ThemeMode, highlight: HighlightId): void {
  const root = document.documentElement;
  root.dataset.theme = resolveTheme(mode);
  root.style.setProperty('--hl', highlightColour(highlight));
}
