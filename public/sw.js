// Service worker for the Hiker PWA.
//
// Scoped to the app base path so subpath deployments (e.g. /sothh-dev/) work.
// Caching strategy:
//   - Static assets (JS/CSS/images/fonts): cache-first, populated on first fetch.
//     Hashed bundles are served by the server with immutable long-cache headers.
//   - Navigation (SPA routes): network-first, falling back to cached index.html.
//   - Same-origin API reads and external weather/tides: network-first with cache
//     fallback. If-None-Match from the page is passed through so unchanged data
//     costs a server 304 and the cached copy is served in response. Freshness is
//     bounded by the server's Cache-Control instead of a never-revalidating cache.
//   - Write endpoints (PUT/POST/DELETE) are never cached. After a successful
//     write to trails/details/lookup/schedule/config/data, the cached API reads
//     are invalidated so the next load (e.g. after an Import ZIP reload) refetches.
//   - API keys are never stored in cache names or cached payloads.

const VERSION = 'v9';
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

// Read-only same-origin API endpoints: network-first with cache fallback so
// data is never stale beyond the server's Cache-Control, offline still works.
const API_READ_PATHS = new Set([
  '/api/trails',
  '/api/trails/details',
  '/api/lookup',
  '/api/schedule',
  '/api/schedule/group',
  '/api/config',
]);

// Admin-only API reads must never be served from or written to the offline cache.
const NO_CACHE_API = new Set([
  '/api/auth/verify',
  '/api/data/export-zip',
  '/api/validate',
  '/api/schedule/history',
  '/api/schedule/ensure-writable',
]);

// Cached API reads to drop whenever a data-mutating write succeeds.
const INVALIDATE_API_PATHS = API_READ_PATHS;
// Endpoint prefixes whose successful writes change the cached API reads above.
const DATA_WRITE_PREFIXES = ['/api/trails', '/api/schedule', '/api/data', '/api/cleanup'];



function isTideUrl(url) {
  return url.hostname === 'api.tidesandcurrents.noaa.gov';
}

function isWeatherUrl(url) {
  return url.hostname === 'api.weather.gov';
}

function isDataWrite(url, method) {
  if (!['PUT', 'POST', 'DELETE'].includes(method)) return false;
  const path = stripBase(url.pathname);
  return DATA_WRITE_PREFIXES.some((p) => path === p || path.startsWith(p + '/'));
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
    // Let writes go to the network; invalidate the cached API reads on success.
    if (url.origin === self.location.origin && isDataWrite(url, request.method)) {
      event.respondWith(
        fetch(request).then((res) => {
          if (res.ok) invalidateDataCache(url.origin);
          return res;
        })
      );
    }
    return;
  }

  if (url.origin !== self.location.origin) {
    if (isTideUrl(url) || isWeatherUrl(url)) {
      event.respondWith(networkFirstWithCache(request, TIDE_CACHE));
    }
    return;
  }

  // Manifest must always be fetched fresh — never serve stale cached version
  if (url.pathname.endsWith('/manifest.webmanifest')) {
    event.respondWith(fetch(request));
    return;
  }

  const path = stripBase(url.pathname);
  if (API_READ_PATHS.has(path)) {
    event.respondWith(networkFirstWithCache(request, API_CACHE));
    return;
  }
  if (NO_CACHE_API.has(path)) {
    event.respondWith(fetch(request));
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

// Network-first with cache fallback.
// The page request (including any If-None-Match) goes to the network so the
// server can answer 304 cheaply. On 304 the cached copy is served; on 200 the
// cache is refreshed. Only when the network fails does the cache answer.
async function networkFirstWithCache(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res.status === 304) {
      const cached = await cache.match(request);
      if (cached) return cached;
      return res;
    }
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
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



// Drop cached API reads so the next load refetches fresh data after a write.
function invalidateDataCache(origin) {
  caches.open(API_CACHE).then(async (cache) => {
    const keys = await cache.keys();
    const toDelete = keys.filter((k) => {
      const u = new URL(k);
      return u.origin === origin && INVALIDATE_API_PATHS.has(stripBase(u.pathname));
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
