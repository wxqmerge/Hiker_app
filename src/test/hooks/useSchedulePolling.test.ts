import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSchedulePolling } from '../../hooks/useSchedulePolling';
import { setScheduleEtag } from '../../api/client';

vi.mock('../../utils/url', () => ({ getApiBase: () => '' }));
vi.mock('../../api/client', () => ({ setScheduleEtag: vi.fn() }));

describe('useSchedulePolling', () => {
  let calls: string[];

  beforeEach(() => {
    calls = [];
    globalThis.fetch = vi.fn(async (url: string) => {
      calls.push(String(url));
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({ '2026-06': [] }),
      };
    }) as ReturnType<typeof vi.fn>;
  });

  it('polls immediately on visibilitychange instead of waiting for the interval', async () => {
    const store = { setSchedule: vi.fn() };
    // Interval far in the future: only the visibility event can trigger a poll.
    renderHook(() => useSchedulePolling(store, 100000));
    expect(calls.length).toBe(0);

    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    await act(async () => {}); // flush the async poll

    expect(calls.some(u => u.includes('/api/schedule'))).toBe(true);
    expect(store.setSchedule).toHaveBeenCalledWith({ '2026-06': [] });
  });

  it('does not poll while the document is hidden', async () => {
    const store = { setSchedule: vi.fn() };
    renderHook(() => useSchedulePolling(store, 100000));
    const hiddenSpy = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    try {
      act(() => { document.dispatchEvent(new Event('visibilitychange')); });
      await act(async () => {});
      expect(calls.length).toBe(0);
    } finally {
      hiddenSpy.mockRestore();
    }
  });
});

// Etag sync + interval behavior (merged from the former useSchedulePolling.test.js)
function jsonResponse(schedule: unknown, etag: string) {
  return {
    ok: true,
    status: 200,
    headers: { get: (h: string) => (String(h).toLowerCase() === 'etag' ? etag : null) },
    json: async () => schedule,
  };
}

const scheduleA = { Jun: [{ day: 1, trail_id: 'trail-1' }] };
const scheduleB = { Jun: [{ day: 1, trail_id: 'trail-2' }] };

describe('useSchedulePolling etag + interval', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('applies changed schedule data and syncs the etag to the save path', async () => {
    const setSchedule = vi.fn();
    (globalThis.fetch as any).mockResolvedValueOnce(jsonResponse(scheduleA, 'v1'));
    renderHook(() => useSchedulePolling({ setSchedule }, 1000));

    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });

    expect(setSchedule).toHaveBeenCalledTimes(1);
    expect(setSchedule).toHaveBeenCalledWith(scheduleA);
    expect(setScheduleEtag).toHaveBeenCalledWith('v1');
  });

  it('sends If-None-Match after the first etag and applies nothing on 304', async () => {
    const setSchedule = vi.fn();
    (globalThis.fetch as any)
      .mockResolvedValueOnce(jsonResponse(scheduleA, 'v1'))
      .mockResolvedValueOnce({ ok: true, status: 304, headers: { get: () => null }, json: async () => ({}) });
    renderHook(() => useSchedulePolling({ setSchedule }, 1000));

    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect((globalThis.fetch as any).mock.calls[1][1].headers['If-None-Match']).toBe('v1');
    // Only the first (changed) poll applied data; the 304 applied nothing.
    expect(setSchedule).toHaveBeenCalledTimes(1);
  });

  it('does not re-apply identical data on later polls', async () => {
    const setSchedule = vi.fn();
    (globalThis.fetch as any)
      .mockResolvedValueOnce(jsonResponse(scheduleA, 'v1'))
      .mockResolvedValueOnce(jsonResponse(scheduleA, 'v2'));
    renderHook(() => useSchedulePolling({ setSchedule }, 1000));

    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });

    expect(setSchedule).toHaveBeenCalledTimes(1);
    // Etag still advanced even though data was skipped.
    expect(setScheduleEtag).toHaveBeenCalledWith('v2');
  });

  it('survives network errors and keeps polling', async () => {
    const setSchedule = vi.fn();
    (globalThis.fetch as any)
      .mockResolvedValueOnce(jsonResponse(scheduleA, 'v1'))
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(jsonResponse(scheduleB, 'v2'));
    renderHook(() => useSchedulePolling({ setSchedule }, 1000));

    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });

    expect(setSchedule).toHaveBeenCalledTimes(2);
    expect(setSchedule).toHaveBeenLastCalledWith(scheduleB);
  });
});
