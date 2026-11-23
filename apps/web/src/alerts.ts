import type { AlertKind } from '@cairo-metro/core';

export interface AlertPrefs {
  vibrate: boolean;
  /** A short pulse at every station, on top of the warning/change/arrival alerts. */
  eachStation: boolean;
  /** Warn this many stops before a change or exit; 0 turns the warning off. */
  warnStops: 0 | 1 | 2 | 3;
  beep: boolean;
  voice: boolean;
  keepAwake: boolean;
}

export const DEFAULT_ALERTS: AlertPrefs = {
  vibrate: true,
  eachStation: true,
  warnStops: 2,
  beep: false,
  voice: false,
  keepAwake: true,
};

const KEY = 'alerts';

export function loadAlerts(): AlertPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<AlertPrefs> | null;
    const warn = raw?.warnStops;
    return {
      ...DEFAULT_ALERTS,
      ...raw,
      warnStops: warn === 0 || warn === 1 || warn === 2 || warn === 3 ? warn : 2,
    };
  } catch {
    return DEFAULT_ALERTS;
  }
}

export function saveAlerts(prefs: AlertPrefs): void {
  localStorage.setItem(KEY, JSON.stringify(prefs));
}

/** Vibration patterns in ms: a pulse per station, a long buzz for the exit, a double for a change. */
const PATTERNS: Record<AlertKind, number[]> = {
  station: [100],
  warn: [200, 100, 200, 100, 200],
  change: [250, 120, 250],
  arrive: [900],
};

export const canVibrate = () => typeof navigator !== 'undefined' && 'vibrate' in navigator;

let audio: AudioContext | null = null;

function beep(kind: AlertKind) {
  try {
    audio ??= new AudioContext();
    const ctx = audio;
    const times = kind === 'station' ? 1 : kind === 'change' ? 2 : kind === 'warn' ? 3 : 1;
    for (let i = 0; i < times; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = kind === 'arrive' ? 660 : 880;
      gain.gain.value = 0.15;
      osc.connect(gain).connect(ctx.destination);
      const at = ctx.currentTime + i * 0.25;
      osc.start(at);
      osc.stop(at + (kind === 'arrive' ? 0.7 : 0.15));
    }
  } catch {
    // audio is optional
  }
}

/** Call from a tap: browsers only allow sound and speech after a user gesture. */
export function unlockAudio(): void {
  try {
    audio ??= new AudioContext();
    void audio.resume();
    if ('speechSynthesis' in window) window.speechSynthesis.speak(new SpeechSynthesisUtterance(''));
  } catch {
    // audio is optional
  }
}

function speak(text: string, lang: string) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang === 'ar' ? 'ar-EG' : 'en-US';
  window.speechSynthesis.speak(u);
}

/** Fires the vibration, beep and spoken message chosen in the settings. */
export function fireAlert(kind: AlertKind, prefs: AlertPrefs, text: string, lang: string): void {
  if (prefs.vibrate && canVibrate() && (kind !== 'station' || prefs.eachStation)) {
    navigator.vibrate(PATTERNS[kind]);
  }
  if (prefs.beep && (kind !== 'station' || prefs.eachStation)) beep(kind);
  if (prefs.voice && (kind !== 'station' || prefs.eachStation)) speak(text, lang);
}
