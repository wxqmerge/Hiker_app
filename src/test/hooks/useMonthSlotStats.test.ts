import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMonthSlotStats } from '../../hooks/useMonthSlotStats';
import { getMonthKey } from '../../utils/dateUtils';

vi.mock('../../utils/config', () => ({
  getHikeDays: vi.fn(() => [1]),
  getMaxHikesPerDay: vi.fn(() => 3),
  getConfigVersion: vi.fn(() => 0),
  subscribeConfigChange: vi.fn(() => () => {}),
}));

vi.mock('../../utils/dateUtils', () => ({
  getDaysInMonth: vi.fn((year, month) => {
    const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return days[month];
  }),
  createDate: vi.fn((year, month, day) => {
    return new Date(year, month, day);
  }),
  getHikeDaysForMonth: vi.fn((year, month, hikeDays) => {
    const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    const result = [];
    for (let day = 1; day <= days[month]; day++) {
      if (hikeDays.includes(new Date(year, month, day).getDay())) result.push(day);
    }
    return result;
  }),
  getHikeSlotsForMonth: vi.fn((year, month, hikeDays) => {
    const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    const hikesPerDow = {};
    hikeDays.forEach(d => { hikesPerDow[d] = (hikesPerDow[d] || 0) + 1; });
    const result = [];
    for (let day = 1; day <= days[month]; day++) {
      const date = new Date(year, month, day);
      const dow = date.getDay();
      const hikesForThisDow = hikesPerDow[dow] || 0;
      for (let s = 0; s < hikesForThisDow; s++) {
        result.push({ day, slot: s });
      }
    }
    return result;
  }),
  getMonthKey: vi.fn((year, month) => `${year}-${String(month + 1).padStart(2, '0')}`),
}));

describe('useMonthSlotStats', () => {
  const trails = [
    { id: 'trail-1', name: 'Trail One' },
    { id: 'trail-2', name: 'Trail Two' },
  ];

  const scheduleStore = {
    [getMonthKey(2024, 0)]: {},
    [getMonthKey(2024, 1)]: {},
  };

  const props = {
    trails,
    scheduleStore,
    years: [2024],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns stats for all months', () => {
    const { result } = renderHook(() => useMonthSlotStats(props));
    expect(result.current).toHaveProperty(getMonthKey(2024, 0));
    expect(result.current).toHaveProperty(getMonthKey(2024, 1));
  });

  it('calculates total slots for January', () => {
    const { result } = renderHook(() => useMonthSlotStats(props));
    // Jan 2024 has 31 days, Mon = day 1, so 4 Mondays (1, 8, 15, 22, 29) = 5
    expect(result.current[getMonthKey(2024, 0)].total).toBe(5);
  });

  it('calculates total slots for February', () => {
    const { result } = renderHook(() => useMonthSlotStats(props));
    // Feb 2024 (leap year) has 29 days, Mon = day 1, so 5 Mondays (5, 12, 19, 26) = 4
    expect(result.current[getMonthKey(2024, 1)].total).toBe(4);
  });

  it('counts filled slots', () => {
    const scheduleWithHikes = {
      [getMonthKey(2024, 0)]: { 1: [{ trail_id: 'trail-1' }] },
      [getMonthKey(2024, 1)]: {},
    };
    const { result } = renderHook(() => useMonthSlotStats({ ...props, scheduleStore: scheduleWithHikes }));
    expect(result.current[getMonthKey(2024, 0)].filled).toBe(1);
  });

  it('ignores unknown trail IDs', () => {
    const scheduleWithHikes = {
      [getMonthKey(2024, 0)]: { 1: [{ trail_id: 'unknown' }] },
      [getMonthKey(2024, 1)]: {},
    };
    const { result } = renderHook(() => useMonthSlotStats({ ...props, scheduleStore: scheduleWithHikes }));
    expect(result.current[getMonthKey(2024, 0)].filled).toBe(0);
  });

  it('handles empty schedule', () => {
    const { result } = renderHook(() => useMonthSlotStats(props));
    expect(result.current[getMonthKey(2024, 0)].filled).toBe(0);
  });

  it('returns object with total and filled', () => {
    const { result } = renderHook(() => useMonthSlotStats(props));
    expect(result.current[getMonthKey(2024, 0)]).toHaveProperty('total');
    expect(result.current[getMonthKey(2024, 0)]).toHaveProperty('filled');
  });
});
