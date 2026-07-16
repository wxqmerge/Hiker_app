import { describe, it, expect, vi, beforeEach } from 'vitest';
import { serverScheduleToStore, storeToServerSchedule } from '../../utils/scheduleFormat';
import { MONTH_NAMES, DAY_NAMES } from '../../utils/constants';

describe('TSV import day matching', () => {
  // Replicates the import logic: DAY_NAMES.find(name => labelPart.startsWith(name))
  const matchDay = (label: string) => {
    const labelPart = label.split(' ')[0];
    return DAY_NAMES.find(name => labelPart.startsWith(name));
  };

  it('matches full day names against abbreviated DAY_NAMES', () => {
    expect(matchDay('Monday')).toBe('Mon');
    expect(matchDay('Tuesday')).toBe('Tue');
    expect(matchDay('Wednesday')).toBe('Wed');
    expect(matchDay('Thursday')).toBe('Thu');
    expect(matchDay('Friday')).toBe('Fri');
    expect(matchDay('Saturday')).toBe('Sat');
    expect(matchDay('Sunday')).toBe('Sun');
  });

  it('matches abbreviated day names', () => {
    expect(matchDay('Mon')).toBe('Mon');
    expect(matchDay('Wed')).toBe('Wed');
    expect(matchDay('Fri')).toBe('Fri');
  });

  it('matches day names with suffix (Mon A, Mon B)', () => {
    expect(matchDay('Monday A')).toBe('Mon');
    expect(matchDay('Monday B')).toBe('Mon');
    expect(matchDay('Mon A')).toBe('Mon');
    expect(matchDay('Mon B')).toBe('Mon');
  });

  it('rejects invalid day labels', () => {
    expect(matchDay('Invalid')).toBeUndefined();
    expect(matchDay('')).toBeUndefined();
  });

  it('slot assignment: ramblers [1,1] — Mon A slot 0, Mon B slot 1', () => {
    const labels = ['Monday A', 'Monday B'];
    const dowOccurrence: Record<number, number> = {};
    const slots = labels.map(label => {
      const labelPart = label.split(' ')[0];
      const dowMatch = DAY_NAMES.find(name => labelPart.startsWith(name));
      if (dowMatch) {
        const dow = DAY_NAMES.indexOf(dowMatch);
        if (!dowOccurrence[dow]) dowOccurrence[dow] = 0;
        return dowOccurrence[dow]++;
      }
      return 0;
    });
    expect(slots).toEqual([0, 1]);
  });

  it('slot assignment: sothh [3,5] — Wed slot 0, Fri slot 0 (different days)', () => {
    const labels = ['Wednesday', 'Friday'];
    const dowOccurrence: Record<number, number> = {};
    const slots = labels.map(label => {
      const labelPart = label.split(' ')[0];
      const dowMatch = DAY_NAMES.find(name => labelPart.startsWith(name));
      if (dowMatch) {
        const dow = DAY_NAMES.indexOf(dowMatch);
        if (!dowOccurrence[dow]) dowOccurrence[dow] = 0;
        return dowOccurrence[dow]++;
      }
      return 0;
    });
    expect(slots).toEqual([0, 0]);
  });

  it('detects unmatched day labels', () => {
    const labels = ['Monday A', 'InvalidDay', 'Monday B'];
    const unmatched = labels.filter(label => {
      const labelPart = label.split(' ')[0];
      return !DAY_NAMES.find(name => labelPart.startsWith(name));
    });
    expect(unmatched).toEqual(['InvalidDay']);
  });

  it('detects slot collisions when all labels default to slot 0', () => {
    // Simulates the old bug: both labels fail to match → both get slot 0
    const labels = ['Monday A', 'Monday B'];
    const assignments = labels.map(label => {
      // Old broken logic: name.startsWith(labelPart) → 'Mon'.startsWith('Monday') → false
      const labelPart = label.split(' ')[0];
      const dowMatch = DAY_NAMES.find(name => name.startsWith(labelPart));
      if (dowMatch) {
        return { label, slot: 0, matched: true };
      }
      return { label, slot: 0, matched: false };
    });
    // Both unmatched, both slot 0 → collision on same day
    const unmatched = assignments.filter(a => !a.matched);
    expect(unmatched.length).toBe(2);
    expect(assignments[0].slot).toBe(assignments[1].slot); // both 0 = collision
  });
});

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

    it('ramblers round-trip: two hikes same day preserve slot 0/1', () => {
      // Ramblers [1,1]: Mon A (slot 0) and Mon B (slot 1) on same day
      const serverData = {
        Jul: [
          { day: 6, slot: 0, trail_id: 'buckhorn-pass', early_start: false, leader: 'Burt' },
          { day: 6, slot: 1, trail_id: 'grindstone', early_start: false, leader: 'Pat' },
        ],
      };
      // server → store
      const store = serverScheduleToStore(serverData);
      expect(store.July['6']).toHaveLength(2);
      expect(store.July['6'][0].trail_id).toBe('buckhorn-pass');
      expect(store.July['6'][1].trail_id).toBe('grindstone');
      // store → server
      const roundTrip = storeToServerSchedule(store);
      expect(roundTrip.Jul).toHaveLength(2);
      expect(roundTrip.Jul[0]).toEqual({ day: 6, slot: 0, trail_id: 'buckhorn-pass', early_start: false, leader: 'Burt' });
      expect(roundTrip.Jul[1]).toEqual({ day: 6, slot: 1, trail_id: 'grindstone', early_start: false, leader: 'Pat' });
    });

    it('sothh round-trip: hikes on different days all slot 0', () => {
      // Sothh [3,5]: Wed (slot 0) and Fri (slot 0), different days
      const serverData = {
        Jul: [
          { day: 2, slot: 0, trail_id: 'trail-1', early_start: false, leader: 'Alice' },
          { day: 4, slot: 0, trail_id: 'trail-2', early_start: false, leader: 'Bob' },
        ],
      };
      const store = serverScheduleToStore(serverData);
      const roundTrip = storeToServerSchedule(store);
      expect(roundTrip.Jul).toHaveLength(2);
      expect(roundTrip.Jul[0].slot).toBe(0);
      expect(roundTrip.Jul[1].slot).toBe(0);
    });
  });
});
