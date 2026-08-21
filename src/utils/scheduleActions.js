import { CURRENT_YEAR } from '../utils/constants';
import { updateSchedule, getSchedule } from '../api/client';
import { setSchedule } from '../hooks/useTrailStore';
import { serverScheduleToStore, storeToServerSchedule, getDayEntries, setDayEntry } from '../utils/scheduleFormat';
import { getMonthKey } from '../utils/dateUtils';
import { showToast } from '../hooks/useToast';

export async function updateLeader(scheduleStore, selectedMonth, day, slotIdx, newLeader, year = CURRENT_YEAR) {
  const trimmed = (newLeader || '').trim();
  if (!trimmed.length) return false;
  const monthKey = getMonthKey(year, selectedMonth);

  let latestServer;
  try {
    latestServer = await getSchedule();
  } catch {
    latestServer = storeToServerSchedule(scheduleStore);
  }
  const store = serverScheduleToStore(latestServer);
  const current = store[monthKey] || {};
  const existingEntry = getDayEntries(current, day)[slotIdx] || { trail_id: null, early_start: false, leader: '' };
  const updated = setDayEntry(current, day, slotIdx, { ...existingEntry, leader: trimmed });
  const newStore = { ...store, [monthKey]: updated };
  const serverData = storeToServerSchedule(newStore);
  try {
    await updateSchedule(serverData);
    setSchedule(serverData);
    return true;
  } catch (error) {
    console.error('[updateLeader] Failed to save leader:', error);
    showToast('Failed to save leader: ' + error.message, 'error');
    return false;
  }
}
