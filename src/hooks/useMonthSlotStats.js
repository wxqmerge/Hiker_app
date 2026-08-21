import { useMemo } from 'react';
import { useHikeDays } from './useHikeDays';
import { getHikeSlotsForMonth, getMonthKey } from '../utils/dateUtils';
import { normalizeDayEntries } from '../utils/scheduleFormat';

export function useMonthSlotStats({ trails, scheduleStore, years = [] }) {
  const hikeDays = useHikeDays();
  return useMemo(() => {
    const trailIdSet = new Set(trails.map(t => t.id));
    const stats = {};
    years.forEach(year => {
      for (let idx = 0; idx < 12; idx += 1) {
        const total = getHikeSlotsForMonth(year, idx, hikeDays).length;
        let filled = 0;
        const monthData = scheduleStore[getMonthKey(year, idx)] || {};
        Object.values(monthData).forEach(val => {
          const entries = normalizeDayEntries(val);
          filled += entries.filter(e => e?.trail_id && trailIdSet.has(e.trail_id)).length;
        });
        stats[getMonthKey(year, idx)] = { total, filled };
      }
    });
    return stats;
  }, [scheduleStore, years, trails, hikeDays]);
}
