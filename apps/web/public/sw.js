// Offline support without dependencies: the app shell is cached on install and
// every other same-origin GET is served from cache and refreshed in the background.
// Bump VERSION to drop old caches after a breaking change.
const VERSION = 'v1';
const CACHE = `cairo-metro-${VERSION}`;
const SHELL = ['./', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png'];

// The shell plus every script, style and data chunk it references, so the first visit
// already works offline (not only after a second load).
async function precache() {
  const cache = await caches.open(CACHE);
  await cache.addAll(SHELL);
  const seen = new Set();
  const queue = [];
  const collect = (text, base, pattern) => {
    for (const m of text.matchAll(pattern)) {
      const url = new URL(m[1], base).href;
      if (!seen.has(url)) {
        seen.add(url);
        queue.push(url);
      }
    }
  };
  const scope = self.registration.scope;
  collect(
    await (await cache.match('./')).text(),
    scope,
    /(?:src|href)="(\.\/assets\/[^"]+\.(?:js|css))"/g,
  );
  while (queue.length && seen.size < 60) {
    const url = queue.shift();
    const res = await fetch(url);
    if (!res.ok) continue;
    await cache.put(url, res.clone());
    // lazy chunks are referenced as ./name.js relative to the importing file
    if (url.endsWith('.js')) collect(await res.text(), url, /["'`](\.\/[\w.-]+\.(?:js|css))["'`]/g);
  }
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

  // Share-target and deep links carry query strings; serve the cached shell for navigations.
  const isNav = req.mode === 'navigate';
  const key = isNav ? new Request(new URL('./', self.registration.scope)) : req;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(key);
      const network = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(key, res.clone());
          return res;
        })
        .catch(() => undefined);
      if (cached) {
        event.waitUntil(network);
        return cached;
      }
      return (await network) ?? Response.error();
    }),
  );
});
