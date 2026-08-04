import { describe, it, expect, vi, beforeEach } from 'vitest';
import { serverScheduleToStore, storeToServerSchedule } from '../../utils/scheduleFormat';

describe('serverScheduleToStore', () => {
  it('converts server format to store format', () => {
    const serverData = {
      Jan: [{ day: 15, slot: 0, trail_id: 'trail-1', early_start: false, leader: 'Alice' }],
    };
    const store = serverScheduleToStore(serverData);
    expect(store).toHaveProperty('January');
    expect(store.January).toHaveProperty('15');
    expect(store.January['15'][0].trail_id).toBe('trail-1');
  });

  it('handles multiple days', () => {
    const serverData = {
      Feb: [
        { day: 5, slot: 0, trail_id: 'trail-1', early_start: false, leader: '' },
        { day: 12, slot: 0, trail_id: 'trail-2', early_start: true, leader: 'Bob' },
      ],
    };
    const store = serverScheduleToStore(serverData);
    expect(store.February['5'][0].trail_id).toBe('trail-1');
    expect(store.February['12'][0].early_start).toBe(true);
  });

  it('handles multiple slots per day', () => {
    const serverData = {
      Mar: [
        { day: 10, slot: 0, trail_id: 'trail-1', early_start: false, leader: '' },
        { day: 10, slot: 1, trail_id: 'trail-2', early_start: false, leader: '' },
      ],
    };
    const store = serverScheduleToStore(serverData);
    expect(store.March['10'][0].trail_id).toBe('trail-1');
    expect(store.March['10'][1].trail_id).toBe('trail-2');
  });

  it('handles early start flag', () => {
    const serverData = {
      Apr: [{ day: 1, slot: 0, trail_id: 'trail-1', early_start: true, leader: '' }],
    };
    const store = serverScheduleToStore(serverData);
    expect(store.April['1'][0].early_start).toBe(true);
  });

  it('returns empty object for null data', () => {
    expect(serverScheduleToStore(null)).toEqual({});
  });

  it('filters out NaN days', () => {
    const serverData = {
      Jan: [{ day: NaN, slot: 0, trail_id: 'trail-1', early_start: false, leader: '' }],
    };
    const store = serverScheduleToStore(serverData);
    expect(Object.keys(store.January || {})).toHaveLength(0);
  });

  it('handles object entries format', () => {
    const serverData = {
      May: { '15': [{ trail_id: 'trail-1', early_start: false, leader: '' }] },
    };
    const store = serverScheduleToStore(serverData);
    expect(store.May['15'][0].trail_id).toBe('trail-1');
  });
});

describe('storeToServerSchedule', () => {
  it('converts store format to server format', () => {
    const store = {
      January: { '15': [{ trail_id: 'trail-1', early_start: false, leader: 'Alice' }] },
    };
    const serverData = storeToServerSchedule(store);
    expect(serverData).toHaveProperty('Jan');
    expect(serverData.Jan[0].day).toBe(15);
    expect(serverData.Jan[0].trail_id).toBe('trail-1');
  });

  it('sorts entries by day and slot', () => {
    const store = {
      February: {
        '12': [{ trail_id: 'trail-2', early_start: false, leader: '' }],
        '5': [{ trail_id: 'trail-1', early_start: false, leader: '' }],
      },
    };
    const serverData = storeToServerSchedule(store);
    expect(serverData.Feb[0].day).toBe(5);
    expect(serverData.Feb[1].day).toBe(12);
  });

  it('handles multiple slots per day', () => {
    const store = {
      March: {
        '10': [
          { trail_id: 'trail-1', early_start: false, leader: '' },
          { trail_id: 'trail-2', early_start: true, leader: 'Bob' },
        ],
      },
    };
    const serverData = storeToServerSchedule(store);
    expect(serverData.Mar[0].slot).toBe(0);
    expect(serverData.Mar[1].slot).toBe(1);
  });

  it('filters out entries without trail_id', () => {
    const store = {
      April: { '1': [{ trail_id: null, early_start: false, leader: '' }] },
    };
    const serverData = storeToServerSchedule(store);
    expect(serverData.Apr).toHaveLength(0);
  });

  it('filters out invalid days', () => {
    const store = {
      May: { '0': [{ trail_id: 'trail-1', early_start: false, leader: '' }] },
    };
    const serverData = storeToServerSchedule(store);
    expect(serverData.May).toHaveLength(0);
  });

  it('preserves early start flag', () => {
    const store = {
      June: { '1': [{ trail_id: 'trail-1', early_start: true, leader: '' }] },
    };
    const serverData = storeToServerSchedule(store);
    expect(serverData.Jun[0].early_start).toBe(true);
  });
});

describe('schedule round-trip', () => {
  it('converts server to store and back', () => {
    const original = {
      Jan: [
        { day: 15, slot: 0, trail_id: 'trail-1', early_start: false, leader: 'Alice' },
        { day: 22, slot: 0, trail_id: 'trail-2', early_start: true, leader: 'Bob' },
      ],
    };
    const store = serverScheduleToStore(original);
    const converted = storeToServerSchedule(store);
    expect(converted.Jan).toHaveLength(2);
    expect(converted.Jan[0].trail_id).toBe('trail-1');
    expect(converted.Jan[1].trail_id).toBe('trail-2');
  });
});
