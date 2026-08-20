import { useState, useEffect, useMemo } from 'react';
import { fetchWeatherForCoords, buildTrailCoords } from '../utils/io';
import { serverScheduleToStore } from '../utils/scheduleFormat';
import { MONTH_NAMES, CURRENT_YEAR } from '../utils/constants';
import { createDate, getDaysInMonth, MS_PER_DAY } from '../utils/dateUtils';
import { ensureArray } from '../utils/array';

const YEAR = CURRENT_YEAR;

/**
 * Fetch NWS weather and 10am tide for trails scheduled on any day of the
 * selected month that falls within the next 7 days (NWS forecast range).
 * Uses trail.trailHeadLat/trailHeadLon from trail data.
 * Tide is fetched only for trails that have a `tideStationId`.
 * Returns { [day]: { [trailId]: { temp, rain, tide } } }.
 */
export function useScheduleWeather({ schedule, selectedMonth, trails }) {
  const [weatherMap, setWeatherMap] = useState({});
  const [fetchedKey, setFetchedKey] = useState(null);

  const target = useMemo(() => {
    const store = serverScheduleToStore(schedule);
    const monthData = store[MONTH_NAMES[selectedMonth]] || {};
    const daysInMonth = getDaysInMonth(YEAR, selectedMonth);
    const now = new Date();
    const today = createDate(now.getFullYear(), now.getMonth(), now.getDate());

    const days = {};
    for (let day = 1; day <= daysInMonth; day++) {
      const entries = ensureArray(monthData[day]);
      const trailIds = [...new Set(entries.map(e => e?.trail_id).filter(Boolean))];
      if (trailIds.length === 0) continue;
      const date = createDate(YEAR, selectedMonth, day);
      const daysAhead = Math.round((date - today) / MS_PER_DAY);
      if (daysAhead < 0 || daysAhead > 6) continue;
      const trailCoords = buildTrailCoords(trailIds, trails);
      days[day] = { date, trailCoords };
    }
    if (Object.keys(days).length === 0) return null;

    return { key: `${selectedMonth}:${today.toDateString()}`, days };
  }, [schedule, selectedMonth, trails]);

  const key = target ? target.key : null;
  if (key !== fetchedKey) {
    setFetchedKey(key);
    setWeatherMap({});
  }

  useEffect(() => {
    if (!target) return;
    let cancelled = false;
    (async () => {
      const results = {};
      await Promise.allSettled(Object.entries(target.days).map(async ([day, info]) => {
        const dayResults = await fetchWeatherForCoords(info.trailCoords, info.date);
        if (Object.keys(dayResults).length > 0) results[day] = dayResults;
      }));
      if (!cancelled) setWeatherMap(results);
    })();
    return () => { cancelled = true; };
  }, [target]);

  return weatherMap;
}
