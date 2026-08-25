import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  serverScheduleToStore,
  storeToServerSchedule,
  normalizeDayEntries,
  getDayEntries,
  setDayEntry,
  clearDayEntry,
  normalizeServerMonthEntries,
} from '../../utils/scheduleFormat';
import { DAY_NAMES, CURRENT_YEAR } from '../../utils/constants';
import { getMonthKey } from '../../utils/dateUtils';

describe('TSV import day matching', () => {
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
    const labels = ['Monday A', 'Monday B'];
    const assignments = labels.map(label => {
      const labelPart = label.split(' ')[0];
      const dowMatch = DAY_NAMES.find(name => name.startsWith(labelPart));
      if (dowMatch) {
        return { label, slot: 0, matched: true };
      }
      return { label, slot: 0, matched: false };
    });
    const unmatched = assignments.filter(a => !a.matched);
    expect(unmatched.length).toBe(2);
    expect(assignments[0].slot).toBe(assignments[1].slot);
  });
});

describe('scheduleFormat', () => {
  describe('serverScheduleToStore', () => {
    it('converts legacy month keys to the current year', () => {
      const serverData = {
        Jul: [
          { day: 1, slot: 0, trail_id: 'trail-1', early_start: -30, leader: 'Alice' },
          { day: 3, slot: 1, trail_id: 'trail-2', early_start: 0, leader: 'Bob' },
        ],
      };
      const store = serverScheduleToStore(serverData);
      const julKey = getMonthKey(CURRENT_YEAR, 6);
      expect(store[julKey]).toBeDefined();
      expect(store[julKey]['1']).toEqual([
        { trail_id: 'trail-1', early_start: -30, leader: 'Alice' },
      ]);
      expect(store[julKey]['3'][1]).toEqual({
        trail_id: 'trail-2', early_start: 0, leader: 'Bob',
      });
    });

    it('preserves explicit YYYY-MM keys', () => {
      const serverData = {
        '2027-07': [
          { day: 1, slot: 0, trail_id: 'trail-1', early_start: -30, leader: 'Alice' },
        ],
      };
      const store = serverScheduleToStore(serverData);
      expect(store['2027-07']['1']).toEqual([
        { trail_id: 'trail-1', early_start: -30, leader: 'Alice' },
      ]);
    });

    it('keeps different years separate', () => {
      const serverData = {
        '2026-07': [{ day: 1, slot: 0, trail_id: 'trail-1', early_start: 0, leader: '' }],
        '2027-07': [{ day: 1, slot: 0, trail_id: 'trail-2', early_start: 0, leader: '' }],
      };
      const store = serverScheduleToStore(serverData);
      expect(store['2026-07']['1'][0].trail_id).toBe('trail-1');
      expect(store['2027-07']['1'][0].trail_id).toBe('trail-2');
    });

    it('handles empty server data', () => {
      expect(serverScheduleToStore(null)).toEqual({});
      expect(serverScheduleToStore({})).toEqual({});
    });

    it('handles dict format entries as arrays', () => {
      const serverData = {
        Jun: {
          '3': { trail_id: 'trail-1', early_start: 0, leader: 'Alice' },
        },
      };
      const store = serverScheduleToStore(serverData);
      expect(store[getMonthKey(CURRENT_YEAR, 5)]['3']).toEqual([{ trail_id: 'trail-1', early_start: 0, leader: 'Alice' }]);
    });

    it('normalizes legacy string entries to arrays', () => {
      const serverData = {
        Jun: {
          '3': 'some-trail-id',
        },
      };
      const store = serverScheduleToStore(serverData);
      expect(store[getMonthKey(CURRENT_YEAR, 5)]['3']).toEqual([{ trail_id: 'some-trail-id', early_start: 0, leader: '' }]);
    });

    it('handles multiple days', () => {
      const serverData = {
        Feb: [
          { day: 5, slot: 0, trail_id: 'trail-1', early_start: 0, leader: '' },
          { day: 12, slot: 0, trail_id: 'trail-2', early_start: -30, leader: 'Bob' },
        ],
      };
      const store = serverScheduleToStore(serverData);
      const febKey = getMonthKey(CURRENT_YEAR, 1);
      expect(store[febKey]['5'][0].trail_id).toBe('trail-1');
      expect(store[febKey]['12'][0].early_start).toBe(-30);
    });

    it('handles early start flag', () => {
      const serverData = {
        Apr: [{ day: 1, slot: 0, trail_id: 'trail-1', early_start: -30, leader: '' }],
      };
      const store = serverScheduleToStore(serverData);
      expect(store[getMonthKey(CURRENT_YEAR, 3)]['1'][0].early_start).toBe(-30);
    });

    it('filters out NaN days', () => {
      const serverData = {
        Jan: [{ day: NaN, slot: 0, trail_id: 'trail-1', early_start: 0, leader: '' }],
      };
      const store = serverScheduleToStore(serverData);
      expect(Object.keys(store[getMonthKey(CURRENT_YEAR, 0)] || {})).toHaveLength(0);
    });
  });

  describe('storeToServerSchedule', () => {
    it('converts store format to array format with correct slots', () => {
      const store = {
        [getMonthKey(CURRENT_YEAR, 6)]: {
          '1': [{ trail_id: 'trail-1', early_start: -30, leader: 'Alice' }],
          '3': [{ trail_id: 'trail-2', early_start: 0, leader: 'Bob' }],
        },
      };
      const serverData = storeToServerSchedule(store);
      const julKey = getMonthKey(CURRENT_YEAR, 6);
      expect(serverData[julKey]).toHaveLength(2);
      expect(serverData[julKey][0]).toEqual({
        day: 1,
        slot: 0,
        trail_id: 'trail-1',
        early_start: -30,
        leader: 'Alice',
      });
      expect(serverData[julKey][1]).toEqual({
        day: 3,
        slot: 0,
        trail_id: 'trail-2',
        early_start: 0,
        leader: 'Bob',
      });
    });

    it('handles multiple entries per day with correct slots', () => {
      const store = {
        [getMonthKey(CURRENT_YEAR, 6)]: {
          '1': [
            { trail_id: 'trail-1', early_start: 0, leader: 'Alice' },
            { trail_id: 'trail-2', early_start: 0, leader: 'Bob' },
          ],
        },
      };
      const serverData = storeToServerSchedule(store);
      const julKey = getMonthKey(CURRENT_YEAR, 6);
      expect(serverData[julKey]).toHaveLength(2);
      expect(serverData[julKey][0].slot).toBe(0);
      expect(serverData[julKey][1].slot).toBe(1);
    });

    it('handles empty store', () => {
      expect(storeToServerSchedule({})).toEqual({});
    });

    it('ramblers round-trip: two hikes same day preserve slot 0/1', () => {
      const serverData = {
        [getMonthKey(CURRENT_YEAR, 6)]: [
          { day: 6, slot: 0, trail_id: 'buckhorn-pass', early_start: 0, leader: 'Burt' },
          { day: 6, slot: 1, trail_id: 'grindstone', early_start: 0, leader: 'Pat' },
        ],
      };
      const store = serverScheduleToStore(serverData);
      const julKey = getMonthKey(CURRENT_YEAR, 6);
      expect(store[julKey]['6']).toHaveLength(2);
      expect(store[julKey]['6'][0].trail_id).toBe('buckhorn-pass');
      expect(store[julKey]['6'][1].trail_id).toBe('grindstone');
      const roundTrip = storeToServerSchedule(store);
      expect(roundTrip[julKey]).toHaveLength(2);
      expect(roundTrip[julKey][0]).toEqual({ day: 6, slot: 0, trail_id: 'buckhorn-pass', early_start: 0, leader: 'Burt' });
      expect(roundTrip[julKey][1]).toEqual({ day: 6, slot: 1, trail_id: 'grindstone', early_start: 0, leader: 'Pat' });
    });

    it('sothh round-trip: hikes on different days all slot 0', () => {
      const serverData = {
        [getMonthKey(CURRENT_YEAR, 6)]: [
          { day: 2, slot: 0, trail_id: 'trail-1', early_start: 0, leader: 'Alice' },
          { day: 4, slot: 0, trail_id: 'trail-2', early_start: 0, leader: 'Bob' },
        ],
      };
      const store = serverScheduleToStore(serverData);
      const roundTrip = storeToServerSchedule(store);
      const julKey = getMonthKey(CURRENT_YEAR, 6);
      expect(roundTrip[julKey]).toHaveLength(2);
      expect(roundTrip[julKey][0].slot).toBe(0);
      expect(roundTrip[julKey][1].slot).toBe(0);
    });

    it('filters out entries without trail_id', () => {
      const store = {
        [getMonthKey(CURRENT_YEAR, 3)]: { '1': [{ trail_id: null, early_start: 0, leader: '' }] },
      };
      const serverData = storeToServerSchedule(store);
      expect(serverData[getMonthKey(CURRENT_YEAR, 3)]).toHaveLength(0);
    });

    it('filters out invalid days', () => {
      const store = {
        [getMonthKey(CURRENT_YEAR, 4)]: { '0': [{ trail_id: 'trail-1', early_start: 0, leader: '' }] },
      };
      const serverData = storeToServerSchedule(store);
      expect(serverData[getMonthKey(CURRENT_YEAR, 4)]).toHaveLength(0);
    });

    it('preserves early start flag', () => {
      const store = {
        [getMonthKey(CURRENT_YEAR, 5)]: { '1': [{ trail_id: 'trail-1', early_start: -30, leader: '' }] },
      };
      const serverData = storeToServerSchedule(store);
      expect(serverData[getMonthKey(CURRENT_YEAR, 5)][0].early_start).toBe(-30);
    });
  });
});

describe('schedule entry normalization', () => {
  it('normalizeDayEntries converts objects, strings, and arrays', () => {
    expect(normalizeDayEntries({ trail_id: 'trail-1', early_start: -30, leader: 'Alice' }))
      .toEqual([{ trail_id: 'trail-1', early_start: -30, leader: 'Alice' }]);
    expect(normalizeDayEntries('trail-2'))
      .toEqual([{ trail_id: 'trail-2', early_start: 0, leader: '' }]);
    expect(normalizeDayEntries([{ trail_id: 'trail-1' }, 'trail-2']))
      .toEqual([
        { trail_id: 'trail-1', early_start: 0, leader: '' },
        { trail_id: 'trail-2', early_start: 0, leader: '' },
      ]);
  });

  it('normalizeDayEntries returns empty array for missing values', () => {
    expect(normalizeDayEntries(null)).toEqual([]);
    expect(normalizeDayEntries(undefined)).toEqual([]);
    expect(normalizeDayEntries('')).toEqual([]);
  });

  it('getDayEntries reads array-shaped and object-shaped day entries', () => {
    const monthData = {
      1: [{ trail_id: 'trail-1', early_start: 0, leader: '' }],
      2: { trail_id: 'trail-2', early_start: -30, leader: 'Bob' },
    };
    expect(getDayEntries(monthData, 1)).toEqual([{ trail_id: 'trail-1', early_start: 0, leader: '' }]);
    expect(getDayEntries(monthData, 2)).toEqual([{ trail_id: 'trail-2', early_start: -30, leader: 'Bob' }]);
    expect(getDayEntries(monthData, 3)).toEqual([]);
  });

  it('setDayEntry creates array-shaped day entries', () => {
    const monthData = { 1: { trail_id: 'trail-1', early_start: 0, leader: '' } };
    const updated = setDayEntry(monthData, 1, 0, { trail_id: 'trail-2', early_start: -30, leader: 'Alice' });
    expect(updated['1']).toEqual([{ trail_id: 'trail-2', early_start: -30, leader: 'Alice' }]);
  });

  it('setDayEntry preserves other slots when updating one slot', () => {
    const monthData = {
      1: [
        { trail_id: 'trail-1', early_start: 0, leader: '' },
        { trail_id: 'trail-2', early_start: 0, leader: '' },
      ],
    };
    const updated = setDayEntry(monthData, 1, 1, { trail_id: 'trail-3', early_start: -30, leader: 'Bob' });
    expect(updated['1']).toEqual([
      { trail_id: 'trail-1', early_start: 0, leader: '' },
      { trail_id: 'trail-3', early_start: -30, leader: 'Bob' },
    ]);
  });

  it('clearDayEntry replaces an entry with an empty entry', () => {
    const monthData = {
      1: [{ trail_id: 'trail-1', early_start: -30, leader: 'Alice' }],
    };
    const updated = clearDayEntry(monthData, 1, 0);
    expect(updated['1']).toEqual([{ trail_id: null, early_start: 0, leader: '' }]);
  });

  it('normalizeServerMonthEntries flattens array and object server formats', () => {
    const arrayEntries = normalizeServerMonthEntries([
      { day: 5, slot: 0, trail_id: 'trail-1', early_start: 0, leader: 'Alice' },
      { day: 5, slot: 1, trail_id: 'trail-2', early_start: -30, leader: 'Bob' },
    ]);
    expect(arrayEntries).toEqual([
      { day: 5, slot: 0, trail_id: 'trail-1', early_start: 0, leader: 'Alice' },
      { day: 5, slot: 1, trail_id: 'trail-2', early_start: -30, leader: 'Bob' },
    ]);

    const objectEntries = normalizeServerMonthEntries({
      5: [
        { trail_id: 'trail-1', early_start: 0, leader: 'Alice' },
        { trail_id: 'trail-2', early_start: -30, leader: 'Bob' },
      ],
    });
    expect(objectEntries).toEqual([
      { day: 5, slot: 0, trail_id: 'trail-1', early_start: 0, leader: 'Alice' },
      { day: 5, slot: 1, trail_id: 'trail-2', early_start: -30, leader: 'Bob' },
    ]);
  });
});
