import { describe, it, expect } from 'vitest';
import { getDaysInMonth, createDate, formatDateToISO } from '../../utils/dateUtils';
 
 describe('dateUtils', () => {
   describe('getDaysInMonth', () => {
     it('returns correct days for January', () => {
       expect(getDaysInMonth(2026, 0)).toBe(31);
     });
 
     it('returns correct days for February (non-leap)', () => {
       expect(getDaysInMonth(2026, 1)).toBe(28);
     });
 
     it('returns correct days for February (leap year)', () => {
       expect(getDaysInMonth(2024, 1)).toBe(29);
     });
 
     it('returns correct days for April', () => {
       expect(getDaysInMonth(2026, 3)).toBe(30);
     });
   });
 
   describe('createDate', () => {
     it('creates a date normalized to midnight', () => {
       const date = createDate(2026, 6, 15);
       expect(date.getFullYear()).toBe(2026);
       expect(date.getMonth()).toBe(6);
       expect(date.getDate()).toBe(15);
       expect(date.getHours()).toBe(0);
       expect(date.getMinutes()).toBe(0);
       expect(date.getSeconds()).toBe(0);
       expect(date.getMilliseconds()).toBe(0);
     });
   });
 
   describe('formatDateToISO', () => {
      it('formats a specific date to YYYY-MM-DD', () => {
        // Note: toISOString() uses UTC. For consistency in tests, we use a fixed UTC date.
       const utcDate = new Date(Date.UTC(2026, 5, 15));
       expect(formatDateToISO(utcDate)).toBe('2026-06-15');
     });
 
     it('defaults to current date', () => {
       const today = new Date().toISOString().slice(0, 10);
       expect(formatDateToISO()).toBe(today);
     });
   });
 });