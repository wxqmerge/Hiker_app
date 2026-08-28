import { describe, it, expect } from 'vitest';
import { getDaysInMonth, createDate, formatDateToISO, getHikeSlotsForMonth } from '../../utils/dateUtils';
 
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
       it('formats a specific date to YYYY-MM-DD (local time)', () => {
        const localDate = new Date(2026, 5, 15);
        expect(formatDateToISO(localDate)).toBe('2026-06-15');
      });
  
       it('defaults to current date', () => {
        const now = new Date();
        const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        expect(formatDateToISO()).toBe(expected);
      });
     });

    describe('getHikeSlotsForMonth', () => {
      it('emits one slot per hike day by default', () => {
        // 2026-01: Wednesdays are 7,14,21,28; Fridays are 2,9,16,23,30
        const slots = getHikeSlotsForMonth(2026, 0, [3, 5]);
        expect(slots.filter(s => s.slot === 0).length).toBe(9);
        expect(slots.every(s => s.slot === 0)).toBe(true);
      });

      it('caps slots at maxPerDay', () => {
        // 4 occurrences of Wednesday but maxPerDay=2 → only slots 0,1
        const slots = getHikeSlotsForMonth(2026, 0, [3, 3, 3, 3], 2);
        const wednesdays = slots.filter(s => s.day === 7);
        expect(wednesdays.map(s => s.slot).sort()).toEqual([0, 1]);
      });

      it('emits up to 3 slots for a 3-occurrence day', () => {
        const slots = getHikeSlotsForMonth(2026, 0, [3, 3, 3], 3);
        const wednesdays = slots.filter(s => s.day === 7).map(s => s.slot).sort();
        expect(wednesdays).toEqual([0, 1, 2]);
      });
    });
  });