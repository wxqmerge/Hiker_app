/**
 * Get the number of days in a specific month.
 * @param {number} year 
 * @param {number} month - 0-indexed (0=Jan, 11=Dec)
 * @returns {number}
 */
export function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Create a Date object for a specific day, normalized to midnight.
 * @param {number} year 
 * @param {number} month - 0-indexed (0=Jan, 11=Dec)
 * @param {number} day 
 * @returns {Date}
 */
export function createDate(year, month, day) {
  const date = new Date(year, month, day);
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * Format a date as YYYY-MM-DD.
 * @param {Date} [date] - Defaults to now.
 * @returns {string}
 */
export function formatDateToISO(date = new Date()) {
  return date.toISOString().slice(0, 10);
}
