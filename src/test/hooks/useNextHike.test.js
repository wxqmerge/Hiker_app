import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useNextHike } from '../../hooks/useNextHike';

const mockTrails = [
  { id: 'trail-1', name: 'Trail One', fullName: 'Full Trail One' },
  { id: 'trail-2', name: 'Trail Two', fullName: 'Full Trail Two' },
];

// Mock schedule in server format. Hike days are Wed (3) and Fri (5) per setup.ts.
// Jan 2026: Jan 7 = Wed, Jan 9 = Fri, Jan 14 = Wed, Jan 16 = Fri.
const mockSchedule = {
  '2026-01': [
    { day: 7, hike: 'Hike Jan 7', trail_id: 'trail-1' }, // Wed
    { day: 9, hike: 'Hike Jan 9', trail_id: 'trail-2' }, // Fri
  ],
  '2026-02': [
    { day: 4, hike: 'Hike Feb 4', trail_id: 'trail-1' }, // Wed (far future)
  ],
};

describe('useNextHike', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('finds hikes within the next 7 days', () => {
    // Set time to Tue Jan 6, 2026, 10:00 AM. Window: Jan 6–Jan 13.
    // Jan 7 (Wed) and Jan 9 (Fri) are in-window; Feb 4 (Wed) is 29 days out.
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
        earlyStart: 0,
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
        earlyStart: 0,
      },
    ]);
  });

  it('respects an explicit maxHikes limit', () => {
    const date = new Date(2026, 0, 6, 10, 0);
    vi.setSystemTime(date);

    const { result } = renderHook(() => useNextHike({ trails: mockTrails, schedule: mockSchedule, year: 2026, maxHikes: 1 }));

    expect(result.current.map(h => h.day)).toEqual([7]);
  });

  it('caps at 4 banners by default', () => {
    // 6 hikes within 7 days (3 on Jan 7, 3 on Jan 9) → capped at 4.
    const schedule = {
      '2026-01': [
        { day: 7, slot: 0, trail_id: 'trail-1' },
        { day: 7, slot: 1, trail_id: 'trail-2' },
        { day: 7, slot: 2, trail_id: 'trail-1' },
        { day: 9, slot: 0, trail_id: 'trail-2' },
        { day: 9, slot: 1, trail_id: 'trail-1' },
        { day: 9, slot: 2, trail_id: 'trail-2' },
      ],
    };
    const date = new Date(2026, 0, 6, 10, 0);
    vi.setSystemTime(date);

    const { result } = renderHook(() => useNextHike({ trails: mockTrails, schedule, year: 2026 }));

    expect(result.current.length).toBe(4);
    expect(result.current.map(h => [h.day, h.trailId])).toEqual([
      [7, 'trail-1'],
      [7, 'trail-2'],
      [7, 'trail-1'],
      [9, 'trail-2'],
    ]);
  });

  it('includes a hike exactly 7 days out', () => {
    // Set time to Wed Jan 7, 2026. Jan 14 (Wed) is exactly 7 days out → included.
    const schedule = {
      '2026-01': [
        { day: 14, hike: 'Hike Jan 14', trail_id: 'trail-1' }, // Wed, +7
      ],
    };
    const date = new Date(2026, 0, 7, 10, 0);
    vi.setSystemTime(date);

    const { result } = renderHook(() => useNextHike({ trails: mockTrails, schedule, year: 2026 }));

    expect(result.current.map(h => h.day)).toEqual([14]);
  });

  it('excludes hikes more than 7 days out', () => {
    // Set time to Wed Jan 7, 2026. Jan 16 (Fri) is 9 days out → excluded.
    const schedule = {
      '2026-01': [
        { day: 16, hike: 'Hike Jan 16', trail_id: 'trail-1' }, // Fri, +9
      ],
    };
    const date = new Date(2026, 0, 7, 10, 0);
    vi.setSystemTime(date);

    const { result } = renderHook(() => useNextHike({ trails: mockTrails, schedule, year: 2026 }));

    expect(result.current).toBeNull();
  });

  it('finds the next hike when the current hike day has passed', () => {
    // Set time to Thu Jan 8, 2026, 10:00 AM. Jan 7 (Wed) has passed; Jan 9 (Fri) is next.
    const date = new Date(2026, 0, 8, 10, 0);
    vi.setSystemTime(date);

    const { result } = renderHook(() => useNextHike({ trails: mockTrails, schedule: mockSchedule, year: 2026 }));

    expect(result.current.map(h => h.day)).toEqual([9]);
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
    // Set time to Jan 31, 2026, 10:00 AM. Window: Jan 31–Feb 7. Feb 4 (Wed) is in-window.
    const date = new Date(2026, 0, 31, 10, 0);
    vi.setSystemTime(date);

    const { result } = renderHook(() => useNextHike({ trails: mockTrails, schedule: mockSchedule, year: 2026 }));

    expect(result.current?.[0]?.day).toBe(4);
    expect(result.current?.[0]?.monthIndex).toBe(1); // Feb
  });

  it('returns null if no hikes are found in the window', () => {
    const emptySchedule = {};
    const { result } = renderHook(() => useNextHike({ trails: mockTrails, schedule: emptySchedule, year: 2026 }));

    expect(result.current).toBeNull();
  });
});
