// Service worker for the Hiker PWA.
//
// Scoped to the app base path so subpath deployments (e.g. /sothh-dev/) work.
// Caching strategy:
//   - Static assets (JS/CSS/images/fonts): cache-first, populated on first fetch.
//   - Navigation (SPA routes): network-first, falling back to cached index.html.
//   - Same-origin API reads: cache-first for trails/details/lookup,
//     cache-first with background update for schedule/config/group.
//   - External tides (NOAA): cache-first (stable per date).
//   - External forecast (NWS): cache-first with background update.
//   - Write endpoints (PUT/POST/DELETE) are never cached. After a successful
//     schedule write, the cached schedule is invalidated.
//   - API keys are never stored in cache names or cached payloads.

const VERSION = 'v5';
const SHELL_CACHE = `hiker-shell-${VERSION}`;
const API_CACHE = `hiker-api-${VERSION}`;
const TIDE_CACHE = `hiker-tide-${VERSION}`;

// Base path prefix (e.g. "/sothh-dev/") derived from the SW's own location.
// In a subpath deployment the SW lives at /<base>/sw.js, so API requests
// arrive as /<base>/api/... — we strip the prefix before matching.
const BASE_PATH = (() => {
  const swPath = self.location.pathname; // e.g. "/sothh-dev/sw.js" or "/sw.js"
  const dir = swPath.replace(/sw\.js$/, '');
  return dir || '/';
})();

function stripBase(pathname) {
  if (BASE_PATH !== '/' && pathname.startsWith(BASE_PATH)) {
    return pathname.slice(BASE_PATH.length - 1);
  }
  return pathname;
}

// Read-only same-origin API endpoints: cache-first (stable data).
const CACHE_FIRST_API = new Set([
  '/api/trails',
  '/api/trails/details',
  '/api/lookup',
]);
// Endpoints that change: network-first with cache fallback + timeout.
const NETWORK_FIRST_API = new Set([
  '/api/schedule',
  '/api/schedule/group',
  '/api/config',
]);



function isTideUrl(url) {
  return url.hostname === 'api.tidesandcurrents.noaa.gov';
}

function isWeatherUrl(url) {
  return url.hostname === 'api.weather.gov';
}

function isScheduleWrite(url, method) {
  const path = stripBase(url.pathname);
  return (
    (path === '/api/schedule' || path.startsWith('/api/schedule/')) &&
    ['PUT', 'POST', 'DELETE'].includes(method)
  );
}

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith('hiker-') && !k.endsWith(`-${VERSION}`))
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') {
    // Let writes go to the network; invalidate the schedule cache on success.
    if (url.origin === self.location.origin && isScheduleWrite(url, request.method)) {
      event.respondWith(
        fetch(request).then((res) => {
          if (res.ok) invalidateScheduleCache(url.origin);
          return res;
        })
      );
    }
    return;
  }

  if (url.origin !== self.location.origin) {
    if (isTideUrl(url)) {
      event.respondWith(cacheFirst(request, TIDE_CACHE));
    } else if (isWeatherUrl(url)) {
      event.respondWith(cacheFirstBackground(request, TIDE_CACHE));
    }
    return;
  }

  // Manifest must always be fetched fresh — never serve stale cached version
  if (url.pathname.endsWith('/manifest.webmanifest')) {
    event.respondWith(fetch(request));
    return;
  }

  const path = stripBase(url.pathname);
  if (CACHE_FIRST_API.has(path)) {
    event.respondWith(cacheFirst(request, API_CACHE));
    return;
  }
  if (NETWORK_FIRST_API.has(path)) {
    event.respondWith(cacheFirstBackground(request, API_CACHE));
    return;
  }
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }
  event.respondWith(cacheFirst(request, SHELL_CACHE));
});

// Cache-first: serve from cache, else fetch and cache.
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

// Cache-first with background network update.
// Serves cached response immediately, then updates cache from network in background.
// If no cache exists, waits for network.
async function cacheFirstBackground(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  // Update cache from network in background (strip ETag to avoid 304)
  const bgReq = new Request(request, { headers: new Headers(Object.fromEntries(
    [...request.headers].filter(([k]) => k.toLowerCase() !== 'if-none-match')
  ))});
  fetch(bgReq).then((res) => {
    if (res.ok) cache.put(request, res.clone());
  }).catch(() => {});

  if (cached) return cached;
  // No cache yet — wait for network
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    return offlineResponse();
  }
}

// SPA navigation: network-first, fall back to cached index.html for offline.
async function handleNavigation(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    const root = new URL('./', self.location.href);
    const shell = await cache.match(root);
    if (shell) return shell;
    return offlineResponse();
  }
}



// Remove cached schedule + config after a successful schedule write.
function invalidateScheduleCache(origin) {
  caches.open(API_CACHE).then(async (cache) => {
    const keys = await cache.keys();
    const toDelete = keys.filter((k) => {
      const u = new URL(k);
      const path = stripBase(u.pathname);
      return (
        u.origin === origin &&
        (path === '/api/schedule' || path === '/api/schedule/group' || path === '/api/config')
      );
    });
    await Promise.all(toDelete.map((k) => cache.delete(k)));
  });
}

function offlineResponse() {
  return new Response(
    '<!doctype html><meta charset="utf-8"><title>Offline</title><p>You are offline. Some data may be unavailable.</p>',
    { status: 503, statusText: 'Offline', headers: { 'Content-Type': 'text/html' } }
  );
}
