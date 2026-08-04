import { describe, it, expect } from 'vitest';
import { getSeasonalInfo, calculateMonthlyScore } from '../../utils/score';

describe('getSeasonalInfo', () => {
  it('returns empty keys and false for null/undefined', () => {
    expect(getSeasonalInfo(null)).toEqual({ seasonalKeys: [], hasQuarterData: false });
    expect(getSeasonalInfo(undefined)).toEqual({ seasonalKeys: [], hasQuarterData: false });
    expect(getSeasonalInfo({})).toEqual({ seasonalKeys: [], hasQuarterData: false });
  });

  it('identifies valid month abbreviations', () => {
    const info = getSeasonalInfo({ Jan: 3, Jun: 2, Dec: 1 });
    expect(info.hasQuarterData).toBe(true);
    expect(info.seasonalKeys).toEqual(['Jan', 'Jun', 'Dec']);
  });

  it('ignores non-month keys', () => {
    const info = getSeasonalInfo({ Jan: 3, availableMonths: [1, 2], foo: 5 });
    expect(info.seasonalKeys).toEqual(['Jan']);
    expect(info.hasQuarterData).toBe(true);
  });

  it('includes all month abbreviation keys regardless of values', () => {
    const info = getSeasonalInfo({ Jan: 0, Feb: -1, Mar: 'high' });
    expect(info.seasonalKeys).toEqual(['Jan', 'Feb', 'Mar']);
    expect(info.hasQuarterData).toBe(true);
  });
});

describe('calculateMonthlyScore', () => {
  it('returns 0 for no hikes and no quarter data', () => {
    expect(calculateMonthlyScore(0, 0, [])).toBe(0);
  });

  it('scores based on hike count', () => {
    expect(calculateMonthlyScore(1, 0, [], false)).toBe(2);
    expect(calculateMonthlyScore(3, 0, [], false)).toBe(6);
    expect(calculateMonthlyScore(5, 0, [], false)).toBe(9);
    expect(calculateMonthlyScore(10, 0, [], false)).toBe(9);
  });

  it('adds quarter base when hasQuarterData', () => {
    expect(calculateMonthlyScore(0, 0, [], true)).toBe(2);
    expect(calculateMonthlyScore(1, 0, [], true)).toBe(4);
  });

  it('adds month base when month is in availableMonths', () => {
    expect(calculateMonthlyScore(0, 2, [1, 2, 3], false)).toBe(1);
    expect(calculateMonthlyScore(0, 5, [1, 2, 3], false)).toBe(0);
  });

  it('caps score at 9', () => {
    expect(calculateMonthlyScore(100, 0, [], true)).toBe(9);
  });
});
