import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSchedulePolling } from '../../hooks/useSchedulePolling';

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
