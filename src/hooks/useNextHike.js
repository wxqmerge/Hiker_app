import { useMemo } from 'react';
import { MONTH_NAMES } from '../utils/constants';
import { findTrailById as findTrailByIdUtil } from '../utils/data';
import { serverScheduleToStore } from '../utils/scheduleFormat';

function findNextHikeInMonth(scheduleStore, trails, m, year) {
  const monthData = scheduleStore[MONTH_NAMES[m]] || {};
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (now.getHours() >= 12) {
    today.setDate(today.getDate() + 1);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, m, day);
    const dow = date.getDay();
    if ((dow === 3 || dow === 5) && date >= today) {
      const entry = monthData[day];
      if (entry?.trail_id) {
        const trail = findTrailByIdUtil(trails, entry.trail_id);
        if (trail) {
          return {
            day,
            monthIndex: m,
            date,
            trail,
            trailId: entry.trail_id,
            hikeName: entry.hike || trail.fullName || trail.name,
            leader: entry.leader || '',
            earlyStart: !!entry.early_start,
          };
        }
      }
    }
  }
  return null;
}

/**
 * Compute the next upcoming hike from schedule data.
 * Scans Wed/Fri dates chronologically starting from today.
 */
export function useNextHike({ trails, schedule, year = 2026 }) {
  const scheduleStore = useMemo(() => serverScheduleToStore(schedule), [schedule]);

  return useMemo(() => {
    for (let m = 0; m < 12; m++) {
      const result = findNextHikeInMonth(scheduleStore, trails, m, year);
      if (result) return result;
    }
    return null;
  }, [scheduleStore, trails, year]);
}
