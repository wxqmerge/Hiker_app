import { describe, it, expect, vi, beforeEach } from 'vitest';
import { request, getTrails, getGpx, uploadGpxFile, updateTrail, deleteTrail, getTrailDetails, updateTrailDetail, getLookup, getSchedule, updateSchedule, getScheduleHistory, restoreSchedule, ensureScheduleWritable, reloadSchedule, exportDataZip, importDataZip } from '../../api/client';

vi.mock('../../utils/url', () => ({
  getApiBase: () => 'http://test.local',
}));

beforeEach(() => {
  vi.resetModules();
  globalThis.fetch = vi.fn();
  Object.defineProperty(global, 'localStorage', {
    value: { getItem: vi.fn(() => 'test-key'), setItem: vi.fn() },
    writable: true,
  });
});

describe('request', () => {
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

  it('makes GET request', async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: 'test' }),
      headers: { get: () => null },
      status: 200,
    });
    const { request } = await import('../../api/client');
    const result = await request('/api/test');
    expect(result).toHaveProperty('data');
  });

  it('throws on error when throwOnError is true', async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: { message: 'Not found' } }),
      status: 404,
    });
    const { request } = await import('../../api/client');
    await expect(request('/api/test')).rejects.toThrow('Not found');
  });

  it('returns error object when throwOnError is false', async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: { message: 'Not found' } }),
      status: 404,
    });
    const { request } = await import('../../api/client');
    const result = await request('/api/test', { throwOnError: false });
    expect(result).toHaveProperty('error');
    expect(result).toHaveProperty('status', 404);
  });

  it('returns blob response', async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['test'])),
      status: 200,
    });
    const { request } = await import('../../api/client');
    const result = await request('/api/test', { responseType: 'blob' });
    expect(result).toBeInstanceOf(Blob);
  });

  it('returns text response', async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('test text'),
      status: 200,
    });
    const { request } = await import('../../api/client');
    const result = await request('/api/test', { responseType: 'text' });
    expect(result).toBe('test text');
  });
});

describe('getTrails', () => {
  it('returns trails array', async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ trails: [{ id: 'trail-1' }] }),
      headers: { get: () => null },
      status: 200,
    });
    const { getTrails } = await import('../../api/client');
    const trails = await getTrails();
    expect(trails).toHaveLength(1);
    expect(trails[0].id).toBe('trail-1');
  });

  it('returns empty array when no trails', async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
      headers: { get: () => null },
      status: 200,
    });
    const { getTrails } = await import('../../api/client');
    const trails = await getTrails();
    expect(trails).toEqual([]);
  });
});

describe('getGpx', () => {
  it('returns GPX content', async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('<gpx></gpx>'),
      status: 200,
    });
    const { getGpx } = await import('../../api/client');
    const gpx = await getGpx('trail-1');
    expect(gpx).toBe('<gpx></gpx>');
  });

  it('returns null for 404', async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: { message: 'HTTP 404' } }),
      status: 404,
    });
    const { getGpx } = await import('../../api/client');
    const gpx = await getGpx('trail-1');
    expect(gpx).toBeNull();
  });
});

describe('gpx cache invalidation', () => {
  it('refetches GPX after an upload replaces the file', async () => {
    const { getGpx, uploadGpxFile } = await import('../../api/client');
    const responses = [
      { ok: true, status: 200, headers: { get: () => null }, text: () => Promise.resolve('<gpx>A</gpx>') },
      { ok: true, status: 200, headers: { get: () => null }, json: () => Promise.resolve({ success: true }) },
      { ok: true, status: 200, headers: { get: () => null }, text: () => Promise.resolve('<gpx>B</gpx>') },
    ];
    (globalThis.fetch as any).mockImplementation(() => Promise.resolve(responses.shift()));

    expect(await getGpx('trail-1')).toBe('<gpx>A</gpx>');
    expect(await getGpx('trail-1')).toBe('<gpx>A</gpx>'); // served from cache
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    await uploadGpxFile('trail-1', new Blob(['<gpx/>'], { type: 'application/gpx+xml' }));
    expect(await getGpx('trail-1')).toBe('<gpx>B</gpx>'); // stale entry evicted
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
  });
});

describe('updateTrail', () => {
  it('sends PUT request with trail data', async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
      headers: { get: () => null },
      status: 200,
    });
    const { updateTrail } = await import('../../api/client');
    await updateTrail({ id: 'trail-1', name: 'Updated' });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/trails/trail-1'),
      expect.objectContaining({ method: 'PUT' })
    );
  });
});

describe('deleteTrail', () => {
  it('sends DELETE request', async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
      headers: { get: () => null },
      status: 200,
    });
    const { deleteTrail } = await import('../../api/client');
    await deleteTrail('trail-1');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/trails/trail-1'),
      expect.objectContaining({ method: 'DELETE' })
    );
  });
});

describe('getSchedule', () => {
  it('returns schedule data', async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ Jan: [] }),
      headers: { get: () => null },
      status: 200,
    });
    const { getSchedule } = await import('../../api/client');
    const schedule = await getSchedule();
    expect(schedule).toHaveProperty('Jan');
  });
});

describe('updateSchedule', () => {
  it('sends PUT request with schedule data', async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
      headers: { get: () => null },
      status: 200,
    });
    const { updateSchedule } = await import('../../api/client');
    await updateSchedule({ Jan: [{ day: 1, trail_id: 'trail-1' }] });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/schedule'),
      expect.objectContaining({ method: 'PUT' })
    );
  });

  it('refuses to save an empty schedule without confirmation', async () => {
    const { updateSchedule } = await import('../../api/client');
    await expect(updateSchedule({ Jan: [] })).rejects.toThrow('Refusing to save an empty schedule');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('sends an empty schedule when confirmation is provided', async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
      headers: { get: () => null },
      status: 200,
    });
    const { updateSchedule } = await import('../../api/client');
    await updateSchedule({ Jan: [] }, { confirmEmpty: true });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/schedule'),
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({ 'X-Confirm-Empty': 'true' }),
      })
    );
  });
});

describe('schedule etag precondition (If-Match)', () => {
  it('getSchedule captures the response ETag', async () => {
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ Jan: [] }),
      headers: { get: (h: string) => (h === 'etag' ? 'v1' : null) },
    });
    const { getSchedule, getScheduleEtag } = await import('../../api/client');
    const schedule = await getSchedule();
    expect(schedule).toEqual({ Jan: [] });
    expect(schedule).not.toHaveProperty('_etag');
    expect(getScheduleEtag()).toBe('v1');
  });

  it('updateSchedule sends If-Match and adopts the returned ETag', async () => {
    (globalThis.fetch as any)
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve({ Jan: [] }),
        headers: { get: (h: string) => (h === 'etag' ? 'v1' : null) },
      })
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve({ success: true, etag: 'v2' }),
        headers: { get: () => null },
      });
    const { getSchedule, updateSchedule, getScheduleEtag } = await import('../../api/client');
    await getSchedule();
    await updateSchedule({ Jan: [{ day: 1, trail_id: 'trail-1' }] });
    expect(globalThis.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining('/api/schedule'),
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({ 'If-Match': 'v1' }),
      })
    );
    expect(getScheduleEtag()).toBe('v2');
  });

  it('updateSchedule omits If-Match when no ETag was seen', async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true, status: 200,
      json: () => Promise.resolve({ success: true }),
      headers: { get: () => null },
    });
    const { updateSchedule } = await import('../../api/client');
    await updateSchedule({ Jan: [{ day: 1, trail_id: 'trail-1' }] });
    const sentHeaders = (globalThis.fetch as any).mock.calls.at(-1)[1].headers;
    expect(sentHeaders['If-Match']).toBeUndefined();
  });

  it('updateSchedule adopts the server ETag on 412 and rethrows', async () => {
    (globalThis.fetch as any)
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve({ Jan: [] }),
        headers: { get: (h: string) => (h === 'etag' ? 'v1' : null) },
      })
      .mockResolvedValueOnce({
        ok: false, status: 412,
        json: () => Promise.resolve({ success: false, error: { message: 'Schedule changed on the server since it was loaded. Reload the latest schedule before saving.' } }),
        headers: { get: (h: string) => (h === 'etag' ? 'v9' : null) },
      });
    const { getSchedule, updateSchedule, getScheduleEtag } = await import('../../api/client');
    await getSchedule();
    await expect(updateSchedule({ Jan: [{ day: 1, trail_id: 'trail-1' }] })).rejects.toThrow('Schedule changed');
    expect(getScheduleEtag()).toBe('v9');
  });

  it('restoreSchedule adopts the post-restore ETag', async () => {
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true, status: 200,
      json: () => Promise.resolve({ success: true, schedule: {}, etag: 'v3' }),
      headers: { get: () => null },
    });
    const { restoreSchedule, getScheduleEtag } = await import('../../api/client');
    await restoreSchedule('1700000000000');
    expect(getScheduleEtag()).toBe('v3');
  });
});

describe('getTrailDetails', () => {
  it('returns trail details', async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ 'trail-1': { fullDescription: 'Test' } }),
      headers: { get: () => null },
      status: 200,
    });
    const { getTrailDetails } = await import('../../api/client');
    const details = await getTrailDetails();
    expect(details).toHaveProperty('trail-1');
  });
});

describe('getLookup', () => {
  it('returns lookup data', async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ lookup: {} }),
      headers: { get: () => null },
      status: 200,
    });
    const { getLookup } = await import('../../api/client');
    const lookup = await getLookup();
    expect(lookup).toHaveProperty('lookup');
  });
});

describe('ensureScheduleWritable', () => {
  it('returns null on failure', async () => {
    (globalThis.fetch as any).mockRejectedValue(new Error('Failed'));
    const { ensureScheduleWritable } = await import('../../api/client');
    const result = await ensureScheduleWritable();
    expect(result).toBeNull();
  });
});

describe('exportDataZip', () => {
  it('returns blob', async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['zip'])),
      status: 200,
    });
    const { exportDataZip } = await import('../../api/client');
    const result = await exportDataZip();
    expect(result).toBeInstanceOf(Blob);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/data/export-zip'),
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-API-Key': 'test-key' }),
      })
    );
  });
});

describe('getScheduleHistory', () => {
  it('returns schedule history', async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ history: [] }),
      headers: { get: () => null },
      status: 200,
    });
    const { getScheduleHistory } = await import('../../api/client');
    const history = await getScheduleHistory();
    expect(history).toHaveProperty('history');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/schedule/history'),
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-API-Key': 'test-key' }),
      })
    );
  });
});

describe('restoreSchedule', () => {
  it('sends POST request with timestamp', async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
      headers: { get: () => null },
      status: 200,
    });
    const { restoreSchedule } = await import('../../api/client');
    await restoreSchedule('2024-01-01');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/schedule/history/restore'),
      expect.objectContaining({ method: 'POST' })
    );
  });
});

describe('reloadSchedule', () => {
  it('sends POST request', async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
      headers: { get: () => null },
      status: 200,
    });
    const { reloadSchedule } = await import('../../api/client');
    await reloadSchedule();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/schedule/reload'),
      expect.objectContaining({ method: 'POST' })
    );
  });
});

describe('uploadGpxFile', () => {
  it('sends POST request with FormData', async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
      headers: { get: () => null },
      status: 200,
    });
    const { uploadGpxFile } = await import('../../api/client');
    const file = new File(['test'], 'test.gpx', { type: 'application/gpx+xml' });
    await uploadGpxFile('trail-1', file);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/trails/gpx/trail-1'),
      expect.objectContaining({ method: 'POST' })
    );
  });
});

describe('importDataZip', () => {
  it('sends POST request with FormData', async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
      headers: { get: () => null },
      status: 200,
    });
    const { importDataZip } = await import('../../api/client');
    const file = new File(['test'], 'test.zip', { type: 'application/zip' });
    await importDataZip(file);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/data/import-zip'),
      expect.objectContaining({ method: 'POST' })
    );
  });
});

describe('updateTrailDetail', () => {
  it('sends PUT request with detail data', async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
      headers: { get: () => null },
      status: 200,
    });
    const { updateTrailDetail } = await import('../../api/client');
    await updateTrailDetail('trail-1', { fullDescription: 'Updated' });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/trails/details/trail-1'),
      expect.objectContaining({ method: 'PUT' })
    );
  });
});
