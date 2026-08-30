import { describe, it, expect } from 'vitest';
import {
  MONTH_NAMES,
  MONTH_ABBR,
  MONTH_ABBR_TO_FULL,
  DAY_NAMES,
  DEFAULT_FILTERS,
  DIFFICULTY_COLORS,
} from '../../utils/constants';

describe('constants', () => {
  describe('MONTH_NAMES', () => {
    it('has 12 months', () => {
      expect(MONTH_NAMES).toHaveLength(12);
    });

    it('has correct month names', () => {
      expect(MONTH_NAMES[0]).toBe('January');
      expect(MONTH_NAMES[5]).toBe('June');
      expect(MONTH_NAMES[11]).toBe('December');
    });
  });

  describe('MONTH_ABBR', () => {
    it('has 12 abbreviations', () => {
      expect(MONTH_ABBR).toHaveLength(12);
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

  describe('DAY_NAMES', () => {
    it('has 7 days starting from Sunday', () => {
      expect(DAY_NAMES).toHaveLength(7);
      expect(DAY_NAMES[0]).toBe('Sun');
      expect(DAY_NAMES[3]).toBe('Wed');
      expect(DAY_NAMES[5]).toBe('Fri');
      expect(DAY_NAMES[6]).toBe('Sat');
    });
  });

  describe('DEFAULT_FILTERS', () => {
    it('has all required filter fields', () => {
      expect(DEFAULT_FILTERS).toHaveProperty('search', '');
      expect(DEFAULT_FILTERS).toHaveProperty('distance', { min: 0, max: 100 });
      expect(DEFAULT_FILTERS).toHaveProperty('elevation', { min: 0, max: 15000 });
      expect(DEFAULT_FILTERS).toHaveProperty('difficulties', []);
      expect(DEFAULT_FILTERS).toHaveProperty('months', []);
      expect(DEFAULT_FILTERS).toHaveProperty('sortBy', 'name');
      expect(DEFAULT_FILTERS).toHaveProperty('wilderness', false);
      expect(DEFAULT_FILTERS).toHaveProperty('gpx', 'all');
    });
  });

  describe('DIFFICULTY_COLORS', () => {
    it('has colors for all difficulty levels', () => {
      expect(DIFFICULTY_COLORS['Easy']).toBe('bg-green-200 text-green-900');
      expect(DIFFICULTY_COLORS['Easy to Mod']).toBe('bg-lime-200 text-lime-900');
      expect(DIFFICULTY_COLORS['Moderate']).toBe('bg-yellow-200 text-yellow-900');
      expect(DIFFICULTY_COLORS['Mod to Diff']).toBe('bg-orange-200 text-orange-900');
      expect(DIFFICULTY_COLORS['Difficult']).toBe('bg-red-200 text-red-900');
    });

    it('has 5 difficulty levels', () => {
      expect(Object.keys(DIFFICULTY_COLORS).length).toBe(5);
    });
  });
});
