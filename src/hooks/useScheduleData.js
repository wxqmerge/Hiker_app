import { useState, useMemo, useCallback } from 'react';
import { MONTH_NAMES } from '../utils/constants';
import { findTrailById as findTrailByIdUtil } from '../utils/data';
import { getHikeSlotsForMonth } from '../utils/dateUtils';
import { getHikeDays } from '../utils/config';
import { normalizeDayEntries } from '../utils/scheduleFormat';

/**
 * Shared schedule data hook for ScheduleBuilder and Calendar pages.
 * Provides: assignedHikes, hikeDates, trailIndexToId, handleDragStart/End,
 * findTrailById, dragData.
 */
export function useScheduleData({ trails, scheduleStore, selectedMonth, year }) {
  const [dragData, setDragData] = useState(null);

  const assignedHikes = useMemo(() => {
    const raw = scheduleStore[MONTH_NAMES[selectedMonth]] || {};
    const result = {};
    Object.entries(raw).forEach(([day, val]) => {
      result[day] = normalizeDayEntries(val);
    });
    return result;
  }, [scheduleStore, selectedMonth]);

    const hikeDates = useMemo(() => {
    const hikeDays = getHikeDays();
    return getHikeSlotsForMonth(year, selectedMonth, hikeDays);
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
    hikeDates,
    findTrailById,
    trailIndexToId,
    dragData,
    setDragData,
    handleDragStart,
    handleDragEnd,
  };
}
