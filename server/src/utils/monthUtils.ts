export const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;

const YEAR_MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isYearMonthKey(key: string): boolean {
  return YEAR_MONTH_KEY.test(key);
}

export function resolveScheduleMonthKey(key: string, defaultYear: number = new Date().getFullYear()): string | null {
  if (typeof key !== 'string') return null;
  const trimmed = key.trim();
  if (YEAR_MONTH_KEY.test(trimmed)) return trimmed;
  const lower = trimmed.toLowerCase();
  const abbrIdx = MONTH_ABBR.findIndex(m => m.toLowerCase() === lower);
  if (abbrIdx >= 0) return `${defaultYear}-${String(abbrIdx + 1).padStart(2, '0')}`;
  const fullIdx = MONTH_FULL.findIndex(m => m.toLowerCase() === lower);
  if (fullIdx >= 0) return `${defaultYear}-${String(fullIdx + 1).padStart(2, '0')}`;
  return null;
}
