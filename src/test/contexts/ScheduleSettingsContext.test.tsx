/**
 * Save-flow tests for ScheduleSettingsContext: debounced autosave, 412
 * conflict handling, and the keyless skip. The api client module is mocked —
 * the context module graph (unlike useTrailStore) is NOT pre-loaded by the
 * test setup, so vi.mock applies here.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const ui = vi.hoisted(() => ({ key: { has: true }, toast: vi.fn() }));

vi.mock('../../api/client', () => ({
  updateSchedule: vi.fn(async () => ({ success: true, etag: 'v2' })),
  getScheduleHistory: vi.fn(async () => []),
  restoreSchedule: vi.fn(async () => ({ success: true, schedule: {} })),
  getSchedule: vi.fn(async () => ({})),
  getTrails: vi.fn(async () => []),
  reloadSchedule: vi.fn(async () => ({})),
}));
vi.mock('../../hooks/useSchedulePolling', () => ({ useSchedulePolling: () => {} }));
vi.mock('../../hooks/useApiKey', () => ({ useApiKey: () => ui.key.has }));
vi.mock('../../hooks/useToast', () => ({ useToast: () => ui.toast }));

import { ScheduleSettingsProvider, useScheduleSettings } from '../../contexts/ScheduleSettingsContext';
import { MonthContextProvider } from '../../contexts/MonthContext';
import { setSchedule } from '../../hooks/useTrailStore';
import { updateSchedule } from '../../api/client';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MonthContextProvider>
    <ScheduleSettingsProvider>{children}</ScheduleSettingsProvider>
  </MonthContextProvider>
);

// Adds a hike on day 9 of the seeded month via the context setter.
function editSchedule(result: { current: ReturnType<typeof useScheduleSettings> }) {
  act(() => {
    result.current.setScheduleStore((prev: Record<string, unknown>) => {
      const next = JSON.parse(JSON.stringify(prev));
      const monthKey = Object.keys(next)[0];
      next[monthKey]['9'] = [{ trail_id: 'trail-2', early_start: 0, leader: 'Zoe' }];
      return next;
    });
  });
}

describe('ScheduleSettingsContext save flow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    ui.key.has = true;
    // Server schedule the provider will sync into its store on mount.
    setSchedule({ '2026-06': [{ day: 3, slot: 0, trail_id: 'trail-1', early_start: 0, leader: 'Alice' }] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('autosaves an edited schedule once the debounce window elapses', async () => {
    const { result } = renderHook(() => useScheduleSettings(), { wrapper });
    await act(async () => { await vi.advanceTimersByTimeAsync(1100); });
    // Mount sync alone must not trigger a save.
    expect(updateSchedule).not.toHaveBeenCalled();

    editSchedule(result);
    await act(async () => { await vi.advanceTimersByTimeAsync(1100); });

    expect(updateSchedule).toHaveBeenCalledTimes(1);
    const body = vi.mocked(updateSchedule).mock.calls[0][0] as Record<string, Array<{ day: number; leader: string }>>;
    expect(body['2026-06'].some(e => e.day === 9 && e.leader === 'Zoe')).toBe(true);
    expect(result.current.saveStatus).toBe('saved');
    expect(ui.toast).toHaveBeenCalledWith('Schedule saved', 'success');
  });

  it('reports a conflict and keeps edits unsaved when the server returns 412', async () => {
    const conflict = Object.assign(
      new Error('Schedule changed on the server since it was loaded. Reload the latest schedule before saving.'),
      { status: 412 }
    );
    vi.mocked(updateSchedule).mockRejectedValueOnce(conflict);

    const { result } = renderHook(() => useScheduleSettings(), { wrapper });
    await act(async () => { await vi.advanceTimersByTimeAsync(1100); });

    editSchedule(result);
    await act(async () => { await vi.advanceTimersByTimeAsync(1100); });

    expect(ui.toast).toHaveBeenCalledWith(
      expect.stringContaining('Failed to save schedule'),
      'error'
    );
    expect(result.current.saveStatus).toBe('error');
  });

  it('skips autosave entirely when no API key is present', async () => {
    ui.key.has = false;
    const { result } = renderHook(() => useScheduleSettings(), { wrapper });
    await act(async () => { await vi.advanceTimersByTimeAsync(1100); });

    editSchedule(result);
    await act(async () => { await vi.advanceTimersByTimeAsync(1100); });

    expect(updateSchedule).not.toHaveBeenCalled();
  });

  it('does not autosave an empty schedule', async () => {
    const { result } = renderHook(() => useScheduleSettings(), { wrapper });
    await act(async () => { await vi.advanceTimersByTimeAsync(1100); });

    act(() => {
      result.current.setScheduleStore({ '2026-06': {} });
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(1100); });

    expect(updateSchedule).not.toHaveBeenCalled();
  });
});
