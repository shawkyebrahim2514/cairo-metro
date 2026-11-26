// Offline support without dependencies: the build stamps VERSION and ASSETS with the
// exact emitted bundle files so every deploy precaches a consistent set and drops old caches.
const VERSION = 'dev';
const ASSETS = [];
const CACHE = `cairo-metro-${VERSION}`;
const SHELL = ['./', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png'];

async function precache() {
  const cache = await caches.open(CACHE);
  const urls = [...new Set([...SHELL, ...ASSETS])];
  await cache.addAll(urls);
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('cairo-metro-') && k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  // Never intercept sw.js itself so the browser always checks for updates from the network.
  if (url.pathname.endsWith('/sw.js')) return;

  // Share-target and deep links carry query strings; serve the precached shell for navigations.
  const isNav = req.mode === 'navigate';
  const key = isNav ? new Request(new URL('./', self.registration.scope)) : req;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(key);
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (res.ok && !isNav) await cache.put(key, res.clone());
        return res;
      } catch {
        return Response.error();
      }
    }),
  );
});
