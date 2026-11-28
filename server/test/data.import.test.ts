import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import AdmZip from 'adm-zip';

// Env (incl. the import decompression cap) is read at module-load time, so
// it is set here before the router is dynamically imported.
const ADMIN_KEY = 'vitest-admin-key';

let DATA_DIR: string;
let base: string;
let server: import('node:http').Server;
let loadData: () => Promise<void>;

beforeAll(async () => {
  const dataDirName = `tmp/vitest-import-${process.pid}`;
  process.env.DATA_DIR = dataDirName;
  process.env.SCHEDULE_NAME = 'vitest';
  process.env.ADMIN_API_KEY = ADMIN_KEY;
  process.env.ADMIN_AUTH_FAILURE_DELAY_MS = '0';
  process.env.MAX_IMPORT_UNCOMPRESSED_MB = '1'; // tiny budget: 1 MiB

  const paths = await import('../src/utils/paths.js');
  const ds = await import('../src/services/dataService.js');
  loadData = ds.loadData;
  DATA_DIR = paths.DATA_DIR;

  await fs.mkdir(DATA_DIR, { recursive: true });
  await loadData();

  const { router } = await import('../src/routes/data.routes.js');
  const app = express();
  app.use('/api/data', router);

  await new Promise<void>((resolve) => { server = app.listen(0, () => resolve()); });
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
});

afterAll(async () => {
  delete process.env.MAX_IMPORT_UNCOMPRESSED_MB;
  if (server) await new Promise((r) => server.close(r));
  if (DATA_DIR) await fs.rm(DATA_DIR, { recursive: true, force: true });
});

function makeZip(entries: Array<[string, Buffer]>): Buffer {
  const zip = new AdmZip();
  for (const [name, buf] of entries) zip.addFile(name, buf);
  return zip.toBuffer();
}

async function importZip(zipBuf: Buffer) {
  const fd = new FormData();
  fd.append('zip', new Blob([zipBuf], { type: 'application/zip' }), 'data.zip');
  const res = await fetch(`${base}/api/data/import-zip`, {
    method: 'POST',
    headers: { 'X-API-Key': ADMIN_KEY },
    body: fd,
  });
  return { status: res.status, json: await res.json() };
}

describe('import-zip decompression caps', () => {
  it('stops the import once the total uncompressed budget is blown', async () => {
    const trails = Buffer.from(JSON.stringify({ trails: [{ id: 'zip-ok', name: 'ZipOk' }] }));
    // 2 MiB of highly compressible bytes: tiny zip, oversized declaration.
    const bomb = Buffer.alloc(2 * 1024 * 1024, 0x41);
    const out = await importZip(makeZip([
      ['trails.json', trails],
      ['trail_details.json', bomb],
    ]));

    expect(out.status).toBe(200);
    expect(out.json.success).toBe(false);
    expect(out.json.errors.join(' ')).toMatch(/uncompressed size cap/i);

    // The bomb never got expanded or written. (Which, if any, of the small
    // legit entries landed depends on AdmZip's entry ordering - not part of
    // the contract; the guarantee is that the oversized entry is refused.)
    await expect(fs.stat(path.join(DATA_DIR, 'trail_details.json'))).rejects.toThrow();
  });

  it('imports a normal zip without tripping any cap', async () => {
    const out = await importZip(makeZip([
      ['trails.json', Buffer.from(JSON.stringify({ trails: [{ id: 'zip-ok', name: 'ZipOk' }] }))],
      ['trail_details.json', Buffer.from(JSON.stringify({ 'zip-ok': { pros: 'fine' } }))],
    ]));

    expect(out.status).toBe(200);
    expect(out.json.success).toBe(true);
    expect(out.json.imported).toBe(2);
    const details = JSON.parse(await fs.readFile(path.join(DATA_DIR, 'trail_details.json'), 'utf-8'));
    expect(details['zip-ok'].pros).toBe('fine');
  });
});
