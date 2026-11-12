import { buildTrailCoords } from './io';
import { MS_PER_DAY, getTodayHikeRef } from './dateUtils';
import { normalizeDayEntries } from './scheduleFormat';
import { tideInfoForEntry } from './etc';

export const getTodayMidnight = getTodayHikeRef;

// Weather is fetched for any today-or-future date: NWS covers the next 7 days,
// Open-Meteo covers dates beyond that. Past dates get tide only (no forecast).
function isTodayOrFuture(date, today = getTodayMidnight()) {
  const daysAhead = Math.round((date - today) / MS_PER_DAY);
  return daysAhead >= 0;
}

export function getTrailIdsFromEntries(entries) {
  return [...new Set(normalizeDayEntries(entries).map(e => e.trail_id).filter(Boolean))];
}

export function buildWeatherTarget(date, trailIds, trails, today = getTodayMidnight(), entries = null) {
  const trailById = new Map((trails || []).map(t => [t.id, t]));
  const tideInfoById = {};
  for (const e of normalizeDayEntries(entries || [])) {
    if (e.trail_id && trailById.has(e.trail_id) && !tideInfoById[e.trail_id]) {
      tideInfoById[e.trail_id] = tideInfoForEntry(trailById.get(e.trail_id), e.early_start);
    }
  }
  return {
    date,
    trailCoords: buildTrailCoords(trailIds, trails, tideInfoById),
    isTodayOrFuture: isTodayOrFuture(date, today),
  };
}
