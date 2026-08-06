import { useMemo } from 'react';
import { MONTH_NAMES } from '../utils/constants';
import { getHikeDays } from '../utils/config';
import { getHikeDaysForMonth } from '../utils/dateUtils';
import { ensureArray } from '../utils/array';

export function useMonthSlotStats({ trails, scheduleStore, year }) {
  return useMemo(() => {
    const hikeDays = getHikeDays();
    const trailIdSet = new Set(trails.map(t => t.id));
    const stats = {};
    MONTH_NAMES.forEach((name, idx) => {
      const total = getHikeDaysForMonth(year, idx, hikeDays).length;
      let filled = 0;
      const monthData = scheduleStore[name] || {};
      Object.values(monthData).forEach(val => {
        const entries = ensureArray(val);
        filled += entries.filter(e => e?.trail_id && trailIdSet.has(e.trail_id)).length;
      });
      stats[idx] = { total, filled };
    });
    return stats;
  }, [scheduleStore, year, trails]);
}
