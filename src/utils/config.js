let groupConfig = {
  name: null,
  hikeDays: null,
  maxHikesPerDay: 3
};

let configVersion = 0;
const configSubscribers = new Set();

export function getConfigVersion() {
  return configVersion;
}

export function subscribeConfigChange(listener) {
  configSubscribers.add(listener);
  return () => {
    configSubscribers.delete(listener);
  };
}

function notifyConfigChange() {
  configVersion += 1;
  configSubscribers.forEach(listener => listener());
}

export function setGroupConfig(config) {
  groupConfig = { ...groupConfig, ...config };
  notifyConfigChange();
}

/**
 * Get the configured group name for the client.
 * @returns {string|null}
 */
export function getGroupName() {
  return groupConfig.name;
}

const GROUP_URLS = {
  ramblers: 'https://mondayramblers.bravesites.com/hike-schedule-descriptions-',
  sothh: 'https://sites.google.com/view/overthehillhikers/hike-descriptions_1',
};

/**
 * Get the schedule descriptions URL for the current group.
 * @returns {string|null}
 */
export function getGroupUrl() {
  const name = (groupConfig.name || '').toLowerCase();
  return GROUP_URLS[name] || null;
}

/**
 * Get the configured hike days from environment variables.
 * @returns {number[]} Array of unique hike days.
 */
export function getHikeDays() {
  const daysStr = groupConfig.hikeDays;
  if (!daysStr) return [];
  return daysStr.split(',').map(d => parseInt(d.trim(), 10)).filter(d => !isNaN(d) && d >= 0 && d <= 6);
}

/**
 * Get the maximum number of hikes allowed per day (slot cap).
 * Defaults to 3 when not configured. Clamped to 1..7.
 * @returns {number}
 */
export function getMaxHikesPerDay() {
  const raw = Number(groupConfig.maxHikesPerDay);
  if (!Number.isFinite(raw) || raw < 1) return 3;
  return Math.min(7, Math.floor(raw));
}

/**
 * Get the number of hike slots configured for a given day-of-week,
 * capped at the per-day maximum.
 * @param {number} dow - Day of week (0-6).
 * @returns {number} Slot count (0 if the day is not a hike day).
 */
export function getHikesPerDow(dow) {
  const days = getHikeDays();
  const count = days.filter(d => d === dow).length;
  return Math.min(count, getMaxHikesPerDay());
}

/**
 * Get the slot indices (0-based) available for a given day-of-week.
 * @param {number} dow - Day of week (0-6).
 * @returns {number[]} e.g. [0, 1, 2] for a day with 3 hikes.
 */
export function getHikeSlotsForDow(dow) {
  return Array.from({ length: getHikesPerDow(dow) }, (_, i) => i);
}

/**
 * Get a human-readable label for the configured hike days.
 * @returns {string} Label like "Wed/Fri Dates" or "Monday A/Monday B".
 */
export function getHikeDaysLabel() {
  if (!groupConfig.hikeDays) return 'Loading...';
  const days = getHikeDays();

  if (days.length === 0) return 'No Hike Days';

  const maxPerDay = getMaxHikesPerDay();
  const counts = {};
  days.forEach(d => counts[d] = (counts[d] || 0) + 1);

  const uniqueDays = Object.keys(counts).map(Number).sort((a, b) => a - b);

  if (uniqueDays.length === 1) {
    const day = uniqueDays[0];
    const name = getDayName(day);
    const count = Math.min(counts[day], maxPerDay);
    if (count > 1) {
      return Array.from({ length: count }, (_, i) => `${name} ${slotLetter(i)}`).join(' / ');
    }
    return `${name} Dates`;
  }

  const labels = uniqueDays.map(d => {
    const name = getDayName(d);
    const count = Math.min(counts[d], maxPerDay);
    if (count > 1) {
      return Array.from({ length: count }, (_, i) => `${name} ${slotLetter(i)}`).join('/');
    }
    return name;
  }).join(' / ');

  return `${labels} Dates`;
}

  /**
   * Get the slot letter for a given slot index.
   * @param {number} slot - Slot index (0-based).
   * @returns {string} Single letter (0 -> 'A', 1 -> 'B', etc.)
   */
  export function slotLetter(slot) {
    return String.fromCharCode(65 + (slot || 0));
  }

  /**
   * Get the day label for a given day index.
   * @param {number} dow - Day of week (0-6).
   * @returns {string} Single character label (e.g., 3 -> 'W', 1 -> 'M').
   */
  export function getDayLabel(dow) {
   const labels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
   return labels[dow] || '';
 }
 
 /**
  * Get the full day name for a given day index.
  * @param {number} dow - Day of week (0-6).
  * @returns {string} Full day name (e.g., 3 -> 'Wednesday').
  */
 export function getDayName(dow) {
   const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
   return names[dow] || '';
 }
