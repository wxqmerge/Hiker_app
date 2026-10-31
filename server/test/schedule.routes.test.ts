import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import express from 'express';

// These modules read process.env at import time (DATA_DIR, SCHEDULE_NAME,
// ADMIN_API_KEY, MAX_HIKES_PER_DAY) and dataService self-runs loadData(), so
// they are dynamically imported in beforeAll AFTER the environment is set.
const ADMIN_KEY = 'vitest-admin-key';
const V1 = { '2026-06': [{ day: 10, slot: 0, trail_id: 'trail-1', early_start: 0, leader: 'A' }] };
const V2 = { '2026-06': [{ day: 11, slot: 0, trail_id: 'trail-2', early_start: 0, leader: 'B' }] };

let DATA_DIR: string;
let scheduleFilePath: string;
let base: string;
let server: import('node:http').Server;
let getSchedule: () => Record<string, unknown>;
let loadData: () => Promise<void>;
let updateSchedule: (s: Record<string, unknown>) => Promise<void>;
let getScheduleFile: () => string;

async function writeSchedule(value: unknown) {
  await fs.writeFile(scheduleFilePath, JSON.stringify(value), 'utf-8');
}
async function readScheduleFile() {
  return JSON.parse(await fs.readFile(scheduleFilePath, 'utf-8'));
}

async function req(method: string, urlPath: string, opts: { body?: unknown; key?: string; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { ...(opts.headers || {}) };
  if (opts.key !== undefined) headers['X-API-Key'] = opts.key;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(base + urlPath, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const etag = res.headers.get('etag');
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  return { status: res.status, etag, json };
}

beforeAll(async () => {
  const dataDirName = `tmp/vitest-schedule-${process.pid}`;
  process.env.DATA_DIR = dataDirName;
  process.env.SCHEDULE_NAME = 'vitest';
  process.env.ADMIN_API_KEY = ADMIN_KEY;
  process.env.ADMIN_AUTH_FAILURE_DELAY_MS = '0';
  process.env.MAX_HIKES_PER_DAY = '3';

  // Import AFTER env is set so paths.ts / dataService.ts bind to the temp dir.
  const paths = await import('../src/utils/paths.js');
  const ds = await import('../src/services/dataService.js');
  getSchedule = ds.getSchedule;
  loadData = ds.loadData;
  updateSchedule = ds.updateSchedule;
  getScheduleFile = ds.getScheduleFile;
  DATA_DIR = paths.DATA_DIR;
  scheduleFilePath = path.join(DATA_DIR, getScheduleFile());

  await fs.mkdir(path.join(DATA_DIR, 'schedule_history'), { recursive: true });
  await fs.writeFile(path.join(DATA_DIR, 'trails.json'), JSON.stringify({ trails: [{ id: 'trail-1', name: 'T1' }] }));
  await writeSchedule({}); // empty initial schedule
  await loadData();

  const { router } = await import('../src/routes/schedule.routes.js');
  const app = express();
  app.use(express.json());
  app.use('/api/schedule', router);

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
});

afterAll(async () => {
  if (server) await new Promise((r) => server.close(r));
  if (DATA_DIR) await fs.rm(DATA_DIR, { recursive: true, force: true });
});

beforeEach(async () => {
  await writeSchedule({});
  await loadData();
});

describe('GET /api/schedule etag handling', () => {
  it('returns an ETag and honors If-None-Match with 304', async () => {
    const first = await req('GET', '/api/schedule');
    expect(first.status).toBe(200);
    expect(first.etag).toBeTruthy();

    const second = await req('GET', '/api/schedule', { headers: { 'If-None-Match': first.etag! } });
    expect(second.status).toBe(304);
  });
});

describe('PUT /api/schedule If-Match precondition', () => {
  it('accepts a save whose If-Match matches the current version', async () => {
    const current = await req('GET', '/api/schedule');
    const put = await req('PUT', '/api/schedule', { body: V1, key: ADMIN_KEY, headers: { 'If-Match': current.etag! } });
    expect(put.status).toBe(200);
    expect(put.json.success).toBe(true);
    expect(put.json.etag).toBeTruthy();
    await expect(readScheduleFile()).resolves.toMatchObject({ '2026-06': [expect.objectContaining({ trail_id: 'trail-1' })] });
  });

  it('rejects a stale If-Match with 412 + the current ETag, leaving the file untouched', async () => {
    await updateSchedule(V1 as never); // establish a version
    const staleEtag = (await req('GET', '/api/schedule')).etag!;
    await updateSchedule(V2 as never); // move the version forward
    const latest = (await req('GET', '/api/schedule')).etag!;
    expect(staleEtag).not.toBe(latest);

    const put = await req('PUT', '/api/schedule', { body: V1, key: ADMIN_KEY, headers: { 'If-Match': staleEtag } });
    expect(put.status).toBe(412);
    expect(put.etag).toBe(latest);
    // File still reflects V2, not the rejected V1.
    await expect(readScheduleFile()).resolves.toMatchObject({ '2026-06': [expect.objectContaining({ trail_id: 'trail-2' })] });
  });

  it('still accepts legacy PUTs with no If-Match header', async () => {
    const put = await req('PUT', '/api/schedule', { body: V1, key: ADMIN_KEY });
    expect(put.status).toBe(200);
  });

  it('rejects an invalid schedule body with 400 regardless of If-Match', async () => {
    const put = await req('PUT', '/api/schedule', { body: { '2026-06': 'nope' }, key: ADMIN_KEY });
    expect(put.status).toBe(400);
  });
});

describe('PUT /api/schedule empty-schedule guard', () => {
  it('refuses an empty schedule without X-Confirm-Empty', async () => {
    await updateSchedule(V1 as never); // non-empty current
    const etag = (await req('GET', '/api/schedule')).etag!;
    const put = await req('PUT', '/api/schedule', { body: {}, key: ADMIN_KEY, headers: { 'If-Match': etag } });
    expect(put.status).toBe(400);
  });

  it('accepts an empty schedule when X-Confirm-Empty is set', async () => {
    const etag = (await req('GET', '/api/schedule')).etag!;
    const put = await req('PUT', '/api/schedule', { body: {}, key: ADMIN_KEY, headers: { 'If-Match': etag, 'X-Confirm-Empty': 'true' } });
    expect(put.status).toBe(200);
  });
});

describe('PUT /api/schedule auth', () => {
  it('returns 401 without an API key', async () => {
    const put = await req('PUT', '/api/schedule', { body: V1 });
    expect(put.status).toBe(401);
  });
});

describe('schedule history + restore', () => {
  it('archives a prior non-empty schedule and restores it with the new etag', async () => {
    await updateSchedule(V1 as never); // current, nothing archived (starts empty in beforeEach)
    await updateSchedule(V2 as never); // archives V1 into history
    await writeSchedule(V2); await loadData(); // make V2 the live file for a stable etag

    const history = await req('GET', '/api/schedule/history', { key: ADMIN_KEY });
    expect(history.status).toBe(200);
    expect(Array.isArray(history.json)).toBe(true);
    expect(history.json.length).toBeGreaterThan(0);
    const ts = history.json[0].timestamp;

    const restore = await req('POST', '/api/schedule/history/restore', { body: { timestamp: ts }, key: ADMIN_KEY });
    expect(restore.status).toBe(200);
    expect(restore.json.success).toBe(true);
    expect(restore.json.etag).toBeTruthy();
    // Restored payload carries the archived schedule (V1).
    expect(JSON.stringify(restore.json.schedule)).toContain('trail-1');
    // And the live file now matches the archived schedule.
    await expect(readScheduleFile()).resolves.toMatchObject({ '2026-06': [expect.objectContaining({ trail_id: 'trail-1' })] });
    expect(getSchedule()).toMatchObject({ '2026-06': [expect.objectContaining({ trail_id: 'trail-1' })] });
  });

  it('rejects out-of-range day values with 400', async () => {
    const res = await req('PUT', '/api/schedule', {
      body: { '2026-06': [{ day: 45, slot: 0, trail_id: 'trail-1', early_start: 0, leader: '' }] },
      key: ADMIN_KEY,
    });
    expect(res.status).toBe(400);
  });

  it('rejects non YYYY-MM month keys (incl. __proto__) with 400', async () => {
    const protoBody = JSON.parse('{"__proto__":[{"day":1,"slot":0,"trail_id":"trail-1","early_start":0,"leader":""}]}');
    const protoRes = await req('PUT', '/api/schedule', { body: protoBody, key: ADMIN_KEY });
    expect(protoRes.status).toBe(400);

    const legacyRes = await req('PUT', '/api/schedule', {
      body: { Jun: [{ day: 1, slot: 0, trail_id: 'trail-1', early_start: 0, leader: '' }] },
      key: ADMIN_KEY,
    });
    expect(legacyRes.status).toBe(400);
  });

  it('ensure-writable is POST (state-changing) and rejects GET', async () => {
    const post = await req('POST', '/api/schedule/ensure-writable', { key: ADMIN_KEY });
    expect(post.status).toBe(200);
    // Express answers unmatched routes with its HTML 404 page — use a raw
    // fetch instead of req() (which JSON-parses every response body).
    const get = await fetch(`${base}/api/schedule/ensure-writable`, {
      headers: { 'X-API-Key': ADMIN_KEY },
    });
    expect(get.status).toBe(404);
  });
});
