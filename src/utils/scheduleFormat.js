import { MONTH_NAMES, MONTH_ABBR_TO_FULL, MONTH_FULL_TO_ABBR } from './constants';

// Convert server schedule format to client store format
export function serverScheduleToStore(serverData) {
  const store = {};
  if (!serverData) return store;
  for (const [key, entries] of Object.entries(serverData)) {
    const fullName = MONTH_ABBR_TO_FULL[key] || (MONTH_NAMES.includes(key) ? key : null);
    if (!fullName) continue;
    store[fullName] = {};
    if (Array.isArray(entries)) {
      for (const entry of entries) {
        const day = String(entry.day);
        if (day === 'NaN' || day === 'null' || day === 'undefined') continue;
        store[fullName][day] = { trail_id: entry.trail_id || null, hike: entry.hike || null, early_start: !!entry.early_start, leader: entry.leader || '' };
      }
    } else if (entries && typeof entries === 'object') {
      Object.assign(store[fullName], entries);
    }
  }
  return store;
}

// Convert client store format back to server format
export function storeToServerSchedule(store) {
  const serverData = {};
  for (const [fullName, days] of Object.entries(store)) {
    const abbr = MONTH_FULL_TO_ABBR[fullName];
    if (!abbr || !days || typeof days !== 'object') continue;
    serverData[abbr] = [];
    for (const [day, entry] of Object.entries(days)) {
      if (entry?.trail_id) {
        const dayNum = parseInt(day, 10);
        if (!isNaN(dayNum) && dayNum > 0) {
          serverData[abbr].push({ day: dayNum, hike: entry.hike || '', trail_id: entry.trail_id, early_start: !!entry.early_start, leader: entry.leader || '' });
        }
      }
    }
    serverData[abbr].sort((a, b) => a.day - b.day);
  }
  return serverData;
}
