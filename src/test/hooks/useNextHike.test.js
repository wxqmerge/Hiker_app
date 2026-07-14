import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useNextHike } from '../../hooks/useNextHike';
 
 const mockTrails = [
   { id: 'trail-1', name: 'Trail One', fullName: 'Full Trail One' },
   { id: 'trail-2', name: 'Trail Two', fullName: 'Full Trail Two' },
 ];
 
 // Mock schedule in server format: { "Jan": [{ day: 5, hike: "Hike 1", trail_id: "trail-1" }], ... }
 const mockSchedule = {
   'Jan': [
     { day: 7, hike: 'Hike Jan 7', trail_id: 'trail-1' }, // Wed
     { day: 9, hike: 'Hike Jan 9', trail_id: 'trail-2' }, // Fri
   ],
   'Feb': [
     { day: 4, hike: 'Hike Feb 4', trail_id: 'trail-1' }, // Wed
   ],
 };
 
 describe('useNextHike', () => {
   beforeEach(() => {
     vi.useFakeTimers();
   });
 
   afterEach(() => {
     vi.useRealTimers();
   });
 
     it('finds the next 2 hike dates', () => {
       // Set time to Tue Jan 6, 2026, 10:00 AM
       const date = new Date(2026, 0, 6, 10, 0);
       vi.setSystemTime(date);

       const { result } = renderHook(() => useNextHike({ trails: mockTrails, schedule: mockSchedule }));

       expect(result.current).toEqual([
         {
           day: 7,
           monthIndex: 0,
           date: expect.any(Date),
           trail: mockTrails[0],
           trailId: 'trail-1',
           leader: '',
           earlyStart: false,
         },
         {
           day: 9,
           monthIndex: 0,
           date: expect.any(Date),
           trail: mockTrails[1],
           trailId: 'trail-2',
           leader: '',
           earlyStart: false,
         }
       ]);
     });

 
     it('finds the next 2 hike dates when Wednesday passed', () => {
       // Set time to Thu Jan 8, 2026, 10:00 AM
       const date = new Date(2026, 0, 8, 10, 0);
       vi.setSystemTime(date);

       const { result } = renderHook(() => useNextHike({ trails: mockTrails, schedule: mockSchedule }));

       expect(result.current).toEqual([
         {
           day: 9,
           monthIndex: 0,
           date: expect.any(Date),
           trail: mockTrails[1],
           trailId: 'trail-2',
           leader: '',
           earlyStart: false,
         },
         {
           day: 4,
           monthIndex: 1,
           date: expect.any(Date),
           trail: mockTrails[0],
           trailId: 'trail-1',
           leader: '',
           earlyStart: false,
         }
       ]);
     });
 
     it('skips to next day if current time is >= 12 PM', () => {
       // Set time to Wed Jan 7, 2026, 1:00 PM (Hike is today, but should be skipped)
       const date = new Date(2026, 0, 7, 13, 0);
       vi.setSystemTime(date);

       const { result } = renderHook(() => useNextHike({ trails: mockTrails, schedule: mockSchedule }));

       // Should find Jan 9 (Fri) and Feb 4 (Wed)
       expect(result.current?.[0]?.day).toBe(9);
       expect(result.current?.[0]?.monthIndex).toBe(0);
       expect(result.current?.[1]?.day).toBe(4);
       expect(result.current?.[1]?.monthIndex).toBe(1);
     });
 
    it('finds a hike in the next month if current month is empty/passed', () => {
      // Set time to Jan 31, 2026, 10:00 AM
      const date = new Date(2026, 0, 31, 10, 0);
      vi.setSystemTime(date);
  
      const { result } = renderHook(() => useNextHike({ trails: mockTrails, schedule: mockSchedule }));
      
      expect(result.current?.[0]?.day).toBe(4);
      expect(result.current?.[0]?.monthIndex).toBe(1); // Feb
    });
 
   it('returns null if no hikes are found in the year', () => {
     const emptySchedule = {};
     const { result } = renderHook(() => useNextHike({ trails: mockTrails, schedule: emptySchedule }));
     
     expect(result.current).toBeNull();
   });
 });