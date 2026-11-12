import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';

// The service worker source is evaluated with stubbed worker globals so the
// fetch-handler routing can be asserted without a browser worker context.
const swSource = readFileSync('public/sw.js', 'utf-8');

function loadSw() {
  const listeners: Record<string, (event: any) => void> = {};
  const caches = {
    open: vi.fn(async () => ({
      match: vi.fn(async () => undefined),
      put: vi.fn(async () => {}),
      keys: vi.fn(async () => []),
      delete: vi.fn(async () => {}),
    })),
  };
  const fetchMock = vi.fn(async () => ({
    ok: true,
    status: 200,
    headers: { get: () => null },
    clone: function () { return this; },
  }));
  const self = {
    location: { pathname: '/sothh-dev/sw.js', href: 'https://h.example/sothh-dev/sw.js', origin: 'https://h.example' },
    addEventListener: (name: string, fn: (event: any) => void) => { listeners[name] = fn; },
    skipWaiting: () => {},
    clients: { claim: () => {} },
  };
  new Function('self', 'caches', 'fetch', swSource)(self, caches, fetchMock);
  return { listeners, caches, fetchMock };
}

function makeGetEvent(url: string) {
  return { request: { method: 'GET', url: `https://h.example${url}` }, respondWith: vi.fn() };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('service worker fetch routing', () => {
  it('serves /api/tide-proxy from the network only, never the caches', async () => {
    const { listeners, caches, fetchMock } = loadSw();
    const event = makeGetEvent('/sothh-dev/api/tide-proxy?station=9444705&begin_date=20261113&end_date=20261113&mode=hilo');
    listeners.fetch(event);
    expect(event.respondWith).toHaveBeenCalled();
    await flush();
    expect(fetchMock).toHaveBeenCalled();
    // A NOAA 200-with-error body must never be pinned in a cache.
    expect(caches.open).not.toHaveBeenCalled();
  });

  it('serves whitelisted API reads (network-first) through the API cache', async () => {
    const { listeners, caches } = loadSw();
    const event = makeGetEvent('/sothh-dev/api/trails');
    listeners.fetch(event);
    await flush();
    expect(caches.open).toHaveBeenCalled();
  });

  it('serves static assets cache-first from the shell cache', async () => {
    const { listeners, caches } = loadSw();
    const event = makeGetEvent('/sothh-dev/assets/app-abc123.js');
    listeners.fetch(event);
    await flush();
    expect(caches.open).toHaveBeenCalled();
  });

  it('never caches admin endpoints', async () => {
    const { listeners, caches, fetchMock } = loadSw();
    const event = makeGetEvent('/sothh-dev/api/validate');
    listeners.fetch(event);
    await flush();
    expect(fetchMock).toHaveBeenCalled();
    expect(caches.open).not.toHaveBeenCalled();
  });
});
