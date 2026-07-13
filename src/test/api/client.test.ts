import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch and getApiBase
vi.mock('../../utils/url', () => ({
  getApiBase: () => 'http://test.local',
}));

describe('request', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('does not wrap array responses with metadata', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'test-etag' },
      json: () => Promise.resolve([{ id: 1 }, { id: 2 }]),
    });

    const { request } = await import('../../api/client');
    const data = await request('/api/test');
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(2);
    expect(data).not.toHaveProperty('_etag');
    expect(data).not.toHaveProperty('_status');
  });

  it('wraps object responses with metadata', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'test-etag' },
      json: () => Promise.resolve({ key: 'value' }),
    });

    const { request } = await import('../../api/client');
    const data = await request('/api/test');
    expect(data).toEqual({ key: 'value', _etag: 'test-etag', _status: 200 });
  });

  it('strips metadata when stripMetadata is true', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'test-etag' },
      json: () => Promise.resolve({ key: 'value' }),
    });

    const { request } = await import('../../api/client');
    const data = await request('/api/test', { stripMetadata: true });
    expect(data).toEqual({ key: 'value' });
    expect(data).not.toHaveProperty('_etag');
    expect(data).not.toHaveProperty('_status');
  });

  it('handles empty array responses', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => null },
      json: () => Promise.resolve([]),
    });

    const { request } = await import('../../api/client');
    const data = await request('/api/test');
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(0);
  });
});
