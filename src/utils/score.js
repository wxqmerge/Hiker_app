import { MONTH_ABBR } from './constants';

export function getSeasonalInfo(seasonal) {
  const seasonalKeys = Object.keys(seasonal || {}).filter(k => MONTH_ABBR.includes(k));
  const hasQuarterData = seasonalKeys.length > 0;
  return { seasonalKeys, hasQuarterData };
}

export function calculateMonthlyScore(hikeCount, monthIdx, availableMonths, hasQuarterData = false) {
  const quarterBase = hasQuarterData ? 1 : 0;
  let monthBase;
  if (hasQuarterData) {
    monthBase = 1;
  } else {
    monthBase = availableMonths.includes(monthIdx + 1) ? 1 : 0;
  }
  const scheduleBase = Math.min(9, (hikeCount || 0) * 2);
  return Math.min(9, quarterBase + monthBase + scheduleBase);
}

export function computeMonthlyScores(monthly, availableMonths, hasQuarterData = false) {
  return (Array.isArray(monthly) ? monthly : []).map((hikeCount, idx) =>
    calculateMonthlyScore(hikeCount, idx, availableMonths, hasQuarterData)
  );
}

export function sumMonthlyScores(monthly, availableMonths, selectedMonthIndices = [], hasQuarterData = false) {
  if (!Array.isArray(monthly)) return null;
  const allScores = computeMonthlyScores(monthly, availableMonths, hasQuarterData);
  if (selectedMonthIndices.length > 0) {
    return selectedMonthIndices.reduce((sum, mIdx) => sum + (allScores[mIdx] || 0), 0);
  }
  return allScores.reduce((sum, s) => sum + s, 0);
}
