import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateLeader } from '../../utils/scheduleActions';
import { getMonthKey } from '../../utils/dateUtils';

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
    const janKey = getMonthKey(2026, 0);
    mockGetSchedule.mockResolvedValue({
      [janKey]: [{ day: 1, slot: 0, trail_id: 'trail-1', early_start: false, leader: '' }],
    });
    mockUpdateSchedule.mockResolvedValue(undefined);

    const store = { [janKey]: { '1': [{ trail_id: 'trail-1', early_start: false, leader: '' }] } };
    const result = await updateLeader(store, 0, 1, 0, '  Trimmed Leader  ', 2026);
    expect(result).toBe(true);
    const callData = mockUpdateSchedule.mock.calls[0][0];
    expect(callData[janKey][0].leader).toBe('Trimmed Leader');
  });

  it('updates specific slot', async () => {
    const junKey = getMonthKey(2026, 5);
    mockGetSchedule.mockResolvedValue({
      [junKey]: [
        { day: 5, slot: 0, trail_id: 'trail-1', early_start: false, leader: 'First' },
        { day: 5, slot: 1, trail_id: 'trail-2', early_start: false, leader: 'Second' },
      ],
    });
    mockUpdateSchedule.mockResolvedValue(undefined);

    const store = {
      [junKey]: {
        '5': [
          { trail_id: 'trail-1', early_start: false, leader: 'First' },
          { trail_id: 'trail-2', early_start: false, leader: 'Second' },
        ],
      },
    };
    const result = await updateLeader(store, 5, 5, 1, 'New Leader', 2026);
    expect(result).toBe(true);
    const callData = mockUpdateSchedule.mock.calls[0][0];
    expect(callData[junKey][1].leader).toBe('New Leader');
    expect(callData[junKey][0].leader).toBe('First');
  });

  it('falls back to store when getSchedule fails', async () => {
    mockGetSchedule.mockRejectedValue(new Error('Network error'));
    mockUpdateSchedule.mockResolvedValue(undefined);

    const store = {
      [getMonthKey(2026, 2)]: { '10': [{ trail_id: 'trail-1', early_start: false, leader: '' }] },
    };
    const result = await updateLeader(store, 2, 10, 0, 'Fallback Leader', 2026);
    expect(result).toBe(true);
  });

  it('returns false and toasts when updateSchedule fails', async () => {
    const janKey = getMonthKey(2026, 0);
    mockGetSchedule.mockResolvedValue({
      [janKey]: [{ day: 1, slot: 0, trail_id: 'trail-1', early_start: false, leader: '' }],
    });
    mockUpdateSchedule.mockRejectedValue(new Error('Save failed'));

    const store = { [janKey]: { '1': [{ trail_id: 'trail-1', early_start: false, leader: '' }] } };
    const result = await updateLeader(store, 0, 1, 0, 'New Leader', 2026);
    expect(result).toBe(false);
    expect(mockShowToast).toHaveBeenCalledWith('Failed to save leader: Save failed', 'error');
  });

  it('handles empty month data', async () => {
    mockGetSchedule.mockResolvedValue({});
    mockUpdateSchedule.mockResolvedValue(undefined);

    const store = {};
    const result = await updateLeader(store, 0, 1, 0, 'New Leader', 2026);
    expect(result).toBe(true);
  });
});
