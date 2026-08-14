import { useState, useEffect, useMemo } from 'react';
import { fetchWeatherAndTide, buildTrailCoords } from '../utils/io';
import { serverScheduleToStore } from '../utils/scheduleFormat';
import { MONTH_NAMES } from '../utils/constants';
import { createDate } from '../utils/dateUtils';
import { ensureArray } from '../utils/array';

const YEAR = 2026;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Fetch NWS weather and 10am tide for trails on the selected month+day,
 * but only when that date falls within the next 7 days.
 * If `trailIds` is provided, fetches for those trails directly.
 * Otherwise, reads trail IDs from the schedule for that day.
 * Uses trail.trailHeadLat/trailHeadLon from trail data.
 * Tide is fetched only for trails that have a `tideStationId`.
 * Returns { [trailId]: { temp, rain, tide } }.
 */
export function useDayWeather({ schedule, selectedMonth, selectedDay, trailIds, trails }) {
  const [weatherMap, setWeatherMap] = useState({});
  const [fetchedKey, setFetchedKey] = useState(null);

  const target = useMemo(() => {
    const day = selectedDay ? parseInt(selectedDay, 10) : null;
    if (day == null || isNaN(day)) return null;

    const now = new Date();
    const date = createDate(YEAR, selectedMonth, day);
    const today = createDate(now.getFullYear(), now.getMonth(), now.getDate());
    const daysAhead = Math.round((date - today) / MS_PER_DAY);
    if (daysAhead < 0 || daysAhead > 6) return null;

    let ids;
    if (trailIds) {
      ids = trailIds;
    } else {
      const store = serverScheduleToStore(schedule);
      const monthData = store[MONTH_NAMES[selectedMonth]] || {};
      const entries = ensureArray(monthData[day]);
      ids = [...new Set(entries.map(e => e?.trail_id).filter(Boolean))];
    }
    if (ids.length === 0) return null;

    const trailCoords = buildTrailCoords(ids, trails);
    return { key: `${selectedMonth}:${day}`, date, trailCoords };
  }, [schedule, selectedMonth, selectedDay, trailIds, trails]);

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
      await Promise.allSettled(Object.entries(target.trailCoords).map(async ([trailId, info]) => {
        const res = await fetchWeatherAndTide(info.lat, info.lon, target.date, info.stationId);
        if (res) results[trailId] = res;
      }));
      if (!cancelled) setWeatherMap(results);
    })();
    return () => { cancelled = true; };
  }, [target]);

  return weatherMap;
}
