import { useState, useEffect, useMemo } from 'react';
import { fetchWeatherForCoords, fetchTideForCoords } from '../utils/io';
import { serverScheduleToStore, getDayEntries } from '../utils/scheduleFormat';
import { MONTH_NAMES, CURRENT_YEAR } from '../utils/constants';
import { createDate, getDaysInMonth } from '../utils/dateUtils';
import { getTodayMidnight, getTrailIdsFromEntries, buildWeatherTarget } from '../utils/weatherTargets';

/**
 * Fetch NWS weather and 10am tide for trails scheduled on any day of the
 * selected month. Weather is fetched only for days within the next 7 days
 * (NWS forecast range). Tide can be fetched for any past or future date.
 * Uses trail.trailHeadLat/trailHeadLon from trail data.
 * Tide is fetched only for trails that have a `tideStationId`.
 * Returns { [day]: { [trailId]: { temp, rain, tide } } }.
 */
export function useScheduleWeather({ schedule, selectedMonth, trails, year = CURRENT_YEAR }) {
  const [weather, setWeather] = useState({ key: null, map: {} });

  const target = useMemo(() => {
    const store = serverScheduleToStore(schedule);
    const monthData = store[MONTH_NAMES[selectedMonth]] || {};
    const daysInMonth = getDaysInMonth(year, selectedMonth);
    const today = getTodayMidnight();

    const days = {};
    for (let day = 1; day <= daysInMonth; day++) {
      const trailIds = getTrailIdsFromEntries(getDayEntries(monthData, day));
      if (trailIds.length === 0) continue;
      const date = createDate(year, selectedMonth, day);
      days[day] = buildWeatherTarget(date, trailIds, trails, today);
    }
    if (Object.keys(days).length === 0) return null;

    return { key: `${year}:${selectedMonth}:${today.toDateString()}`, days };
  }, [schedule, selectedMonth, trails, year]);

  useEffect(() => {
    if (!target) return;
    let cancelled = false;
    (async () => {
      const results = {};
      await Promise.allSettled(Object.entries(target.days).map(async ([day, info]) => {
        const dayResults = info.inForecastRange
          ? await fetchWeatherForCoords(info.trailCoords, info.date)
          : await fetchTideForCoords(info.trailCoords, info.date);
        if (Object.keys(dayResults).length > 0) results[day] = dayResults;
      }));
      if (!cancelled) setWeather({ key: target.key, map: results });
    })();
    return () => { cancelled = true; };
  }, [target]);

  const weatherMap = useMemo(() => {
    if (!target || weather.key !== target.key) return {};
    return weather.map;
  }, [target, weather]);

  return weatherMap;
}
