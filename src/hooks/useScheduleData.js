import { useState, useMemo, useCallback } from 'react';
import { findTrailById as findTrailByIdUtil } from '../utils/data';
import { getHikeSlotsForMonth, getMonthKey } from '../utils/dateUtils';
import { useHikeDays } from './useHikeDays';
import { normalizeDayEntries } from '../utils/scheduleFormat';

/**
 * Shared schedule data hook for ScheduleBuilder and Calendar pages.
 * Provides: assignedHikes, hikeDates, trailIndexToId, handleDragStart/End,
 * findTrailById, dragData.
 */
export function useScheduleData({ trails, scheduleStore, selectedMonth, year }) {
  const [dragData, setDragData] = useState(null);

  const assignedHikes = useMemo(() => {
    const monthKey = getMonthKey(year, selectedMonth);
    const raw = scheduleStore[monthKey] || {};
    const result = {};
    Object.entries(raw).forEach(([day, val]) => {
      result[day] = normalizeDayEntries(val);
    });
    return result;
  }, [scheduleStore, selectedMonth, year]);

  const hikeDays = useHikeDays();
  const hikeDates = useMemo(() => {
    return getHikeSlotsForMonth(year, selectedMonth, hikeDays);
  }, [selectedMonth, year, hikeDays]);

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
