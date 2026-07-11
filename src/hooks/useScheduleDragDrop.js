import { MONTH_NAMES, DAY_NAMES } from '../utils/constants';

/**
 * Shared drag-and-drop swap logic for ScheduleBuilder and Calendar.
 * @param {Object} deps
 * @param {Object} deps.scheduleStore
 * @param {number} deps.selectedMonth
 * @param {number} deps.year
 * @param {Object} deps.dragData
 * @param {Function} deps.setDragData
 * @param {Object} deps.pendingSwap
 * @param {Function} deps.setPendingSwap
 * @param {Function} deps.findTrailById
 * @param {Object} deps.trailIndexToId
 * @param {Function} deps.updateScheduleFn - (monthName, updater) => void|Promise
 * @param {boolean} [deps.hasApiKey] - If true, gates operations behind API key check
 */
export function useScheduleDragDrop({
  scheduleStore,
  selectedMonth,
  year,
  dragData,
  setDragData,
  pendingSwap,
  setPendingSwap,
  findTrailById,
  trailIndexToId,
  updateScheduleFn,
  hasApiKey,
}) {
  const confirmSwap = () => {
    if (!pendingSwap) return;
    const { sourceDay, targetDay, targetEntry, trailId, hikeName, earlyStart, leader: swapLeader } = pendingSwap;
    const monthName = MONTH_NAMES[selectedMonth];

    updateScheduleFn(monthName, prev => {
      const next = { ...prev };
      next[targetDay] = { trail_id: trailId, hike: hikeName || null, early_start: earlyStart, leader: swapLeader };
      if (sourceDay !== null && sourceDay !== undefined) {
        next[sourceDay] = { trail_id: targetEntry.trail_id, hike: targetEntry.hike || null, early_start: targetEntry.early_start, leader: targetEntry.leader || '' };
      }
      return next;
    });
    setPendingSwap(null);
  };

  const cancelSwap = () => {
    setPendingSwap(null);
  };

  const handleDropOnDate = (targetDay) => {
    if (!dragData) return;
    if (hasApiKey === false) return;

    const { hikeIndex, sourceDay, hikeName, trailId: dragTrailId, earlyStart: dragEarlyStart, leader: dragLeader } = dragData;
    const trailId = dragTrailId || trailIndexToId[hikeIndex];

    if (sourceDay === targetDay) {
      setDragData(null);
      return;
    }

    if (!trailId) {
      setDragData(null);
      return;
    }

    const monthName = MONTH_NAMES[selectedMonth];
    const monthData = scheduleStore[monthName] || {};
    const targetEntry = monthData[targetDay];

    // Check if target day already has a hike -- offer swap
    if (targetEntry && targetEntry.trail_id) {
      const sourceTrail = findTrailById(trailId);
      const targetTrail = findTrailById(targetEntry.trail_id);
      const sourceTrailName = sourceTrail ? (sourceTrail.fullName || sourceTrail.name) : hikeName || trailId;
      const targetTrailName = targetTrail ? (targetTrail.fullName || targetTrail.name) : targetEntry.hike || targetEntry.trail_id;
      const sourceDayOfWeek = sourceDay !== null && sourceDay !== undefined ? new Date(year, selectedMonth, sourceDay).getDay() : null;
      const targetDayOfWeek = new Date(year, selectedMonth, targetDay).getDay();
      const sourceDayLabel = sourceDayOfWeek !== null ? `${DAY_NAMES[sourceDayOfWeek]} ${sourceDay}` : 'Available Hikes';
      const targetDayLabel = `${DAY_NAMES[targetDayOfWeek]} ${targetDay}`;

      setPendingSwap({
        sourceTrailName,
        targetTrailName,
        sourceDayLabel,
        targetDayLabel,
        sourceDay,
        targetDay,
        sourceEntry: sourceDay !== null && sourceDay !== undefined ? monthData[sourceDay] : null,
        targetEntry,
        trailId,
        hikeName,
        earlyStart: dragEarlyStart !== undefined ? dragEarlyStart : (sourceDay !== null && sourceDay !== undefined ? monthData[sourceDay]?.early_start : false),
        leader: dragLeader || (sourceDay !== null && sourceDay !== undefined ? monthData[sourceDay]?.leader : ''),
      });
      setDragData(null);
      return;
    }

    // Normal drop on empty date
    const earlyStart = dragEarlyStart !== undefined ? dragEarlyStart : ((sourceDay !== null && sourceDay !== undefined ? monthData[sourceDay] : null)?.early_start || false);
    const leader = dragLeader || (sourceDay !== null && sourceDay !== undefined ? monthData[sourceDay]?.leader : '');

    updateScheduleFn(monthName, prev => {
      const next = { ...prev };
      if (sourceDay !== null && sourceDay !== undefined) {
        delete next[sourceDay];
      }
      next[targetDay] = { trail_id: trailId, hike: hikeName || null, early_start: earlyStart, leader: leader };
      return next;
    });
    setDragData(null);
  };

  const handleDropOnAvailable = () => {
    if (!dragData) return;
    if (hasApiKey === false) return;

    const { sourceDay } = dragData;
    if (sourceDay === null || sourceDay === undefined) {
      setDragData(null);
      return;
    }

    updateScheduleFn(MONTH_NAMES[selectedMonth], prev => {
      const next = { ...prev };
      delete next[sourceDay];
      return next;
    });
    setDragData(null);
  };

  const removeHike = (day) => {
    if (hasApiKey === false) return;
    updateScheduleFn(MONTH_NAMES[selectedMonth], prev => {
      const next = { ...prev };
      delete next[day];
      return next;
    });
  };

  return {
    confirmSwap,
    cancelSwap,
    handleDropOnDate,
    handleDropOnAvailable,
    removeHike,
  };
}
