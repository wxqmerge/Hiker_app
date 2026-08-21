import { CURRENT_YEAR } from './constants';

/**
 * Milliseconds in one day.
 */
export const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

/**
 * Get today's date at midnight, advancing to tomorrow if past noon.
 * Used for "next hike" calculations so afternoon users see tomorrow's hike.
 * @param {Date} [now] - Current time (defaults to new Date()).
 * @returns {Date}
 */
export function getTodayHikeRef(now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (now.getHours() >= 12) today.setDate(today.getDate() + 1);
  return today;
}

/**
 * Get all days in a month that are hike days (based on config).
 * @param {number} year
 * @param {number} month - 0-indexed
 * @param {number[]} hikeDays - Array of day-of-week numbers (0-6).
 * @returns {number[]} Array of day numbers (1-based).
 */
export function getHikeDaysForMonth(year, month, hikeDays) {
  const daysInMonth = getDaysInMonth(year, month);
  const hikeDates = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const date = createDate(year, month, day);
    if (hikeDays.includes(date.getDay())) hikeDates.push(day);
  }
  return hikeDates;
}

/**
 * Get hike dates with slot info for a month.
 * Returns [{ day, slot }] accounting for multiple hikes per dow.
 * @param {number} year
 * @param {number} month - 0-indexed
 * @param {number[]} hikeDays - Array of day-of-week numbers (0-6).
 * @returns {{day: number, slot: number}[]}
 */
export function getHikeSlotsForMonth(year, month, hikeDays) {
  const daysInMonth = getDaysInMonth(year, month);
  const dates = [];
  const hikesPerDow = {};
  hikeDays.forEach(d => { hikesPerDow[d] = (hikesPerDow[d] || 0) + 1; });
  for (let day = 1; day <= daysInMonth; day++) {
    const date = createDate(year, month, day);
    const dayOfWeek = date.getDay();
    const hikesForThisDow = hikesPerDow[dayOfWeek] || 0;
    for (let s = 0; s < hikesForThisDow; s++) {
      dates.push({ day, slot: s });
    }
  }
  return dates;
}

export function getMonthKey(year, month) {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

export function parseMonthKey(monthKey) {
  const [year, month] = String(monthKey).split('-').map(Number);
  return { year, month: month - 1 };
}

export function getMonthRange() {
  const startYear = CURRENT_YEAR - 1;
  const months = [];
  for (let year = startYear; year <= startYear + 2; year += 1) {
    for (let month = 0; month < 12; month += 1) {
      months.push({ year, month, key: getMonthKey(year, month) });
    }
  }
  return months;
}
