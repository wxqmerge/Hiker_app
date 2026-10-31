import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTrailStore, setSchedule, resetTrailStore } from '../../hooks/useTrailStore';

// NOTE: no vi.mock('../../api/client.js') here — the test setup loads the
// store module before test-file mocks can apply, so the store always uses the
// REAL client with the global fetch mock from src/test/setup.ts. Failures are
// therefore injected at the fetch boundary.

describe('useTrailStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetTrailStore();
  });

  it('returns expected properties', async () => {
    const { result } = renderHook(() => useTrailStore());
    await act(async () => {});
    expect(result.current).toHaveProperty('trails');
    expect(result.current).toHaveProperty('trailDetails');
    expect(result.current).toHaveProperty('loading');
    expect(result.current).toHaveProperty('lookup');
    expect(result.current).toHaveProperty('schedule');
    expect(result.current).toHaveProperty('saveTrail');
    expect(result.current).toHaveProperty('saveTrailDetail');
    expect(result.current).toHaveProperty('deleteTrail');
    expect(result.current).toHaveProperty('exportJSON');
    expect(result.current).toHaveProperty('importJSON');
    expect(result.current).toHaveProperty('setSchedule');
  });

  it('loads trails from API', async () => {
    const { result } = renderHook(() => useTrailStore());
    await act(async () => {});
    expect(result.current.trails.length).toBeGreaterThan(0);
  });

  it('loads trailDetails from API', async () => {
    const { result } = renderHook(() => useTrailStore());
    await act(async () => {});
    expect(result.current.trailDetails).toHaveProperty('trail-1');
  });

  it('sets schedule', async () => {
    const { result } = renderHook(() => useTrailStore());
    await act(async () => {});
    act(() => {
      result.current.setSchedule({ Jan: { 1: [{ trail_id: 'trail-1' }] } });
    });
    expect(result.current.schedule).toEqual({ Jan: { 1: [{ trail_id: 'trail-1' }] } });
  });

  it('exports JSON', async () => {
    const { result } = renderHook(() => useTrailStore());
    await act(async () => {});
    const exported = await result.current.exportJSON();
    expect(exported).toHaveProperty('trails');
    expect(exported).toHaveProperty('trailDetails');
  });

  it('resets trail store', () => {
    setSchedule({ Jan: { 1: [{ trail_id: 'trail-1' }] } });
    resetTrailStore();
    const { result } = renderHook(() => useTrailStore());
    expect(result.current.schedule).toBeNull();
  });

  it('clears loading when initial data fetch fails', async () => {
    // Let the in-flight initSharedState from the beforeEach reset settle.
    await act(async () => {});
    // The store was module-loaded by the test setup with the real client, so
    // force the failure at the fetch boundary.
    globalThis.fetch = vi.fn(() => Promise.reject(new Error('offline')));
    resetTrailStore();
    const { result } = renderHook(() => useTrailStore());
    await act(async () => {});
    expect(result.current.loading).toBe(false);
    expect(result.current.trails).toEqual([]);
  });

  it('keeps successful endpoints when one startup fetch fails', async () => {
    await act(async () => {}); // settle the init started by beforeEach
    const baseFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
    globalThis.fetch = vi.fn(async (url: string, opts?: RequestInit) => {
      const u = String(url);
      // fail trails but not trails/details
      if (u.includes('/api/trails') && !u.includes('/details')) throw new Error('503');
      return baseFetch(url, opts);
    });
    resetTrailStore();
    const { result } = renderHook(() => useTrailStore());
    await act(async () => {});
    // The endpoints that answered must survive the failure of the others.
    expect(result.current.trailDetails).toHaveProperty('trail-1');
    expect(result.current.schedule).toBeTruthy();
    expect(result.current.loading).toBe(false);
    expect(result.current.trails).toEqual([]);
  });

  it('rolls back local trails when saveTrail fails', async () => {
    const { result } = renderHook(() => useTrailStore());
    await act(async () => {});
    const namesBefore = result.current.trails.map(t => t.name);
    globalThis.fetch = vi.fn(() =>
      Promise.resolve({ ok: false, status: 500, headers: { get: () => null }, json: async () => ({ error: { message: 'boom' } }) })
    );
    await expect(result.current.saveTrail({ id: 'trail-1', name: 'Renamed' })).rejects.toThrow('boom');
    expect(result.current.trails.map(t => t.name)).toEqual(namesBefore);
  });

  it('importJSON surfaces a failure, leaves local state untouched, and shows the server is partially imported', async () => {
    const { result } = renderHook(() => useTrailStore());
    await act(async () => {});
    const namesBefore = result.current.trails.map(t => t.name);

    let puts = 0;
    globalThis.fetch = vi.fn(async (_url: string, opts?: { method?: string }) => {
      if (opts?.method === 'PUT') {
        puts++;
        if (puts === 2) {
          return { ok: false, status: 500, headers: { get: () => null }, json: async () => ({ error: { message: 'import failed' } }) };
        }
        return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({}) };
      }
      return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({}) };
    });

    const payload = {
      trails: [{ id: 'imp-a', name: 'A' }, { id: 'imp-b', name: 'B' }, { id: 'imp-c', name: 'C' }],
    };
    await expect(result.current.importJSON(payload)).rejects.toThrow('import failed');
    // First PUT succeeded server-side before the second failed: the server is
    // partially imported while local state is untouched — documents the
    // known no-rollback behavior of importJSON.
    expect(puts).toBe(2);
    expect(result.current.trails.map(t => t.name)).toEqual(namesBefore);
  });
});
