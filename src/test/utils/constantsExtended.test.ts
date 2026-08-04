import { describe, it, expect } from 'vitest';
import {
  MONTH_NAMES,
  MONTH_ABBR,
  MONTH_ABBR_TO_FULL,
  MONTH_FULL_TO_ABBR,
  DAY_NAMES,
  DEFAULT_FILTERS,
  DIFFICULTY_COLORS,
} from '../../utils/constants';

describe('constants', () => {
  describe('MONTH_NAMES', () => {
    it('has 12 months', () => {
      expect(MONTH_NAMES.length).toBe(12);
    });

    it('has correct month names', () => {
      expect(MONTH_NAMES[0]).toBe('January');
      expect(MONTH_NAMES[5]).toBe('June');
      expect(MONTH_NAMES[11]).toBe('December');
    });
  });

  describe('MONTH_ABBR', () => {
    it('has 12 abbreviations', () => {
      expect(MONTH_ABBR.length).toBe(12);
    });

    it('has correct abbreviations', () => {
      expect(MONTH_ABBR[0]).toBe('Jan');
      expect(MONTH_ABBR[6]).toBe('Jul');
      expect(MONTH_ABBR[11]).toBe('Dec');
    });
  });

  describe('MONTH_ABBR_TO_FULL', () => {
    it('maps all abbreviations to full names', () => {
      expect(MONTH_ABBR_TO_FULL['Jan']).toBe('January');
      expect(MONTH_ABBR_TO_FULL['Dec']).toBe('December');
    });

    it('has 12 entries', () => {
      expect(Object.keys(MONTH_ABBR_TO_FULL).length).toBe(12);
    });
  });

  describe('MONTH_FULL_TO_ABBR', () => {
    it('maps all full names to abbreviations', () => {
      expect(MONTH_FULL_TO_ABBR['January']).toBe('Jan');
      expect(MONTH_FULL_TO_ABBR['December']).toBe('Dec');
    });

    it('has 12 entries', () => {
      expect(Object.keys(MONTH_FULL_TO_ABBR).length).toBe(12);
    });
  });

  describe('DAY_NAMES', () => {
    it('has 7 days starting from Sunday', () => {
      expect(DAY_NAMES.length).toBe(7);
      expect(DAY_NAMES[0]).toBe('Sun');
      expect(DAY_NAMES[6]).toBe('Sat');
    });
  });

  describe('DEFAULT_FILTERS', () => {
    it('has correct default values', () => {
      expect(DEFAULT_FILTERS.search).toBe('');
      expect(DEFAULT_FILTERS.distance).toEqual({ min: 0, max: 20 });
      expect(DEFAULT_FILTERS.elevation).toEqual({ min: 0, max: 5000 });
      expect(DEFAULT_FILTERS.difficulties).toEqual([]);
      expect(DEFAULT_FILTERS.months).toEqual([]);
      expect(DEFAULT_FILTERS.sortBy).toBe('name');
      expect(DEFAULT_FILTERS.wilderness).toBe(false);
      expect(DEFAULT_FILTERS.gpx).toBe('all');
    });
  });

  describe('DIFFICULTY_COLORS', () => {
    it('has colors for all difficulty levels', () => {
      expect(DIFFICULTY_COLORS['Easy']).toContain('green');
      expect(DIFFICULTY_COLORS['Easy to Mod']).toContain('lime');
      expect(DIFFICULTY_COLORS['Moderate']).toContain('yellow');
      expect(DIFFICULTY_COLORS['Mod to Diff']).toContain('orange');
      expect(DIFFICULTY_COLORS['Difficult']).toContain('red');
    });

    it('has 5 difficulty levels', () => {
      expect(Object.keys(DIFFICULTY_COLORS).length).toBe(5);
    });
  });
});
