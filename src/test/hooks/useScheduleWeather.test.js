import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useScheduleWeather } from '../../hooks/useScheduleWeather';
import { fetchWeatherAndTide } from '../../utils/io';
import { MONTH_ABBR } from '../../utils/constants';

vi.mock('../../utils/io', async (importOriginal) => {
  const actual = await importOriginal();
  const fetchWeatherAndTide = vi.fn(async () => ({ temp: 70, rain: 10 }));
  const fetchWeatherForCoords = vi.fn(async (trailCoords, date) => {
    const results = {};
    await Promise.all(Object.entries(trailCoords).map(async ([id, info]) => {
      const res = await fetchWeatherAndTide(info.lat, info.lon, date, info.stationId);
      if (res) results[id] = res;
    }));
    return results;
  });
  return { ...actual, fetchWeatherAndTide, fetchWeatherForCoords };
});

describe('useScheduleWeather', () => {
  const now = new Date();
  const month = now.getMonth();
  const day = now.getDate();
  const abbr = MONTH_ABBR[month];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty map when nothing scheduled', () => {
    const { result } = renderHook(() => useScheduleWeather({ schedule: {}, selectedMonth: month, trails: [] }));
    expect(result.current).toEqual({});
  });

  it('fetches weather for scheduled trails on days within 7 days', async () => {
    const schedule = {
      [abbr]: { [day]: [{ trail_id: 'trail-1' }, { trail_id: 'trail-2' }] },
    };
    const trails = [
      { id: 'trail-1', trailHeadLat: 47.6, trailHeadLon: -122.3 },
      { id: 'trail-2', trailHeadLat: 47.8, trailHeadLon: -122.1 },
    ];
    const { result } = renderHook(() => useScheduleWeather({ schedule, selectedMonth: month, trails }));
    await waitFor(() => {
      expect(result.current[String(day)]).toEqual({
        'trail-1': { temp: 70, rain: 10 },
        'trail-2': { temp: 70, rain: 10 },
      });
    });
    expect(fetchWeatherAndTide).toHaveBeenCalledWith(47.6, -122.3, expect.any(Date), null);
    expect(fetchWeatherAndTide).toHaveBeenCalledWith(47.8, -122.1, expect.any(Date), null);
  });

  it('passes stationId when trail has tideStationId', async () => {
    const schedule = {
      [abbr]: { [day]: [{ trail_id: 'trail-1' }] },
    };
    const trails = [{ id: 'trail-1', trailHeadLat: 47.6, trailHeadLon: -122.3, tideStationId: '9447130' }];
    fetchWeatherAndTide.mockImplementation(async () => ({ temp: 70, rain: 10, tide: 3.2 }));
    const { result, unmount } = renderHook(() => useScheduleWeather({ schedule, selectedMonth: month, trails }));
    await waitFor(() => {
      expect(result.current[String(day)]).toEqual({ 'trail-1': { temp: 70, rain: 10, tide: 3.2 } });
    });
    expect(fetchWeatherAndTide).toHaveBeenCalledWith(47.6, -122.3, expect.any(Date), '9447130');
    unmount();
    fetchWeatherAndTide.mockImplementation(async () => ({ temp: 70, rain: 10 }));
  });

  it('skips days beyond 7 days out', () => {
    const future = new Date(now);
    future.setDate(future.getDate() + 10);
    renderHook(() => useScheduleWeather({
      schedule: { [MONTH_ABBR[future.getMonth()]]: { [future.getDate()]: [{ trail_id: 'trail-1' }] } },
      selectedMonth: future.getMonth(),
      trails: [{ id: 'trail-1' }],
    }));
    expect(fetchWeatherAndTide).not.toHaveBeenCalled();
  });

  it('skips past days', () => {
    const past = new Date(now);
    past.setDate(past.getDate() - 10);
    renderHook(() => useScheduleWeather({
      schedule: { [MONTH_ABBR[past.getMonth()]]: { [past.getDate()]: [{ trail_id: 'trail-1' }] } },
      selectedMonth: past.getMonth(),
      trails: [{ id: 'trail-1' }],
    }));
    expect(fetchWeatherAndTide).not.toHaveBeenCalled();
  });

  it('skips entries without a trail id', async () => {
    const schedule = {
      [abbr]: { [day]: [{ trail_id: null }, { trail_id: 'trail-1' }] },
    };
    const trails = [{ id: 'trail-1', trailHeadLat: 47.6, trailHeadLon: -122.3 }];
    const { result } = renderHook(() => useScheduleWeather({ schedule, selectedMonth: month, trails }));
    await waitFor(() => {
      expect(Object.keys(result.current[String(day)])).toEqual(['trail-1']);
    });
  });
});
