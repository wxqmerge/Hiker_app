import { describe, it, expect, vi, beforeEach } from 'vitest';
import { serverScheduleToStore, storeToServerSchedule } from '../../utils/scheduleFormat';
import { MONTH_NAMES } from '../../utils/constants';

describe('scheduleFormat', () => {
  describe('serverScheduleToStore', () => {
    it('converts array format to store format with day keys', () => {
      const serverData = {
        Jul: [
          { day: 1, slot: 0, trail_id: 'trail-1', early_start: true, leader: 'Alice' },
          { day: 3, slot: 1, trail_id: 'trail-2', early_start: false, leader: 'Bob' },
        ],
      };
      const store = serverScheduleToStore(serverData);
      expect(store.July).toBeDefined();
      expect(store.July['1']).toEqual([
        { trail_id: 'trail-1', early_start: true, leader: 'Alice' },
      ]);
      expect(store.July['3'][1]).toEqual({
        trail_id: 'trail-2', early_start: false, leader: 'Bob',
      });
    });

    it('handles empty server data', () => {
      expect(serverScheduleToStore(null)).toEqual({});
      expect(serverScheduleToStore({})).toEqual({});
    });

    it('handles dict format entries', () => {
      const serverData = {
        Jun: {
          '3': { trail_id: 'trail-1', early_start: false, leader: 'Alice' },
        },
      };
      const store = serverScheduleToStore(serverData);
      expect(store.June['3']).toEqual({ trail_id: 'trail-1', early_start: false, leader: 'Alice' });
    });
  });

  describe('storeToServerSchedule', () => {
    it('converts store format to array format with correct slots', () => {
      const store = {
        July: {
          '1': [{ trail_id: 'trail-1', early_start: true, leader: 'Alice' }],
          '3': [{ trail_id: 'trail-2', early_start: false, leader: 'Bob' }],
        },
      };
      const serverData = storeToServerSchedule(store);
      expect(serverData.Jul).toHaveLength(2);
      expect(serverData.Jul[0]).toEqual({
        day: 1,
        slot: 0,
        trail_id: 'trail-1',
        early_start: true,
        leader: 'Alice',
      });
      expect(serverData.Jul[1]).toEqual({
        day: 3,
        slot: 0,
        trail_id: 'trail-2',
        early_start: false,
        leader: 'Bob',
      });
    });

    it('handles multiple entries per day with correct slots', () => {
      const store = {
        July: {
          '1': [
            { trail_id: 'trail-1', early_start: false, leader: 'Alice' },
            { trail_id: 'trail-2', early_start: false, leader: 'Bob' },
          ],
        },
      };
      const serverData = storeToServerSchedule(store);
      expect(serverData.Jul).toHaveLength(2);
      expect(serverData.Jul[0].slot).toBe(0);
      expect(serverData.Jul[1].slot).toBe(1);
    });

    it('handles empty store', () => {
      expect(storeToServerSchedule({})).toEqual({});
    });
  });
});
