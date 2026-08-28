import { useMemo } from 'react';
import { findTrailById as findTrailByIdUtil } from '../utils/data';
import { getDayEntries } from '../utils/scheduleFormat';
import { getDaysInMonth, createDate, getTodayHikeRef, getMonthKey } from '../utils/dateUtils';
import { normalizeStartOffset } from '../utils/etc';
import { useHikeDays } from './useHikeDays';
import { useScheduleStore } from './useScheduleStore';

/**
 * Compute the next upcoming hike(s) from schedule data.
 * Scans configured hike days chronologically starting from today.
 * Returns up to `maxHikes` total hikes (default 3, matching the per-day slot cap).
 */
export function useNextHike({ trails, schedule, maxHikes = 3 }) {

  const scheduleStore = useScheduleStore(schedule);
  const hikeDays = useHikeDays();

  return useMemo(() => {
    const allHikes = [];
    const today = getTodayHikeRef();
    const baseYear = today.getFullYear();

    // Scan up to 24 months from today to handle year rollover (e.g. Dec → Jan of next year).
    for (let offset = 0; offset < 24 && allHikes.length < maxHikes; offset++) {
      const y = baseYear + Math.floor(offset / 12);
      const m = offset % 12;
      const monthData = scheduleStore[getMonthKey(y, m)] || {};
      const daysInMonth = getDaysInMonth(y, m);
      for (let day = 1; day <= daysInMonth && allHikes.length < maxHikes; day++) {
        const date = createDate(y, m, day);
        const dow = date.getDay();
        if (hikeDays.includes(dow) && date >= today) {
          const entryList = getDayEntries(monthData, day);
          for (const entry of entryList) {
            if (allHikes.length >= maxHikes) break;
            if (!entry) continue;
            const trail = findTrailByIdUtil(trails, entry.trail_id);
            if (!trail) continue;
            allHikes.push({
              day,
              monthIndex: m,
              year: y,
              monthKey: getMonthKey(y, m),
              date,
              trail,
              trailId: entry.trail_id,
              leader: entry.leader || '',
              earlyStart: normalizeStartOffset(entry.early_start),
            });
          }
        }
      }
    }
    return allHikes.length > 0 ? allHikes : null;
  }, [scheduleStore, trails, maxHikes, hikeDays]);
}
