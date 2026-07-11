import { useState, useMemo, useCallback } from 'react';
import { MONTH_NAMES } from '../utils/constants';
import { findTrailById as findTrailByIdUtil } from '../utils/data';

/**
 * Shared schedule data hook for ScheduleBuilder and Calendar pages.
 * Provides: assignedHikes, wedFriDates, trailIndexToId, handleDragStart/End,
 * findTrailById, assignedCount, dragData.
 */
export function useScheduleData({ trails, scheduleStore, selectedMonth, year }) {
  const [dragData, setDragData] = useState(null);

  const assignedHikes = useMemo(() => {
    const raw = scheduleStore[MONTH_NAMES[selectedMonth]] || {};
    const result = {};
    Object.entries(raw).forEach(([day, val]) => {
      let entry;
      if (typeof val === 'string') {
        entry = { trail_id: val, hike: null, early_start: false };
      } else if (val && typeof val === 'object') {
        entry = { trail_id: typeof val.trail_id === 'string' ? val.trail_id : null, hike: val.hike || null, early_start: !!val.early_start };
      } else {
        entry = { trail_id: null, hike: null, early_start: false };
      }
      entry.leader = val?.leader || '';
      result[day] = entry;
    });
    return result;
  }, [scheduleStore, selectedMonth]);

  const assignedCount = useMemo(() => {
    return Object.values(assignedHikes).filter(v => v?.trail_id).length;
  }, [assignedHikes]);

  const wedFriDates = useMemo(() => {
    const daysInMonth = new Date(year, selectedMonth + 1, 0).getDate();
    const dates = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, selectedMonth, day);
      const dayOfWeek = date.getDay();
      if (dayOfWeek === 3 || dayOfWeek === 5) {
        dates.push(day);
      }
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

  const handleDragStart = useCallback((hikeIndex, sourceDay, hikeName, trailId, earlyStart, leader) => {
    setDragData({ hikeIndex, sourceDay, hikeName, trailId, earlyStart, leader });
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragData(null);
  }, []);

  return {
    assignedHikes,
    assignedCount,
    wedFriDates,
    findTrailById,
    trailIndexToId,
    dragData,
    setDragData,
    handleDragStart,
    handleDragEnd,
  };
}
