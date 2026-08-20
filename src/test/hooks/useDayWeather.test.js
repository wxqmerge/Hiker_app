import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDayWeather } from '../../hooks/useDayWeather';
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

describe('useDayWeather', () => {
  const now = new Date();
  const month = now.getMonth();
  const day = now.getDate();
  const abbr = MONTH_ABBR[month];

  const scheduleWithHike = {
    [abbr]: { [day]: [{ trail_id: 'trail-1' }] },
  };

  const trailsWithCoords = [{ id: 'trail-1', trailHeadLat: 47.6, trailHeadLon: -122.3 }];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty map when no day selected', () => {
    const { result } = renderHook(() => useDayWeather({ schedule: scheduleWithHike, selectedMonth: month, selectedDay: '' }));
    expect(result.current).toEqual({});
  });

  it('does not fetch when no day selected', () => {
    renderHook(() => useDayWeather({ schedule: scheduleWithHike, selectedMonth: month, selectedDay: '' }));
    expect(fetchWeatherAndTide).not.toHaveBeenCalled();
  });

  it('fetches weather for scheduled trail on a date within 7 days', async () => {
    const { result } = renderHook(() => useDayWeather({ schedule: scheduleWithHike, selectedMonth: month, selectedDay: String(day), trails: trailsWithCoords }));
    await waitFor(() => {
      expect(result.current['trail-1']).toEqual({ temp: 70, rain: 10 });
    });
    expect(fetchWeatherAndTide).toHaveBeenCalledWith(47.6, -122.3, expect.any(Date), null);
  });

  it('does not fetch for dates beyond 7 days out', () => {
    const future = new Date(now);
    future.setDate(future.getDate() + 10);
    renderHook(() => useDayWeather({
      schedule: { [MONTH_ABBR[future.getMonth()]]: { [future.getDate()]: [{ trail_id: 'trail-1' }] } },
      selectedMonth: future.getMonth(),
      selectedDay: String(future.getDate()),
    }));
    expect(fetchWeatherAndTide).not.toHaveBeenCalled();
  });

  it('does not fetch for past dates', () => {
    const past = new Date(now);
    past.setDate(past.getDate() - 10);
    renderHook(() => useDayWeather({
      schedule: { [MONTH_ABBR[past.getMonth()]]: { [past.getDate()]: [{ trail_id: 'trail-1' }] } },
      selectedMonth: past.getMonth(),
      selectedDay: String(past.getDate()),
    }));
    expect(fetchWeatherAndTide).not.toHaveBeenCalled();
  });

  it('returns empty map when nothing scheduled on the day', () => {
    const { result } = renderHook(() => useDayWeather({ schedule: {}, selectedMonth: month, selectedDay: String(day) }));
    expect(result.current).toEqual({});
    expect(fetchWeatherAndTide).not.toHaveBeenCalled();
  });

  it('dedupes trail ids across multiple slots', async () => {
    const schedule = {
      [abbr]: { [day]: [{ trail_id: 'trail-1' }, { trail_id: 'trail-1' }] },
    };
    const { result } = renderHook(() => useDayWeather({ schedule, selectedMonth: month, selectedDay: String(day), trails: trailsWithCoords }));
    await waitFor(() => {
      expect(result.current['trail-1']).toEqual({ temp: 70, rain: 10 });
    });
    expect(fetchWeatherAndTide).toHaveBeenCalledTimes(1);
  });

  it('skips entries without a trail id', async () => {
    const schedule = {
      [abbr]: { [day]: [{ trail_id: null }, { trail_id: 'trail-1' }] },
    };
    const { result } = renderHook(() => useDayWeather({ schedule, selectedMonth: month, selectedDay: String(day), trails: trailsWithCoords }));
    await waitFor(() => {
      expect(Object.keys(result.current)).toEqual(['trail-1']);
    });
  });

  it('passes stationId to fetchWeatherAndTide when trail has tideStationId', async () => {
    fetchWeatherAndTide.mockImplementation(async () => ({ temp: 70, rain: 10, tide: 3.2 }));
    const { result, unmount } = renderHook(() => useDayWeather({
      schedule: scheduleWithHike,
      selectedMonth: month,
      selectedDay: String(day),
      trails: [{ id: 'trail-1', trailHeadLat: 47.6, trailHeadLon: -122.3, tideStationId: '9447130' }],
    }));
    await waitFor(() => {
      expect(result.current['trail-1']).toEqual({ temp: 70, rain: 10, tide: 3.2 });
    });
    expect(fetchWeatherAndTide).toHaveBeenCalledWith(47.6, -122.3, expect.any(Date), '9447130');
    unmount();
    fetchWeatherAndTide.mockImplementation(async () => ({ temp: 70, rain: 10 }));
  });

  it('skips trails without trailHead coordinates', async () => {
    const { result } = renderHook(() => useDayWeather({
      schedule: scheduleWithHike,
      selectedMonth: month,
      selectedDay: String(day),
      trails: [{ id: 'trail-1' }],
    }));
    await waitFor(() => {
      expect(result.current['trail-1']).toBeUndefined();
    });
    expect(fetchWeatherAndTide).not.toHaveBeenCalled();
  });
});
