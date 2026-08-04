import { describe, it, expect } from 'vitest';
import { getDaysInMonth, createDate, formatDateToISO } from '../../utils/dateUtils';

describe('getDaysInMonth', () => {
  it('returns correct days for January', () => {
    expect(getDaysInMonth(2025, 0)).toBe(31);
  });

  it('returns correct days for February (non-leap)', () => {
    expect(getDaysInMonth(2025, 1)).toBe(28);
  });

  it('returns correct days for February (leap year)', () => {
    expect(getDaysInMonth(2024, 1)).toBe(29);
  });

  it('returns correct days for April', () => {
    expect(getDaysInMonth(2025, 3)).toBe(30);
  });

  it('returns correct days for all months', () => {
    const expected = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    for (let m = 0; m < 12; m++) {
      expect(getDaysInMonth(2025, m)).toBe(expected[m]);
    }
  });
});

describe('createDate', () => {
  it('creates a Date at midnight', () => {
    const date = createDate(2025, 0, 15);
    expect(date.getFullYear()).toBe(2025);
    expect(date.getMonth()).toBe(0);
    expect(date.getDate()).toBe(15);
    expect(date.getHours()).toBe(0);
    expect(date.getMinutes()).toBe(0);
    expect(date.getSeconds()).toBe(0);
    expect(date.getMilliseconds()).toBe(0);
  });

  it('handles last day of month', () => {
    const date = createDate(2025, 1, 28);
    expect(date.getDate()).toBe(28);
  });

  it('handles first day of month', () => {
    const date = createDate(2025, 0, 1);
    expect(date.getDate()).toBe(1);
  });
});

describe('formatDateToISO', () => {
  it('formats date as YYYY-MM-DD', () => {
    const date = new Date(2025, 0, 15);
    date.setHours(0, 0, 0, 0);
    expect(formatDateToISO(date)).toBe('2025-01-15');
  });

  it('defaults to current date', () => {
    const result = formatDateToISO();
    const today = new Date().toISOString().slice(0, 10);
    expect(result).toBe(today);
  });

  it('truncates time portion', () => {
    const date = new Date(2025, 5, 10, 14, 30, 45);
    const result = formatDateToISO(date);
    expect(result.length).toBe(10);
    expect(result).not.toContain('T');
  });
});
