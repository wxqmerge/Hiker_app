import { buildTrailCoords } from './io';
import { createDate, MS_PER_DAY } from './dateUtils';
import { normalizeDayEntries } from './scheduleFormat';

export function getTodayMidnight(now = new Date()) {
  return createDate(now.getFullYear(), now.getMonth(), now.getDate());
}

// Weather is fetched for any today-or-future date: NWS covers the next 7 days,
// Open-Meteo covers dates beyond that. Past dates get tide only (no forecast).
export function isTodayOrFuture(date, today = getTodayMidnight()) {
  const daysAhead = Math.round((date - today) / MS_PER_DAY);
  return daysAhead >= 0;
}

export function getTrailIdsFromEntries(entries) {
  return [...new Set(normalizeDayEntries(entries).map(e => e.trail_id).filter(Boolean))];
}

export function buildWeatherTarget(date, trailIds, trails, today = getTodayMidnight()) {
  return {
    date,
    trailCoords: buildTrailCoords(trailIds, trails),
    isTodayOrFuture: isTodayOrFuture(date, today),
  };
}
