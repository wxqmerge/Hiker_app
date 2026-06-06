import { describe, it, expect } from 'vitest';
import { MONTH_NAMES, MONTH_ABBR, DAY_NAMES, DEFAULT_FILTERS, DIFFICULTY_COLORS } from '../../utils/constants';

describe('constants', () => {
  describe('MONTH_NAMES', () => {
    it('has 12 months', () => {
      expect(MONTH_NAMES).toHaveLength(12);
    });

    it('has correct month names', () => {
      expect(MONTH_NAMES[0]).toBe('January');
      expect(MONTH_NAMES[11]).toBe('December');
    });
  });

  describe('MONTH_ABBR', () => {
    it('has 12 abbreviations', () => {
      expect(MONTH_ABBR).toHaveLength(12);
    });

    it('has correct abbreviations', () => {
      expect(MONTH_ABBR[0]).toBe('Jan');
      expect(MONTH_ABBR[5]).toBe('Jun');
      expect(MONTH_ABBR[11]).toBe('Dec');
    });
  });

  describe('DAY_NAMES', () => {
    it('has 7 day names', () => {
      expect(DAY_NAMES).toHaveLength(7);
    });

    it('has correct day names', () => {
      expect(DAY_NAMES[0]).toBe('Sun');
      expect(DAY_NAMES[3]).toBe('Wed');
      expect(DAY_NAMES[5]).toBe('Fri');
      expect(DAY_NAMES[6]).toBe('Sat');
    });
  });

  describe('DEFAULT_FILTERS', () => {
    it('has all required filter fields', () => {
      expect(DEFAULT_FILTERS).toHaveProperty('search', '');
      expect(DEFAULT_FILTERS).toHaveProperty('distance', { min: 0, max: 20 });
      expect(DEFAULT_FILTERS).toHaveProperty('elevation', { min: 0, max: 5000 });
      expect(DEFAULT_FILTERS).toHaveProperty('difficulties', []);
      expect(DEFAULT_FILTERS).toHaveProperty('months', []);
      expect(DEFAULT_FILTERS).toHaveProperty('sortBy', 'name');
      expect(DEFAULT_FILTERS).toHaveProperty('wilderness', false);
    });
  });

  describe('DIFFICULTY_COLORS', () => {
    it('has all difficulty levels', () => {
      expect(DIFFICULTY_COLORS['Easy']).toBe('bg-green-200 text-green-900');
      expect(DIFFICULTY_COLORS['Easy to Mod']).toBe('bg-lime-200 text-lime-900');
      expect(DIFFICULTY_COLORS['Moderate']).toBe('bg-yellow-200 text-yellow-900');
      expect(DIFFICULTY_COLORS['Mod to Diff']).toBe('bg-orange-200 text-orange-900');
      expect(DIFFICULTY_COLORS['Difficult']).toBe('bg-red-200 text-red-900');
    });
  });
});
