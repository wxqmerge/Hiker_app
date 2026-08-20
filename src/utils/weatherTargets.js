import { buildTrailCoords } from './io';
import { createDate, MS_PER_DAY } from './dateUtils';
import { ensureArray } from './array';

export function getTodayMidnight(now = new Date()) {
  return createDate(now.getFullYear(), now.getMonth(), now.getDate());
}

export function isWithinForecastRange(date, today = getTodayMidnight()) {
  const daysAhead = Math.round((date - today) / MS_PER_DAY);
  return daysAhead >= 0 && daysAhead <= 6;
}

export function getTrailIdsFromEntries(entries) {
  return [...new Set(ensureArray(entries).map(e => e?.trail_id).filter(Boolean))];
}

export function buildWeatherTarget(date, trailIds, trails, today = getTodayMidnight()) {
  return {
    date,
    trailCoords: buildTrailCoords(trailIds, trails),
    inForecastRange: isWithinForecastRange(date, today),
  };
}
