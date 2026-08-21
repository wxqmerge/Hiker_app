export const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;

const FULL_TO_ABBR: Record<string, string> = Object.fromEntries(MONTH_FULL.map((f, i) => [f, MONTH_ABBR[i]]));
const ABBR_SET = new Set(MONTH_ABBR);

export function isMonthAbbr(key: string): boolean {
  return ABBR_SET.has(key as (typeof MONTH_ABBR)[number]);
}

export function fullToAbbr(key: string): string | null {
  return FULL_TO_ABBR[key] || null;
}

export function normalizeMonthKey(key: string): string {
  const lower = key.toLowerCase();
  const fullIdx = MONTH_FULL.findIndex(m => m.toLowerCase() === lower);
  if (fullIdx >= 0) return MONTH_ABBR[fullIdx];
  const abbrIdx = MONTH_ABBR.findIndex(m => m.toLowerCase() === lower);
  if (abbrIdx >= 0) return MONTH_ABBR[abbrIdx];
  return key;
}

const YEAR_MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isYearMonthKey(key: string): boolean {
  return YEAR_MONTH_KEY.test(key);
}

export function resolveScheduleMonthKey(key: string, defaultYear: number = new Date().getFullYear()): string | null {
  if (isYearMonthKey(key)) return key;
  const lower = key.toLowerCase();
  const fullIdx = MONTH_FULL.findIndex(m => m.toLowerCase() === lower);
  if (fullIdx >= 0) return `${defaultYear}-${String(fullIdx + 1).padStart(2, '0')}`;
  const abbrIdx = MONTH_ABBR.findIndex(m => m.toLowerCase() === lower);
  if (abbrIdx >= 0) return `${defaultYear}-${String(abbrIdx + 1).padStart(2, '0')}`;
  return null;
}
