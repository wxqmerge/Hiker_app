import { useMemo } from 'react';
import { MONTH_NAMES } from '../utils/constants';
import { findTrailById as findTrailByIdUtil } from '../utils/data';
import { serverScheduleToStore } from '../utils/scheduleFormat';
import { getDaysInMonth, createDate } from '../utils/dateUtils';
import { getHikeDays } from '../utils/config';

function findNextHikesInMonth(scheduleStore, trails, m, year) {
  const monthData = scheduleStore[MONTH_NAMES[m]] || {};
  const daysInMonth = getDaysInMonth(year, m);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (now.getHours() >= 12) {
    today.setDate(today.getDate() + 1);
  }

  const hikeDays = getHikeDays();

  for (let day = 1; day <= daysInMonth; day++) {
    const date = createDate(year, m, day);
    const dow = date.getDay();
    if (hikeDays.includes(dow) && date >= today) {
      const entries = monthData[day] || [];
      const entryList = Array.isArray(entries) ? entries : (entries ? [entries] : []);
      
      const hikes = entryList.map(entry => {
        const trail = findTrailByIdUtil(trails, entry.trail_id);
        if (!trail) return null;
        return {
          day,
          monthIndex: m,
          date,
          trail,
          trailId: entry.trail_id,
          leader: entry.leader || '',
          earlyStart: !!entry.early_start,
        };
      }).filter(Boolean);

      if (hikes.length > 0) return hikes;
    }
  }
  return null;
}

/**
 * Compute the next upcoming hike(s) from schedule data.
 * Scans configured hike days chronologically starting from today.
 */
export function useNextHike({ trails, schedule, year = 2026 }) {

  const scheduleStore = useMemo(() => serverScheduleToStore(schedule), [schedule]);

  return useMemo(() => {
    for (let m = 0; m < 12; m++) {
      const result = findNextHikesInMonth(scheduleStore, trails, m, year);
      if (result) return result;
    }
    return null;
  }, [scheduleStore, trails, year]);
}
