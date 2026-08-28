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
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Get today's date at midnight.
 * Used for "next hike" calculations.
 * @param {Date} [now] - Current time (defaults to new Date()).
 * @returns {Date}
 */
export function getTodayHikeRef(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * Count how many times each day-of-week appears in a hike-days list.
 * @param {number[]} hikeDays - Array of day-of-week numbers (0-6).
 * @returns {Object<number, number>} Map of dow -> occurrence count.
 */
export function countPerDow(hikeDays) {
  const counts = {};
  hikeDays.forEach(d => { counts[d] = (counts[d] || 0) + 1; });
  return counts;
}

/**
 * Get hike dates with slot info for a month.
 * Returns [{ day, slot }] accounting for multiple hikes per dow, capped at
 * `maxPerDay` slots per day-of-week (default 3).
 * @param {number} year
 * @param {number} month - 0-indexed
 * @param {number[]} hikeDays - Array of day-of-week numbers (0-6).
 * @param {number} [maxPerDay=3] - Maximum slots rendered per day-of-week.
 * @returns {{day: number, slot: number}[]}
 */
export function getHikeSlotsForMonth(year, month, hikeDays, maxPerDay = 3) {
  const daysInMonth = getDaysInMonth(year, month);
  const dates = [];
  const hikesPerDow = countPerDow(hikeDays);
  for (let day = 1; day <= daysInMonth; day++) {
    const date = createDate(year, month, day);
    const dayOfWeek = date.getDay();
    const hikesForThisDow = Math.min(hikesPerDow[dayOfWeek] || 0, maxPerDay);
    for (let s = 0; s < hikesForThisDow; s++) {
      dates.push({ day, slot: s });
    }
  }
  return dates;
}

/**
 * Get all days in a month that are hike days (based on config).
 * A day is a hike day if it has at least one slot, so this is derived from
 * getHikeSlotsForMonth (the slot cap never removes a day, only extra slots).
 * @param {number} year
 * @param {number} month - 0-indexed
 * @param {number[]} hikeDays - Array of day-of-week numbers (0-6).
 * @returns {number[]} Array of day numbers (1-based), sorted ascending.
 */
export function getHikeDaysForMonth(year, month, hikeDays) {
  const days = new Set();
  for (const { day } of getHikeSlotsForMonth(year, month, hikeDays)) {
    days.add(day);
  }
  return [...days].sort((a, b) => a - b);
}

export function getMonthKey(year, month) {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

export function parseMonthKey(monthKey) {
  const [year, month] = String(monthKey).split('-').map(Number);
  return { year, month: month - 1 };
}

/**
 * Format a date as YYYYMMDD (compact, no separators).
 * @param {Date} date
 * @returns {string}
 */
export function formatDateCompact(date) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
}

export function getMonthRange() {
  const now = new Date();
  const startYear = now.getFullYear() - 1;
  const startMonth = now.getMonth();
  const endYear = now.getFullYear() + 1;
  const endMonth = now.getMonth();
  const months = [];
  for (let year = startYear; year <= endYear; year += 1) {
    for (let month = 0; month < 12; month += 1) {
      if (year === startYear && month < startMonth) continue;
      if (year === endYear && month > endMonth) continue;
      months.push({ year, month, key: getMonthKey(year, month) });
    }
  }
  return months;
}
