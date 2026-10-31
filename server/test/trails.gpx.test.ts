import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';

// Env is read at module-load time by paths/dataService, so everything is set
// up in beforeAll and modules are imported dynamically (same pattern as
// schedule.routes.test.ts).
const ADMIN_KEY = 'vitest-admin-key';

const GPX_A = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="vitest"><trk><name>Alpha loop</name><trkseg><trkpt lat="47.50" lon="-123.10"><ele>10</ele><time>2026-01-01T10:00:00Z</time></trkpt><trkpt lat="47.51" lon="-123.11"><ele>25</ele><time>2026-01-01T10:12:00Z</time></trkpt><trkpt lat="47.52" lon="-123.12"><ele>40</ele><time>2026-01-01T10:25:00Z</time></trkpt></trkseg></trk></gpx>`;
const GPX_B = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="intruder"><trk><name>Beta — different hike entirely</name><trkseg><trkpt lat="48.10" lon="-124.90"><ele>300</ele><time>2025-05-05T09:00:00Z</time></trkpt><trkpt lat="48.11" lon="-124.91"><ele>360</ele><time>2025-05-05T09:40:00Z</time></trkpt></trkseg></trk></gpx>`;

let DATA_DIR: string;
let base: string;
let server: import('node:http').Server;
let loadData: () => Promise<void>;
let getScheduleFile: () => string;

const sha1hex = (s: string) => crypto.createHash('sha1').update(s).digest('hex');
const trailFile = () => path.join(DATA_DIR, 'trails.json');

async function readTrail(id: string) {
  const data = JSON.parse(await fs.readFile(trailFile(), 'utf-8'));
  return data.trails.find((t: { id: string }) => t.id === id);
}

async function uploadGpx(id: string, content: string) {
  const fd = new FormData();
  fd.append('gpx', new Blob([content], { type: 'application/gpx+xml' }), 'upload.gpx');
  const res = await fetch(`${base}/api/trails/gpx/${id}`, {
    method: 'POST',
    headers: { 'X-API-Key': ADMIN_KEY },
    body: fd,
  });
  return { status: res.status, json: await res.json() };
}

beforeAll(async () => {
  const dataDirName = `tmp/vitest-gpx-${process.pid}`;
  process.env.DATA_DIR = dataDirName;
  process.env.SCHEDULE_NAME = 'vitest';
  process.env.ADMIN_API_KEY = ADMIN_KEY;
  process.env.ADMIN_AUTH_FAILURE_DELAY_MS = '0';

  const paths = await import('../src/utils/paths.js');
  const ds = await import('../src/services/dataService.js');
  loadData = ds.loadData;
  getScheduleFile = ds.getScheduleFile;
  DATA_DIR = paths.DATA_DIR;

  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(path.join(DATA_DIR, 'schedule_history'), { recursive: true });
  await fs.writeFile(trailFile(), JSON.stringify({ trails: [{ id: 'zion', name: 'MtZion', fullName: 'Mt. Zion' }] }));
  await fs.writeFile(path.join(DATA_DIR, getScheduleFile()), JSON.stringify({}));
  await fs.writeFile(path.join(DATA_DIR, 'gpx_index.json'), JSON.stringify({}));
  await loadData();

  const { router } = await import('../src/routes/trails.routes.js');
  const app = express();
  app.use(express.json());
  app.use('/api/trails', router);

  await new Promise<void>((resolve) => { server = app.listen(0, () => resolve()); });
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
});

afterAll(async () => {
  if (server) await new Promise((r) => server.close(r));
  if (DATA_DIR) await fs.rm(DATA_DIR, { recursive: true, force: true });
});

describe('GPX fingerprint (gpxBytes/gpxModified/gpxSha1)', () => {
  it('is stamped on the trail record when a GPX is uploaded', async () => {
    const up = await uploadGpx('zion', GPX_A);
    expect(up.status).toBe(200);

    const t = await readTrail('zion');
    expect(t.gpxBytes).toBe(Buffer.byteLength(GPX_A, 'utf-8'));
    expect(t.gpxSha1).toBe(sha1hex(GPX_A));
    expect(Number.isNaN(Date.parse(t.gpxModified))).toBe(false);
  });

  it('serves cleanly with a matching fingerprint (no integrity header)', async () => {
    const res = await fetch(`${base}/api/trails/gpx/zion`);
    expect(res.status).toBe(200);
    expect(res.headers.get('x-gpx-integrity')).toBeNull();
    expect(await res.text()).toBe(GPX_A);
  });

  it('flags mismatch when the on-disk file was swapped after stamping', async () => {
    await fs.writeFile(path.join(DATA_DIR, 'gpx', 'zion.gpx'), GPX_B, 'utf-8');
    const res = await fetch(`${base}/api/trails/gpx/zion`);
    expect(res.status).toBe(200); // still served — availability first
    expect(res.headers.get('x-gpx-integrity')).toBe('mismatch');
  });

  it('is re-stamped (mismatch cleared) when the correct file is re-uploaded', async () => {
    const up = await uploadGpx('zion', GPX_A);
    expect(up.status).toBe(200);
    const t = await readTrail('zion');
    expect(t.gpxSha1).toBe(sha1hex(GPX_A));

    const res = await fetch(`${base}/api/trails/gpx/zion`);
    expect(res.headers.get('x-gpx-integrity')).toBeNull();
  });

  it('is cleared when the GPX is removed from the trail', async () => {
    const res = await fetch(`${base}/api/trails/zion`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': ADMIN_KEY },
      body: JSON.stringify({ gpxFile: '' }),
    });
    expect(res.status).toBe(200);
    const t = await readTrail('zion');
    expect(t.gpxBytes).toBeUndefined();
    expect(t.gpxSha1).toBeUndefined();
    expect(t.hasGpx).toBe(false);
  });
});
