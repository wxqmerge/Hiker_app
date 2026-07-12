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
    const { sourceDay, sourceSlot, targetDay, targetSlot, targetEntry, trailId, hikeName, earlyStart, leader: swapLeader } = pendingSwap;
    const monthName = MONTH_NAMES[selectedMonth];

    updateScheduleFn(monthName, prev => {
      const next = { ...prev };
      
      // Update target slot
      const targetEntries = Array.isArray(next[targetDay]) ? [...next[targetDay]] : [next[targetDay] || {}];
      targetEntries[targetSlot] = { trail_id: trailId, hike: hikeName || null, early_start: earlyStart, leader: swapLeader };
      next[targetDay] = targetEntries;

      if (sourceDay !== null && sourceDay !== undefined) {
        // Update source slot
        const sourceEntries = Array.isArray(next[sourceDay]) ? [...next[sourceDay]] : [next[sourceDay] || {}];
        sourceEntries[sourceSlot] = { trail_id: targetEntry.trail_id, hike: targetEntry.hike || null, early_start: targetEntry.early_start, leader: targetEntry.leader || '' };
        next[sourceDay] = sourceEntries;
      }
      return next;
    });
    setPendingSwap(null);
  };

  const cancelSwap = () => {
    setPendingSwap(null);
  };

  const handleDropOnDate = (targetDay, targetSlot) => {
    if (!dragData) return;
    if (hasApiKey === false) return;

    const { hikeIndex, sourceDay, sourceSlot, hikeName, trailId: dragTrailId, earlyStart: dragEarlyStart, leader: dragLeader } = dragData;
    const trailId = dragTrailId || trailIndexToId[hikeIndex];

    if (sourceDay === targetDay && sourceSlot === targetSlot) {
      setDragData(null);
      return;
    }

    if (!trailId) {
      setDragData(null);
      return;
    }

    const monthName = MONTH_NAMES[selectedMonth];
    const monthData = scheduleStore[monthName] || {};
    const targetEntries = Array.isArray(monthData[targetDay]) ? monthData[targetDay] : (monthData[targetDay] ? [monthData[targetDay]] : []);
    const targetEntry = targetEntries[targetSlot] || { trail_id: null };

    // Check if target slot already has a hike -- offer swap
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
        sourceSlot,
        targetDay,
        targetSlot,
        sourceEntry: sourceDay !== null && sourceDay !== undefined ? (Array.isArray(monthData[sourceDay]) ? monthData[sourceDay][sourceSlot] : monthData[sourceDay]) : null,
        targetEntry,
        trailId,
        hikeName,
        earlyStart: dragEarlyStart !== undefined ? dragEarlyStart : (sourceDay !== null && sourceDay !== undefined ? (Array.isArray(monthData[sourceDay]) ? monthData[sourceDay][sourceSlot]?.early_start : monthData[sourceDay]?.early_start) : false),
        leader: dragLeader || (sourceDay !== null && sourceDay !== undefined ? (Array.isArray(monthData[sourceDay]) ? monthData[sourceDay][sourceSlot]?.leader : monthData[sourceDay]?.leader) : ''),
      });
      setDragData(null);
      return;
    }

    // Normal drop on empty slot
    const earlyStart = dragEarlyStart !== undefined ? dragEarlyStart : ((sourceDay !== null && sourceDay !== undefined ? (Array.isArray(monthData[sourceDay]) ? monthData[sourceDay][sourceSlot] : monthData[sourceDay]) : null)?.early_start || false);
    const leader = dragLeader || (sourceDay !== null && sourceDay !== undefined ? (Array.isArray(monthData[sourceDay]) ? monthData[sourceDay][sourceSlot]?.leader : monthData[sourceDay]?.leader) : '');

    updateScheduleFn(monthName, prev => {
      const next = { ...prev };
      if (sourceDay !== null && sourceDay !== undefined) {
        const sourceEntries = Array.isArray(next[sourceDay]) ? [...next[sourceDay]] : [next[sourceDay] || {}];
        sourceEntries[sourceSlot] = { trail_id: null, hike: null, early_start: false, leader: '' };
        next[sourceDay] = sourceEntries;
      }
      const targetEntries = Array.isArray(next[targetDay]) ? [...next[targetDay]] : [next[targetDay] || {}];
      targetEntries[targetSlot] = { trail_id: trailId, hike: hikeName || null, early_start: earlyStart, leader: leader };
      next[targetDay] = targetEntries;
      return next;
    });
    setDragData(null);
  };

  const handleDropOnAvailable = (sourceDay, sourceSlot) => {
    if (!dragData) return;
    if (hasApiKey === false) return;

    if (sourceDay === null || sourceDay === undefined) {
      setDragData(null);
      return;
    }

    updateScheduleFn(MONTH_NAMES[selectedMonth], prev => {
      const next = { ...prev };
      const entries = Array.isArray(next[sourceDay]) ? [...next[sourceDay]] : [next[sourceDay] || {}];
      entries[sourceSlot] = { trail_id: null, hike: null, early_start: false, leader: '' };
      next[sourceDay] = entries;
      return next;
    });
    setDragData(null);
  };

  const removeHike = (day, slotIdx) => {
    if (hasApiKey === false) return;
    updateScheduleFn(MONTH_NAMES[selectedMonth], prev => {
      const next = { ...prev };
      const entries = Array.isArray(next[day]) ? [...next[day]] : [next[day] || {}];
      entries[slotIdx] = { trail_id: null, hike: null, early_start: false, leader: '' };
      next[day] = entries;
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
