import { MONTH_NAMES } from './constants';
 
let groupConfig = {
  name: null,
  hikeDays: null
};

export function setGroupConfig(config) {
  groupConfig = { ...groupConfig, ...config };
}

export function resetConfig() {
  groupConfig = { name: null, hikeDays: null };
}

/**
 * Get the configured group name for the client.
 * @returns {string|null}
 */
export function getGroupName() {
  return groupConfig.name;
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
 * Get a human-readable label for the configured hike days.
 * @returns {string} Label like "Wed/Fri Dates" or "Monday A/Monday B".
 */
export function getHikeDaysLabel() {
  if (!groupConfig.hikeDays) return 'Loading...';
  const days = getHikeDays();
  
  if (days.length === 0) return 'No Hike Days';

  const counts = {};
  days.forEach(d => counts[d] = (counts[d] || 0) + 1);
  
  const uniqueDays = Object.keys(counts).map(Number).sort((a, b) => a - b);
  
  if (uniqueDays.length === 1) {
    const day = uniqueDays[0];
    const name = getDayName(day);
    const count = counts[day];
    if (count > 1) {
      return Array.from({ length: count }, (_, i) => `${name} ${String.fromCharCode(65 + i)}`).join(' / ');
    }
    return `${name} Dates`;
  }

  const labels = uniqueDays.map(d => {
    const name = getDayName(d);
    const count = counts[d];
    if (count > 1) {
      return Array.from({ length: count }, (_, i) => `${name} ${String.fromCharCode(65 + i)}`).join('/');
    }
    return name;
  }).join(' / ');

  return `${labels} Dates`;
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
