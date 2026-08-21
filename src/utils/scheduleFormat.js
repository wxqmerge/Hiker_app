import { MONTH_NAMES, MONTH_ABBR, CURRENT_YEAR } from './constants';
import { getMonthKey } from './dateUtils';

const YEAR_MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;

export function resolveScheduleMonthKey(key, defaultYear = CURRENT_YEAR) {
  if (typeof key !== 'string') return null;
  const trimmed = key.trim();
  if (YEAR_MONTH_KEY.test(trimmed)) return trimmed;
  const lower = trimmed.toLowerCase();
  const abbrIndex = MONTH_ABBR.findIndex(abbr => abbr.toLowerCase() === lower);
  if (abbrIndex >= 0) return getMonthKey(defaultYear, abbrIndex);
  const fullIndex = MONTH_NAMES.findIndex(name => name.toLowerCase() === lower);
  if (fullIndex >= 0) return getMonthKey(defaultYear, fullIndex);
  return null;
}

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
    if (key.startsWith('_')) continue;
    const monthKey = resolveScheduleMonthKey(key);
    if (!monthKey) continue;
    store[monthKey] = store[monthKey] || {};
    for (const entry of normalizeServerMonthEntries(entries)) {
      const dayKey = String(entry.day);
      if (!store[monthKey][dayKey]) store[monthKey][dayKey] = [];
      const dayEntries = store[monthKey][dayKey];
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
  for (const [key, days] of Object.entries(store)) {
    const monthKey = resolveScheduleMonthKey(key);
    if (!monthKey || !days || typeof days !== 'object') continue;
    serverData[monthKey] = [];
    for (const [day, entries] of Object.entries(days)) {
      const entryList = normalizeDayEntries(entries);
      entryList.forEach((entry, slot) => {
        if (entry?.trail_id) {
          const dayNum = parseInt(day, 10);
          if (!isNaN(dayNum) && dayNum > 0) {
            serverData[monthKey].push({ day: dayNum, slot, trail_id: entry.trail_id, early_start: !!entry.early_start, leader: entry.leader || '' });
          }
        }
      });
    }
    serverData[monthKey].sort((a, b) => a.day - b.day || a.slot - b.slot);
  }
  return serverData;
}
