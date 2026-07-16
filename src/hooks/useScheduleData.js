import { useState, useMemo, useCallback } from 'react';
import { MONTH_NAMES } from '../utils/constants';
import { findTrailById as findTrailByIdUtil } from '../utils/data';
import { getDaysInMonth, createDate } from '../utils/dateUtils';
import { getHikeDays } from '../utils/config';

/**
 * Shared schedule data hook for ScheduleBuilder and Calendar pages.
 * Provides: assignedHikes, hikeDates, trailIndexToId, handleDragStart/End,
 * findTrailById, assignedCount, dragData.
 */
export function useScheduleData({ trails, scheduleStore, selectedMonth, year }) {
  const [dragData, setDragData] = useState(null);

  const assignedHikes = useMemo(() => {
    const raw = scheduleStore[MONTH_NAMES[selectedMonth]] || {};
    const result = {};
    Object.entries(raw).forEach(([day, val]) => {
      const entries = Array.isArray(val) ? val : (val ? [val] : []);
      result[day] = entries.map(e => {
        const entry = typeof e === 'string'
          ? { trail_id: e, early_start: false, leader: '' }
          : {
              trail_id: typeof e?.trail_id === 'string' ? e.trail_id : null,
              early_start: !!e?.early_start,
              leader: e?.leader || '',
            };
        return entry;
      });
    });
    console.log('[useScheduleData] assignedHikes recomputed for', MONTH_NAMES[selectedMonth], 'day 17 leader:', result[17]?.[0]?.leader);
    return result;
  }, [scheduleStore, selectedMonth]);

  const assignedCount = useMemo(() => {
    return Object.values(assignedHikes).flat().filter(v => v?.trail_id).length;
  }, [assignedHikes]);

  const hikeDates = useMemo(() => {
    const daysInMonth = getDaysInMonth(year, selectedMonth);
    const dates = [];
    const hikeDays = getHikeDays();
    for (let day = 1; day <= daysInMonth; day++) {
      const date = createDate(year, selectedMonth, day);
      const dayOfWeek = date.getDay();
      
      // Find all occurrences of this day of week in the config
      hikeDays.forEach((configDay, index) => {
        if (configDay === dayOfWeek) {
          dates.push({ day, slot: index });
        }
      });
    }
    return dates;
  }, [selectedMonth, year]);

  const findTrailById = useCallback((trailId) => findTrailByIdUtil(trails, trailId), [trails]);

  const trailIndexToId = useMemo(() => {
    const map = {};
    trails.forEach((t, idx) => {
      map[idx + 1] = t.id;
    });
    return map;
  }, [trails]);

  const handleDragStart = useCallback((hikeIndex, sourceDay, sourceSlot, trailId, earlyStart, leader) => {
    setDragData({ hikeIndex, sourceDay, sourceSlot, trailId, earlyStart, leader });
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragData(null);
  }, []);

  return {
    assignedHikes,
    assignedCount,
    hikeDates,
    findTrailById,
    trailIndexToId,
    dragData,
    setDragData,
    handleDragStart,
    handleDragEnd,
  };
}
