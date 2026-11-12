import { describe, it, expect, beforeAll, afterAll, vi, afterEach } from 'vitest';
import express from 'express';

// tide.routes has no dataService/paths dependency, so it can be imported
// directly. Upstream NOAA calls are intercepted by stubbing global fetch.
let base: string;
let server: import('node:http').Server;
// The route calls global fetch (so the stub intercepts it); the test client
// must use the untouched original or it would hit its own stub.
const realFetch = globalThis.fetch.bind(globalThis);

beforeAll(async () => {
  const { router } = await import('../src/routes/tide.routes.js');
  const app = express();
  app.use('/api', router);
  await new Promise<void>((resolve) => { server = app.listen(0, () => resolve()); });
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
});

afterAll(async () => {
  if (server) await new Promise((r) => server.close(r));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const stubUpstream = () => {
  const fn = vi.fn(async () => ({ ok: true, json: async () => ({ predictions: [] }) }));
  vi.stubGlobal('fetch', fn);
  return fn;
};

describe('GET /api/tide-proxy', () => {
  it('rejects missing parameters', async () => {
    const res = await realFetch(`${base}/api/tide-proxy?station=9444705`);
    expect(res.status).toBe(400);
  });

  it('rejects non-YYYYMMDD dates', async () => {
    const res = await realFetch(`${base}/api/tide-proxy?station=9444705&begin_date=2026-11-13&end_date=20261113`);
    expect(res.status).toBe(400);
  });

  it('rejects unknown modes before touching the network', async () => {
    const fn = stubUpstream();
    const res = await realFetch(`${base}/api/tide-proxy?station=9444705&begin_date=20261113&end_date=20261113&mode=bogus`);
    expect(res.status).toBe(400);
    expect(fn).not.toHaveBeenCalled();
  });

  it('rejects non-numeric station IDs without touching the network', async () => {
    const fn = stubUpstream();
    for (const bad of ['abc', '9444705;rm', '9444705 9444090', '9'.repeat(11)]) {
      const res = await realFetch(`${base}/api/tide-proxy?station=${encodeURIComponent(bad)}&begin_date=20261113&end_date=20261113`);
      expect(res.status, bad).toBe(400);
    }
    expect(fn).not.toHaveBeenCalled();
  });

  it('rejects invalid calendar dates, reversed ranges, and ranges over 31 days', async () => {
    const fn = stubUpstream();
    const bad = [
      ['20261340', '20261341'], // month 13 does not exist
      ['20261113', '20261112'], // end before begin
      ['20250101', '20260101'], // a whole year
    ];
    for (const [b, e] of bad) {
      const res = await realFetch(`${base}/api/tide-proxy?station=9444705&begin_date=${b}&end_date=${e}`);
      expect(res.status, `${b}..${e}`).toBe(400);
    }
    expect(fn).not.toHaveBeenCalled();
  });

  it('accepts a 3-day interpolation window', async () => {
    const fn = stubUpstream();
    const res = await realFetch(`${base}/api/tide-proxy?station=9444705&begin_date=20261112&end_date=20261114&mode=hilo`);
    expect(res.status).toBe(200);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('defaults to interval=hilo upstream', async () => {
    const fn = stubUpstream();
    const res = await realFetch(`${base}/api/tide-proxy?station=9444705&begin_date=20261113&end_date=20261113`);
    expect(res.status).toBe(200);
    const upstream = String(fn.mock.calls[0][0]);
    expect(upstream).toContain('interval=hilo');
    expect(upstream).toContain('station=9444705');
  });

  it('mode=levels omits interval (6-minute water level series)', async () => {
    const fn = stubUpstream();
    const res = await realFetch(`${base}/api/tide-proxy?station=9444705&begin_date=20261113&end_date=20261113&mode=levels`);
    expect(res.status).toBe(200);
    const upstream = String(fn.mock.calls[0][0]);
    expect(upstream).not.toContain('interval=');
    expect(upstream).toContain('product=predictions');
  });

  it('passes through upstream error bodies as-is (client treats them as unavailable)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ error: { message: 'No Predictions data was found.' } }),
    })));
    const res = await realFetch(`${base}/api/tide-proxy?station=9444705&begin_date=20261113&end_date=20261113&mode=levels`);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ error: { message: 'No Predictions data was found.' } });
  });

  it('maps upstream failures to 502 and timeouts to 504', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNRESET'); }));
    const res = await realFetch(`${base}/api/tide-proxy?station=9444705&begin_date=20261113&end_date=20261113`);
    expect(res.status).toBe(502);

    vi.stubGlobal('fetch', vi.fn(async () => {
      const err = new Error('timed out');
      err.name = 'TimeoutError';
      throw err;
    }));
    const res2 = await realFetch(`${base}/api/tide-proxy?station=9444705&begin_date=20261113&end_date=20261113`);
    expect(res2.status).toBe(504);
  });
});
