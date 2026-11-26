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
vi.mock('../../utils/io', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/io')>()),
  openHtmlInNewTab: vi.fn(),
}));

import { ScheduleSettingsProvider, useScheduleSettings } from '../../contexts/ScheduleSettingsContext';
import { MonthContextProvider, useMonthContext } from '../../contexts/MonthContext';
import { setSchedule } from '../../hooks/useTrailStore';
import { updateSchedule } from '../../api/client';
import { setGroupConfig } from '../../utils/config';
import { openHtmlInNewTab } from '../../utils/io';

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

describe('ScheduleSettingsContext monthly HTML export', () => {
  // Quarter-boundary bonus: the December report must show a Jan 1 hike that
  // lives in the 2027-01 bucket, matching the ScheduleBuilder boundary column.
  let monthSetter: ((key: string) => void) | null = null;
  function MonthProbe() {
    const { setSelectedMonthKey } = useMonthContext();
    monthSetter = setSelectedMonthKey;
    return null;
  }
  const exportWrapper = ({ children }: { children: React.ReactNode }) => (
    <MonthContextProvider>
      <ScheduleSettingsProvider>
        <MonthProbe />
        {children}
      </ScheduleSettingsProvider>
    </MonthContextProvider>
  );

  beforeEach(() => {
    vi.useFakeTimers();
    ui.key.has = true;
    monthSetter = null;
    setGroupConfig({ hikeDays: '3,5', maxHikesPerDay: 3 });
    // Trails are the setup.ts module-store fixtures (trail-1 = Mount Rainier).
    setSchedule({
      '2026-12': [{ day: 25, slot: 0, trail_id: 'trail-2', early_start: 0, leader: 'Matt' }],
      '2027-01': [{ day: 1, slot: 0, trail_id: 'trail-1', early_start: 0, leader: 'Beth/Brennan' }],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  async function exportForMonth(monthKey: string) {
    const { result } = renderHook(() => useScheduleSettings(), { wrapper: exportWrapper });
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });
    act(() => { monthSetter?.(monthKey); });
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });
    act(() => { result.current.handleExport(); });
    const calls = vi.mocked(openHtmlInNewTab).mock.calls;
    return calls.length ? String(calls[calls.length - 1][0]) : '';
  }

  it('December export includes the Jan 1 bonus hike from next quarter', async () => {
    const html = await exportForMonth('2026-12');
    expect(html).toMatch(/January 1[\s\S]{0,60}Mount Rainier/); // bonus boundary day + hike
  });

  it('non-quarter-ending month (November) does not pull in boundary hikes', async () => {
    const html = await exportForMonth('2026-11');
    expect(html).not.toContain('January 1');
  });
});
