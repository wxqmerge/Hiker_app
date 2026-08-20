import { useMemo } from 'react';
import { MONTH_NAMES } from '../utils/constants';
import { getHikeDays } from '../utils/config';
import { getHikeSlotsForMonth } from '../utils/dateUtils';
import { normalizeDayEntries } from '../utils/scheduleFormat';

export function useMonthSlotStats({ trails, scheduleStore, year }) {
  return useMemo(() => {
    const hikeDays = getHikeDays();
    const trailIdSet = new Set(trails.map(t => t.id));
    const stats = {};
    MONTH_NAMES.forEach((name, idx) => {
      const total = getHikeSlotsForMonth(year, idx, hikeDays).length;
      let filled = 0;
      const monthData = scheduleStore[name] || {};
      Object.values(monthData).forEach(val => {
        const entries = normalizeDayEntries(val);
        filled += entries.filter(e => e?.trail_id && trailIdSet.has(e.trail_id)).length;
      });
      stats[idx] = { total, filled };
    });
    return stats;
  }, [scheduleStore, year, trails]);
}
