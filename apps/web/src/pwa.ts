import { useCallback, useEffect, useState } from 'react';

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'installDismissedAt';
const DISMISS_DAYS = 14;

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

const ua = () => navigator.userAgent;
export const isIos = () => /iphone|ipad|ipod/i.test(ua());
/** WhatsApp, Facebook and similar in-app browsers cannot install web apps. */
export const isInAppBrowser = () =>
  /FBAN|FBAV|Instagram|Line\/|MicroMessenger|WhatsApp/i.test(ua());

function recentlyDismissed(): boolean {
  const at = Number(localStorage.getItem(DISMISS_KEY));
  return Number.isFinite(at) && at > 0 && Date.now() - at < DISMISS_DAYS * 86_400_000;
}

/** Tracks the browser's install prompt and whether our own card should be shown. */
export function useInstall() {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [hidden, setHidden] = useState(recentlyDismissed);
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setHidden(true);
  }, []);

  const install = useCallback(async () => {
    if (!event) return;
    await event.prompt();
    const { outcome } = await event.userChoice;
    setEvent(null);
    if (outcome === 'dismissed') dismiss();
  }, [event, dismiss]);

  // Only touch devices get the card: desktop browsers have their own install button.
  const touch = window.matchMedia('(pointer: coarse)').matches;
  const canShow = touch && !installed && !hidden;
  return { canShow, canPrompt: event !== null, install, dismiss };
}

/** Browser online state plus whether the app (JS and data) is served from the offline cache. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

export const servedFromCache = () =>
  'serviceWorker' in navigator && navigator.serviceWorker.controller !== null;
