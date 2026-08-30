import { DAY_NAMES } from '../utils/constants';
import { getTrailName } from '../utils/data';
import { getDayEntries, setDayEntry, clearDayEntry } from '../utils/scheduleFormat';
import { getMonthKey, createDate } from '../utils/dateUtils';

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
 * @param {Function} deps.updateScheduleFn - (monthKey, updater) => void|Promise
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
    const { sourceDay, sourceSlot, targetDay, targetSlot, targetEntry, trailId, earlyStart, leader: swapLeader } = pendingSwap;
    const monthKey = getMonthKey(year, selectedMonth);

    updateScheduleFn(monthKey, prev => {
      let next = prev;
      next = setDayEntry(next, targetDay, targetSlot, { trail_id: trailId, early_start: earlyStart, leader: swapLeader });
      if (sourceDay !== null && sourceDay !== undefined) {
        next = setDayEntry(next, sourceDay, sourceSlot, { trail_id: targetEntry.trail_id, early_start: targetEntry.early_start, leader: targetEntry.leader || '' });
      }
      return next;
    });
    setPendingSwap(null);
  };

  const cancelSwap = () => {
    setPendingSwap(null);
  };

  const performMove = (source, targetDay, targetSlot, duplicate = false) => {
    if (hasApiKey === false) return false;

    const { hikeIndex, sourceDay, sourceSlot, trailId: sourceTrailId, earlyStart: sourceEarlyStart, leader: sourceLeader } = source;
    const trailId = sourceTrailId || trailIndexToId[hikeIndex];

    if (!duplicate && sourceDay === targetDay && sourceSlot === targetSlot) return false;
    if (!trailId) return false;

    const monthKey = getMonthKey(year, selectedMonth);
    const monthData = scheduleStore[monthKey] || {};
    const targetEntries = getDayEntries(monthData, targetDay);
    const targetEntry = targetEntries[targetSlot] || { trail_id: null, early_start: false, leader: '' };
    const hasSource = sourceDay !== null && sourceDay !== undefined;
    const sourceEntries = hasSource ? getDayEntries(monthData, sourceDay) : [];
    const sourceEntry = sourceEntries[sourceSlot] || null;

    if (!duplicate && targetEntry && targetEntry.trail_id) {
      const sourceTrail = findTrailById(trailId);
      const targetTrail = findTrailById(targetEntry.trail_id);
      const sourceTrailName = sourceTrail ? getTrailName(sourceTrail) : trailId;
      const targetTrailName = targetTrail ? getTrailName(targetTrail) : targetEntry.trail_id;
      const sourceDayOfWeek = hasSource ? createDate(year, selectedMonth, sourceDay).getDay() : null;
      const targetDayOfWeek = createDate(year, selectedMonth, targetDay).getDay();
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
        sourceEntry,
        targetEntry,
        trailId,
        earlyStart: sourceEarlyStart !== undefined ? sourceEarlyStart : (hasSource ? sourceEntry?.early_start || false : false),
        leader: sourceLeader || (hasSource ? sourceEntry?.leader || '' : ''),
      });
      return true;
    }

    const earlyStart = sourceEarlyStart !== undefined ? sourceEarlyStart : (hasSource ? sourceEntry?.early_start || false : false);
    const leader = sourceLeader || (hasSource ? sourceEntry?.leader || '' : '');

    updateScheduleFn(monthKey, prev => {
      let next = prev;
      if (hasSource && !duplicate) {
        next = clearDayEntry(next, sourceDay, sourceSlot);
      }
      next = setDayEntry(next, targetDay, targetSlot, { trail_id: trailId, early_start: earlyStart, leader });
      return next;
    });
    return true;
  };

  const handleDropOnDate = (targetDay, targetSlot) => {
    if (!dragData) return;
    if (performMove(dragData, targetDay, targetSlot)) {
      setDragData(null);
    }
  };

  const moveHike = (source, targetDay, targetSlot) => {
    performMove(source, targetDay, targetSlot, source?.duplicate || false);
  };

  const handleDropOnAvailable = (sourceDay, sourceSlot) => {
    if (!dragData) return;
    if (hasApiKey === false) return;

    if (sourceDay === null || sourceDay === undefined) {
      setDragData(null);
      return;
    }

    updateScheduleFn(getMonthKey(year, selectedMonth), prev => clearDayEntry(prev, sourceDay, sourceSlot));
    setDragData(null);
  };

  const removeHike = (day, slotIdx) => {
    if (hasApiKey === false) return;
    updateScheduleFn(getMonthKey(year, selectedMonth), prev => clearDayEntry(prev, day, slotIdx));
  };

  return {
    confirmSwap,
    cancelSwap,
    handleDropOnDate,
    handleDropOnAvailable,
    removeHike,
    moveHike,
  };
}
