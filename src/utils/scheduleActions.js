import { MONTH_NAMES } from '../utils/constants';
import { updateSchedule, getSchedule } from '../api/client';
import { setSchedule } from '../hooks/useTrailStore';
import { serverScheduleToStore, storeToServerSchedule } from '../utils/scheduleFormat';
import { showToast } from '../hooks/useToast';

export async function updateLeader(scheduleStore, selectedMonth, day, slotIdx, newLeader) {
  const trimmed = (newLeader || '').trim();
  if (!trimmed.length) return false;
  const monthName = MONTH_NAMES[selectedMonth];

  let latestServer;
  try {
    latestServer = await getSchedule();
  } catch {
    latestServer = storeToServerSchedule(scheduleStore);
  }
  const store = serverScheduleToStore(latestServer);
  const current = store[monthName] || {};
  const updated = { ...current };
  const existing = updated[day];
  if (Array.isArray(existing)) {
    const updatedEntry = { ...existing[slotIdx], leader: trimmed };
    updated[day] = [...existing];
    updated[day][slotIdx] = updatedEntry;
  } else {
    updated[day] = [{ ...existing, leader: trimmed }];
  }
  const newStore = { ...store, [monthName]: updated };
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
