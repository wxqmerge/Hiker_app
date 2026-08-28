import { useMemo } from 'react';
import { findTrailById as findTrailByIdUtil } from '../utils/data';
import { getDayEntries } from '../utils/scheduleFormat';
import { createDate, getTodayHikeRef, getMonthKey } from '../utils/dateUtils';
import { normalizeStartOffset } from '../utils/etc';
import { useHikeDays } from './useHikeDays';
import { useScheduleStore } from './useScheduleStore';

// The banner is a "this week" view: only surface hikes within the next 7 days.
// Hikes further out remain reachable from the calendar/schedule views.
const MAX_BANNER_DAYS = 7;

/**
 * Compute the next upcoming hike(s) from schedule data.
 * Scans configured hike days chronologically starting from today, but only
 * within the next MAX_BANNER_DAYS (7) days. Returns up to `maxHikes` total
 * hikes (default 4).
 */
export function useNextHike({ trails, schedule, maxHikes = 4 }) {

  const scheduleStore = useScheduleStore(schedule);
  const hikeDays = useHikeDays();

  return useMemo(() => {
    const allHikes = [];
    const today = getTodayHikeRef();

    // Scan today through today+MAX_BANNER_DAYS (inclusive).
    for (let i = 0; i <= MAX_BANNER_DAYS && allHikes.length < maxHikes; i++) {
      const target = new Date(today);
      target.setDate(target.getDate() + i);
      const y = target.getFullYear();
      const m = target.getMonth();
      const day = target.getDate();
      const date = createDate(y, m, day);
      if (!hikeDays.includes(date.getDay())) continue;
      const monthData = scheduleStore[getMonthKey(y, m)] || {};
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
    return allHikes.length > 0 ? allHikes : null;
  }, [scheduleStore, trails, maxHikes, hikeDays]);
}
