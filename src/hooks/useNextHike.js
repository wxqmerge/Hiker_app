import { useMemo } from 'react';
import { MONTH_NAMES } from '../utils/constants';
import { findTrailById as findTrailByIdUtil } from '../utils/data';
import { serverScheduleToStore } from '../utils/scheduleFormat';
import { getDaysInMonth, createDate, getTodayHikeRef } from '../utils/dateUtils';
import { getHikeDays } from '../utils/config';
import { ensureArray } from '../utils/array';

/**
 * Compute the next upcoming hike(s) from schedule data.
 * Scans configured hike days chronologically starting from today.
 * Returns up to `maxHikes` total hikes (default 2).
 */
export function useNextHike({ trails, schedule, year = 2026, maxHikes = 2 }) {

  const scheduleStore = useMemo(() => serverScheduleToStore(schedule), [schedule]);

  return useMemo(() => {
    const allHikes = [];
    const today = getTodayHikeRef();
    const hikeDays = getHikeDays();

    for (let m = 0; m < 12 && allHikes.length < maxHikes; m++) {
      const monthData = scheduleStore[MONTH_NAMES[m]] || {};
      const daysInMonth = getDaysInMonth(year, m);
      for (let day = 1; day <= daysInMonth && allHikes.length < maxHikes; day++) {
        const date = createDate(year, m, day);
        const dow = date.getDay();
        if (hikeDays.includes(dow) && date >= today) {
          const entries = monthData[day] || [];
          const entryList = ensureArray(entries);
          for (const entry of entryList) {
            if (allHikes.length >= maxHikes) break;
            if (!entry) continue;
            const trail = findTrailByIdUtil(trails, entry.trail_id);
            if (!trail) continue;
            allHikes.push({
              day,
              monthIndex: m,
              date,
              trail,
              trailId: entry.trail_id,
              leader: entry.leader || '',
              earlyStart: !!entry.early_start,
            });
          }
        }
      }
    }
    return allHikes.length > 0 ? allHikes : null;
  }, [scheduleStore, trails, year, maxHikes]);
}
