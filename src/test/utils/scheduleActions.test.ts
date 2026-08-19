import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateLeader } from '../../utils/scheduleActions';

vi.mock('../../api/client', () => ({
  updateSchedule: vi.fn(),
  getSchedule: vi.fn(),
}));

vi.mock('../../hooks/useTrailStore', () => ({
  setSchedule: vi.fn(),
}));

vi.mock('../../hooks/useToast', () => ({
  showToast: vi.fn(),
  useToast: vi.fn(),
}));

vi.mock('../../utils/scheduleFormat', () => ({
  serverScheduleToStore: vi.fn((data) => {
    const store: any = {};
    const monthMap: any = { Jan: 'January', Jun: 'June', Mar: 'March' };
    for (const [abbr, entries] of Object.entries(data || {})) {
      const full = monthMap[abbr] || abbr;
      store[full] = {};
      if (Array.isArray(entries)) {
        for (const e of entries) {
          const day = String(e.day);
          if (!store[full][day]) store[full][day] = [];
          const slot = e.slot !== undefined ? e.slot : 0;
          store[full][day][slot] = { trail_id: e.trail_id || null, early_start: !!e.early_start, leader: e.leader || '' };
        }
      }
    }
    return store;
  }),
  storeToServerSchedule: vi.fn((store) => {
    const serverData: any = {};
    const monthMap: any = { January: 'Jan', June: 'Jun', March: 'Mar' };
    for (const [full, days] of Object.entries(store || {})) {
      const abbr = monthMap[full] || full;
      if (!abbr || !days || typeof days !== 'object') continue;
      serverData[abbr] = [];
      for (const [day, entries] of Object.entries(days)) {
        const entryList = Array.isArray(entries) ? entries : [entries];
        entryList.forEach((entry: any, slot: number) => {
          if (entry?.trail_id) {
            const dayNum = parseInt(day, 10);
            if (!isNaN(dayNum) && dayNum > 0) {
              serverData[abbr].push({ day: dayNum, slot, trail_id: entry.trail_id, early_start: !!entry.early_start, leader: entry.leader || '' });
            }
          }
        });
      }
      serverData[abbr].sort((a: any, b: any) => a.day - b.day || a.slot - b.slot);
    }
    return serverData;
  }),
}));

import { updateSchedule, getSchedule } from '../../api/client';
import { showToast } from '../../hooks/useToast';

const mockUpdateSchedule = updateSchedule as any;
const mockGetSchedule = getSchedule as any;
const mockShowToast = showToast as any;

describe('updateLeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    console.error = vi.fn();
  });

  it('returns false when newLeader is empty', async () => {
    const result = await updateLeader({}, 0, 1, 0, '');
    expect(result).toBe(false);
  });

  it('trims leader name', async () => {
    mockGetSchedule.mockResolvedValue({
      Jan: [{ day: 1, slot: 0, trail_id: 'trail-1', early_start: false, leader: '' }],
    });
    mockUpdateSchedule.mockResolvedValue(undefined);

    const store = { January: { '1': [{ trail_id: 'trail-1', early_start: false, leader: '' }] } };
    const result = await updateLeader(store, 0, 1, 0, '  Trimmed Leader  ');
    expect(result).toBe(true);
    const callData = mockUpdateSchedule.mock.calls[0][0];
    expect(callData.Jan[0].leader).toBe('Trimmed Leader');
  });

  it('updates specific slot', async () => {
    mockGetSchedule.mockResolvedValue({
      Jun: [
        { day: 5, slot: 0, trail_id: 'trail-1', early_start: false, leader: 'First' },
        { day: 5, slot: 1, trail_id: 'trail-2', early_start: false, leader: 'Second' },
      ],
    });
    mockUpdateSchedule.mockResolvedValue(undefined);

    const store = {
      June: {
        '5': [
          { trail_id: 'trail-1', early_start: false, leader: 'First' },
          { trail_id: 'trail-2', early_start: false, leader: 'Second' },
        ],
      },
    };
    const result = await updateLeader(store, 5, 5, 1, 'New Leader');
    expect(result).toBe(true);
    const callData = mockUpdateSchedule.mock.calls[0][0];
    expect(callData.Jun[1].leader).toBe('New Leader');
    expect(callData.Jun[0].leader).toBe('First');
  });

  it('falls back to store when getSchedule fails', async () => {
    mockGetSchedule.mockRejectedValue(new Error('Network error'));
    mockUpdateSchedule.mockResolvedValue(undefined);

    const store = {
      March: { '10': [{ trail_id: 'trail-1', early_start: false, leader: '' }] },
    };
    const result = await updateLeader(store, 2, 10, 0, 'Fallback Leader');
    expect(result).toBe(true);
  });

  it('returns false and toasts when updateSchedule fails', async () => {
    mockGetSchedule.mockResolvedValue({
      Jan: [{ day: 1, slot: 0, trail_id: 'trail-1', early_start: false, leader: '' }],
    });
    mockUpdateSchedule.mockRejectedValue(new Error('Save failed'));

    const store = { January: { '1': [{ trail_id: 'trail-1', early_start: false, leader: '' }] } };
    const result = await updateLeader(store, 0, 1, 0, 'New Leader');
    expect(result).toBe(false);
    expect(mockShowToast).toHaveBeenCalledWith('Failed to save leader: Save failed', 'error');
  });

  it('handles empty month data', async () => {
    mockGetSchedule.mockResolvedValue({});
    mockUpdateSchedule.mockResolvedValue(undefined);

    const store = {};
    const result = await updateLeader(store, 0, 1, 0, 'New Leader');
    expect(result).toBe(true);
  });
});
