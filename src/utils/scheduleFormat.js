import { MONTH_NAMES, MONTH_ABBR_TO_FULL, MONTH_FULL_TO_ABBR } from './constants';

function emptyEntry() {
  return { trail_id: null, early_start: false, leader: '' };
}

function normalizeEntry(entry) {
  if (typeof entry === 'string') {
    return { trail_id: entry || null, early_start: false, leader: '' };
  }
  if (entry && typeof entry === 'object') {
    return {
      trail_id: entry.trail_id || null,
      early_start: !!entry.early_start,
      leader: entry.leader || '',
    };
  }
  return emptyEntry();
}

export function normalizeDayEntries(value) {
  if (Array.isArray(value)) {
    return value.map(entry => normalizeEntry(entry));
  }
  if (value == null || value === '') {
    return [];
  }
  return [normalizeEntry(value)];
}

export function getDayEntries(monthData, day) {
  if (!monthData) return [];
  return normalizeDayEntries(monthData[String(day)]);
}

export function setDayEntry(monthData, day, slot, entry) {
  const dayKey = String(day);
  const existing = monthData?.[dayKey];
  const entries = Array.isArray(existing)
    ? existing.map(item => (item ? normalizeEntry(item) : emptyEntry()))
    : [existing ? normalizeEntry(existing) : emptyEntry()];
  while (entries.length < slot) {
    entries.push(emptyEntry());
  }
  entries[slot] = normalizeEntry(entry);
  return { ...(monthData || {}), [dayKey]: entries };
}

export function clearDayEntry(monthData, day, slot) {
  return setDayEntry(monthData, day, slot, emptyEntry());
}

export function normalizeServerMonthEntries(entries) {
  const result = [];
  if (Array.isArray(entries)) {
    for (const entry of entries) {
      const day = Number(entry?.day);
      if (!Number.isFinite(day) || day <= 0 || day > 31) continue;
      const slot = entry?.slot ?? 0;
      result.push({ day, slot, ...normalizeEntry(entry) });
    }
  } else if (entries && typeof entries === 'object') {
    for (const [key, value] of Object.entries(entries)) {
      const day = parseInt(key, 10);
      if (!Number.isFinite(day) || day <= 0 || day > 31) continue;
      const dayEntries = normalizeDayEntries(value);
      dayEntries.forEach((entry, slot) => {
        result.push({ day, slot, ...entry });
      });
    }
  }
  return result;
}

export function serverScheduleToStore(serverData) {
  const store = {};
  if (!serverData) return store;
  for (const [key, entries] of Object.entries(serverData)) {
    const fullName = MONTH_ABBR_TO_FULL[key] || (MONTH_NAMES.includes(key) ? key : null);
    if (!fullName) continue;
    store[fullName] = {};
    for (const entry of normalizeServerMonthEntries(entries)) {
      const dayKey = String(entry.day);
      if (!store[fullName][dayKey]) store[fullName][dayKey] = [];
      const dayEntries = store[fullName][dayKey];
      while (dayEntries.length < entry.slot) {
        dayEntries.push(emptyEntry());
      }
      dayEntries[entry.slot] = {
        trail_id: entry.trail_id,
        early_start: entry.early_start,
        leader: entry.leader,
      };
    }
  }
  return store;
}

export function storeToServerSchedule(store) {
  const serverData = {};
  for (const [fullName, days] of Object.entries(store)) {
    const abbr = MONTH_FULL_TO_ABBR[fullName];
    if (!abbr || !days || typeof days !== 'object') continue;
    serverData[abbr] = [];
    for (const [day, entries] of Object.entries(days)) {
      const entryList = normalizeDayEntries(entries);
      entryList.forEach((entry, slot) => {
        if (entry?.trail_id) {
          const dayNum = parseInt(day, 10);
          if (!isNaN(dayNum) && dayNum > 0) {
            serverData[abbr].push({ day: dayNum, slot, trail_id: entry.trail_id, early_start: !!entry.early_start, leader: entry.leader || '' });
          }
        }
      });
    }
    serverData[abbr].sort((a, b) => a.day - b.day || a.slot - b.slot);
  }
  return serverData;
}
