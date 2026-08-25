import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useScheduleData } from '../../hooks/useScheduleData';
import { getMonthKey } from '../../utils/dateUtils';

describe('useScheduleData', () => {
  const mockTrails = globalThis.__TEST_MOCK_DATA__.trails;

  const renderScheduleHook = (scheduleStore) => {
    return renderHook(() =>
      useScheduleData({
        trails: mockTrails,
        scheduleStore,
        selectedMonth: 6, // July
        year: 2026,
      })
    );
  };

  describe('assignedHikes', () => {
    it('reads entries from correct slot for Wednesday (slot 0)', () => {
      const store = {
        [getMonthKey(2026, 6)]: {
          '1': [{ trail_id: 'trail-1', early_start: 0, leader: 'Alice' }],
        },
      };
      const { result } = renderScheduleHook(store);
      expect(result.current.assignedHikes['1']).toEqual([
        { trail_id: 'trail-1', early_start: 0, leader: 'Alice' },
      ]);
    });

    it('reads entries from correct slot for Friday (slot 1)', () => {
      const store = {
        [getMonthKey(2026, 6)]: {
          '3': [
            { trail_id: 'trail-1', early_start: 0, leader: 'Alice' },
            { trail_id: 'trail-2', early_start: 0, leader: 'Bob' },
          ],
        },
      };
      const { result } = renderScheduleHook(store);
      expect(result.current.assignedHikes['3'][1]).toEqual({
        trail_id: 'trail-2',
        early_start: 0,
        leader: 'Bob',
      });
    });

    it('handles empty schedule store', () => {
      const { result } = renderScheduleHook({});
      expect(result.current.assignedHikes).toEqual({});
    });

    it('handles null trail_id in entry', () => {
      const store = {
        [getMonthKey(2026, 6)]: {
          '1': [{ trail_id: null, early_start: 0, leader: '' }],
        },
      };
      const { result } = renderScheduleHook(store);
      expect(result.current.assignedHikes['1'][0].trail_id).toBeNull();
    });

    it('normalizes object-shaped day entries', () => {
      const store = {
        [getMonthKey(2026, 6)]: {
          '1': { trail_id: 'trail-1', early_start: -30, leader: 'Alice' },
        },
      };
      const { result } = renderScheduleHook(store);
      expect(result.current.assignedHikes['1']).toEqual([
        { trail_id: 'trail-1', early_start: -30, leader: 'Alice' },
      ]);
    });

    it('normalizes string day entries', () => {
      const store = {
        [getMonthKey(2026, 6)]: {
          '1': 'trail-1',
        },
      };
      const { result } = renderScheduleHook(store);
      expect(result.current.assignedHikes['1']).toEqual([
        { trail_id: 'trail-1', early_start: 0, leader: '' },
      ]);
    });
  });

  describe('hikeDates', () => {
    it('generates correct hike dates for July 2026', () => {
      const { result } = renderScheduleHook({});
      const dates = result.current.hikeDates;
      expect(dates.length).toBeGreaterThan(0);
      // July 2026: Wed=1(slot 0), Fri=3(slot 0), Wed=8(slot 1), Fri=10(slot 1), etc.
      expect(dates[0]).toEqual({ day: 1, slot: 0 });
      expect(dates[1]).toEqual({ day: 3, slot: 0 });
    });
  });
});
