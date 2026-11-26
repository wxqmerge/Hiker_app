import { CURRENT_YEAR } from '../utils/constants';
import { updateSchedule, getSchedule } from '../api/client';
import { setSchedule } from '../hooks/useTrailStore';
import { storeToServerSchedule, getDayEntries, setDayEntry } from '../utils/scheduleFormat';
import { getMonthKey } from '../utils/dateUtils';
import { showToast } from '../hooks/useToast';

export async function updateLeader(scheduleStore, selectedMonth, day, slotIdx, newLeader, year = CURRENT_YEAR) {
  const trimmed = (newLeader || '').trim();
  if (!trimmed.length) return false;
  const monthKey = getMonthKey(year, selectedMonth);

  const current = scheduleStore[monthKey] || {};
  const existingEntry = getDayEntries(current, day)[slotIdx] || { trail_id: null, early_start: false, leader: '' };
  const updated = setDayEntry(current, day, slotIdx, { ...existingEntry, leader: trimmed });
  const newStore = { ...scheduleStore, [monthKey]: updated };
  const serverData = storeToServerSchedule(newStore);
  try {
    await updateSchedule(serverData);
    setSchedule(serverData);
    return true;
  } catch (error) {
    if (error.status === 412) {
      // Someone else saved since our snapshot (or our ETag went stale). The
      // rejected save still only changes ONE field, so heal instead of
      // surfacing a false "save rejected": refetch the server schedule
      // (getSchedule adopts the fresh ETag), re-apply just the leader edit,
      // and save again.
      try {
        const fresh = await getSchedule();
        const entries = Array.isArray(fresh[monthKey]) ? [...fresh[monthKey]] : [];
        const idx = entries.findIndex(e => Number(e.day) === Number(day) && (Number(e.slot) || 0) === (Number(slotIdx) || 0));
        if (idx < 0) {
          showToast('That slot changed on the server - reload the schedule and set the leader again.', 'error');
          return false;
        }
        entries[idx] = { ...entries[idx], leader: trimmed };
        fresh[monthKey] = entries;
        await updateSchedule(fresh);
        setSchedule(fresh);
        return true;
      } catch (retryError) {
        console.error('[updateLeader] Retry after 412 failed:', retryError);
        showToast('Failed to save leader: ' + retryError.message, 'error');
        return false;
      }
    }
    console.error('[updateLeader] Failed to save leader:', error);
    showToast('Failed to save leader: ' + error.message, 'error');
    return false;
  }
}
