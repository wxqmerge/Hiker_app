import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs/promises';

// index.ts reads TRUST_PROXY at module-load time, so each assertion needs a
// fresh module graph - vi.resetModules() + re-import, same
// env-before-dynamic-import pattern as the route tests.
const DATA_DIR = `tmp/vitest-trustproxy-${process.pid}`;

async function trustProxySetting(envValue: string | undefined): Promise<unknown> {
  vi.resetModules();
  if (envValue === undefined) delete process.env.TRUST_PROXY;
  else process.env.TRUST_PROXY = envValue;
  const mod = await import('../src/index.js');
  return mod.default.get('trust proxy');
}

beforeAll(async () => {
  process.env.DATA_DIR = DATA_DIR;
  process.env.SCHEDULE_NAME = 'vitest';
  process.env.ADMIN_API_KEY = 'vitest-admin-key';
  await fs.mkdir(DATA_DIR, { recursive: true });
});

afterAll(async () => {
  delete process.env.TRUST_PROXY;
  await fs.rm(DATA_DIR, { recursive: true, force: true });
});

describe('TRUST_PROXY parsing', () => {
  it('defaults to 1 hop when unset (lone nginx)', async () => {
    expect(await trustProxySetting(undefined)).toBe(1);
  });

  it('accepts explicit hop counts - Cloudflare + nginx is 2', async () => {
    expect(await trustProxySetting('2')).toBe(2);
  });

  it('disables proxy trust for 0/false (Node exposed directly)', async () => {
    expect(await trustProxySetting('0')).toBe(false);
    expect(await trustProxySetting('false')).toBe(false);
  });

  it('falls back to 1 on unparsable values', async () => {
    expect(await trustProxySetting('nine')).toBe(1);
  });
});
