import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useNextHike } from '../../hooks/useNextHike';
 
 const mockTrails = [
   { id: 'trail-1', name: 'Trail One', fullName: 'Full Trail One' },
   { id: 'trail-2', name: 'Trail Two', fullName: 'Full Trail Two' },
 ];
 
  // Mock schedule in server format: { "2026-01": [{ day: 5, hike: "Hike 1", trail_id: "trail-1" }], ... }
  const mockSchedule = {
    '2026-01': [
      { day: 7, hike: 'Hike Jan 7', trail_id: 'trail-1' }, // Wed
      { day: 9, hike: 'Hike Jan 9', trail_id: 'trail-2' }, // Fri
    ],
    '2026-02': [
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
 
     it('finds the next 2 hikes', () => {
       // Set time to Tue Jan 6, 2026, 10:00 AM
       const date = new Date(2026, 0, 6, 10, 0);
       vi.setSystemTime(date);

        const { result } = renderHook(() => useNextHike({ trails: mockTrails, schedule: mockSchedule, year: 2026 }));

         expect(result.current).toEqual([
          {
            day: 7,
            monthIndex: 0,
            year: 2026,
            monthKey: '2026-01',
            date: expect.any(Date),
            trail: mockTrails[0],
            trailId: 'trail-1',
            leader: '',
            earlyStart: false,
          },
          {
            day: 9,
            monthIndex: 0,
            year: 2026,
            monthKey: '2026-01',
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

        const { result } = renderHook(() => useNextHike({ trails: mockTrails, schedule: mockSchedule, year: 2026 }));

         expect(result.current).toEqual([
          {
            day: 9,
            monthIndex: 0,
            year: 2026,
            monthKey: '2026-01',
            date: expect.any(Date),
            trail: mockTrails[1],
            trailId: 'trail-2',
            leader: '',
            earlyStart: false,
          },
          {
            day: 4,
            monthIndex: 1,
            year: 2026,
            monthKey: '2026-02',
            date: expect.any(Date),
            trail: mockTrails[0],
            trailId: 'trail-1',
            leader: '',
            earlyStart: false,
          }
        ]);
     });
 
      it('includes todays hike even after noon', () => {
        // Set time to Wed Jan 7, 2026, 1:00 PM (Hike is today, should still show)
        const date = new Date(2026, 0, 7, 13, 0);
        vi.setSystemTime(date);

         const { result } = renderHook(() => useNextHike({ trails: mockTrails, schedule: mockSchedule, year: 2026 }));

         // Should find Jan 7 (today) and Jan 9 (Fri)
        expect(result.current?.[0]?.day).toBe(7);
        expect(result.current?.[0]?.monthIndex).toBe(0);
        expect(result.current?.[1]?.day).toBe(9);
        expect(result.current?.[1]?.monthIndex).toBe(0);
      });
 
    it('finds a hike in the next month if current month is empty/passed', () => {
      // Set time to Jan 31, 2026, 10:00 AM
      const date = new Date(2026, 0, 31, 10, 0);
      vi.setSystemTime(date);
  
      const { result } = renderHook(() => useNextHike({ trails: mockTrails, schedule: mockSchedule, year: 2026 }));
      
      expect(result.current?.[0]?.day).toBe(4);
      expect(result.current?.[0]?.monthIndex).toBe(1); // Feb
    });
 
   it('returns null if no hikes are found in the year', () => {
      const emptySchedule = {};
      const { result } = renderHook(() => useNextHike({ trails: mockTrails, schedule: emptySchedule, year: 2026 }));
      
      expect(result.current).toBeNull();
   });
 });