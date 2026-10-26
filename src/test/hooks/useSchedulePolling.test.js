import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSchedulePolling } from '../../hooks/useSchedulePolling.js';
import { setScheduleEtag } from '../../api/client.js';

vi.mock('../../utils/url.js', () => ({ getApiBase: () => '' }));
vi.mock('../../api/client.js', () => ({ setScheduleEtag: vi.fn() }));

function jsonResponse(schedule, etag) {
  return {
    ok: true,
    status: 200,
    headers: { get: (h) => (String(h).toLowerCase() === 'etag' ? etag : null) },
    json: async () => schedule,
  };
}

const scheduleA = { Jun: [{ day: 1, trail_id: 'trail-1' }] };
const scheduleB = { Jun: [{ day: 1, trail_id: 'trail-2' }] };

describe('useSchedulePolling', () => {
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
    globalThis.fetch.mockResolvedValueOnce(jsonResponse(scheduleA, 'v1'));
    renderHook(() => useSchedulePolling({ setSchedule }, 1000));

    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });

    expect(setSchedule).toHaveBeenCalledTimes(1);
    expect(setSchedule).toHaveBeenCalledWith(scheduleA);
    expect(setScheduleEtag).toHaveBeenCalledWith('v1');
  });

  it('sends If-None-Match after the first etag and applies nothing on 304', async () => {
    const setSchedule = vi.fn();
    globalThis.fetch
      .mockResolvedValueOnce(jsonResponse(scheduleA, 'v1'))
      .mockResolvedValueOnce({ ok: true, status: 304, headers: { get: () => null }, json: async () => ({}) });
    renderHook(() => useSchedulePolling({ setSchedule }, 1000));

    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(globalThis.fetch.mock.calls[1][1].headers['If-None-Match']).toBe('v1');
    // Only the first (changed) poll applied data; the 304 applied nothing.
    expect(setSchedule).toHaveBeenCalledTimes(1);
  });

  it('does not re-apply identical data on later polls', async () => {
    const setSchedule = vi.fn();
    globalThis.fetch
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
    globalThis.fetch
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
