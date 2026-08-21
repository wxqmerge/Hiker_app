import { useMemo, useCallback } from 'react';
import { fetchWeatherForCoords, fetchTideForCoords } from '../utils/io';
import { serverScheduleToStore, getDayEntries } from '../utils/scheduleFormat';
import { CURRENT_YEAR } from '../utils/constants';
import { createDate, getMonthKey } from '../utils/dateUtils';
import { getTodayMidnight, getTrailIdsFromEntries, buildWeatherTarget } from '../utils/weatherTargets';
import { useWeatherFetch } from './useWeatherFetch';

/**
 * Fetch NWS weather and 10am tide for trails on the selected month+day.
 * Weather is fetched only when that date falls within the next 7 days.
 * Tide can be fetched for any past or future date.
 * If `trailIds` is provided, fetches for those trails directly.
 * Otherwise, reads trail IDs from the schedule for that day.
 * Uses trail.trailHeadLat/trailHeadLon from trail data.
 * Tide is fetched only for trails that have a `tideStationId`.
 * Returns { [trailId]: { temp, rain, tide } }.
 */
export function useDayWeather({ schedule, selectedMonth, selectedDay, trailIds, trails, year = CURRENT_YEAR }) {
  const target = useMemo(() => {
    const day = selectedDay ? parseInt(selectedDay, 10) : null;
    if (day == null || isNaN(day)) return null;

    const date = createDate(year, selectedMonth, day);
    const today = getTodayMidnight();

    let ids;
    if (trailIds) {
      ids = trailIds;
    } else {
      const store = serverScheduleToStore(schedule);
      const monthData = store[getMonthKey(year, selectedMonth)] || {};
      ids = getTrailIdsFromEntries(getDayEntries(monthData, day));
    }
    if (ids.length === 0) return null;

    const { trailCoords, inForecastRange } = buildWeatherTarget(date, ids, trails, today);
    return { key: `${year}:${selectedMonth}:${day}`, date, trailCoords, inForecastRange };
  }, [schedule, selectedMonth, selectedDay, trailIds, trails, year]);

  const fetchFn = useCallback(async (t) => {
    return t.inForecastRange
      ? await fetchWeatherForCoords(t.trailCoords, t.date)
      : await fetchTideForCoords(t.trailCoords, t.date);
  }, []);

  return useWeatherFetch(target, fetchFn);
}
