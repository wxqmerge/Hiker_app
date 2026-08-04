import { describe, it, expect, beforeEach } from 'vitest';
import { getGroupName, getHikeDays, getHikeDaysLabel, getDayName, getDayLabel, setGroupConfig } from '../../utils/config';

describe('config utilities', () => {
  beforeEach(() => {
    setGroupConfig({ name: null, hikeDays: null });
  });

  describe('getGroupName', () => {
    it('returns null when not set', () => {
      expect(getGroupName()).toBeNull();
    });

    it('returns configured name', () => {
      setGroupConfig({ name: 'SOThH' });
      expect(getGroupName()).toBe('SOThH');
    });
  });

  describe('getHikeDays', () => {
    it('returns empty array when not configured', () => {
      expect(getHikeDays()).toEqual([]);
    });

    it('parses valid day numbers', () => {
      setGroupConfig({ hikeDays: '1,3,5' });
      expect(getHikeDays()).toEqual([1, 3, 5]);
    });

    it('handles whitespace', () => {
      setGroupConfig({ hikeDays: ' 1 , 3 , 5 ' });
      expect(getHikeDays()).toEqual([1, 3, 5]);
    });

    it('filters out invalid day numbers', () => {
      setGroupConfig({ hikeDays: '1,7,abc,-1,3' });
      expect(getHikeDays()).toEqual([1, 3]);
    });

    it('handles single day', () => {
      setGroupConfig({ hikeDays: '3' });
      expect(getHikeDays()).toEqual([3]);
    });
  });

  describe('getHikeDaysLabel', () => {
    it('returns Loading when not configured', () => {
      expect(getHikeDaysLabel()).toBe('Loading...');
    });

    it('returns single day label', () => {
      setGroupConfig({ hikeDays: '3' });
      expect(getHikeDaysLabel()).toBe('Wednesday Dates');
    });

    it('returns multiple day labels', () => {
      setGroupConfig({ hikeDays: '1,3' });
      expect(getHikeDaysLabel()).toBe('Monday / Wednesday Dates');
    });

    it('handles duplicate days with letter suffixes', () => {
      setGroupConfig({ hikeDays: '3,3' });
      expect(getHikeDaysLabel()).toBe('Wednesday A / Wednesday B');
    });

    it('handles mixed unique and duplicate days', () => {
      setGroupConfig({ hikeDays: '1,3,3' });
      expect(getHikeDaysLabel()).toBe('Monday / Wednesday A/Wednesday B Dates');
    });

    it('returns No Hike Days for invalid input', () => {
      setGroupConfig({ hikeDays: '7,8' });
      expect(getHikeDaysLabel()).toBe('No Hike Days');
    });
  });

  describe('getDayName', () => {
    it('returns correct name for each day', () => {
      expect(getDayName(0)).toBe('Sunday');
      expect(getDayName(1)).toBe('Monday');
      expect(getDayName(3)).toBe('Wednesday');
      expect(getDayName(6)).toBe('Saturday');
    });

    it('returns empty string for invalid day', () => {
      expect(getDayName(7)).toBe('');
      expect(getDayName(-1)).toBe('');
    });
  });

  describe('getDayLabel', () => {
    it('returns single character label', () => {
      expect(getDayLabel(0)).toBe('S');
      expect(getDayLabel(1)).toBe('M');
      expect(getDayLabel(3)).toBe('W');
      expect(getDayLabel(5)).toBe('F');
    });

    it('returns empty string for invalid day', () => {
      expect(getDayLabel(7)).toBe('');
    });
  });
});
