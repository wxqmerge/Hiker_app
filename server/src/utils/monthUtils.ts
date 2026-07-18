export const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;

const FULL_TO_ABBR: Record<string, string> = Object.fromEntries(MONTH_FULL.map((f, i) => [f, MONTH_ABBR[i]]));
const ABBR_SET = new Set(MONTH_ABBR);

export function isMonthAbbr(key: string): boolean {
  return ABBR_SET.has(key);
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
