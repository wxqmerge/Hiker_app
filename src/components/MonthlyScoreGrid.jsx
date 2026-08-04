import { useMemo } from 'react';
import { MONTH_ABBR } from '../utils/constants';
import { getSeasonalInfo, calculateMonthlyScore } from '../utils/score.js';
import MonthGrid from './MonthGrid';

// Render a grid of monthly score badges
// @param {Object} props
// @param {number[]} props.monthly - Array of 12 hike counts
// @param {number[]} props.availableMonths - 1-based month indices
// @param {Object} props.seasonal - Trail seasonal data
// @param {boolean} props.showBreakdown - Show quarterBase+monthBase+scheduleBase=score
// @param {string} props.titlePrefix - Prefix for title attribute
export default function MonthlyScoreGrid({ monthly, availableMonths = [], seasonal, showBreakdown = false, titlePrefix = '' }) {
  const { hasQuarterData } = getSeasonalInfo(seasonal || {});

  const scores = useMemo(() => {
    if (!monthly || monthly.length === 0) return [];
    const availSet = new Set(availableMonths);
    return monthly.map((hikeCount, idx) => {
      const score = calculateMonthlyScore(hikeCount, idx, availableMonths, hasQuarterData);
      const quarterBase = hasQuarterData ? 1 : 0;
      const monthBase = availSet.has(idx + 1) ? 1 : 0;
      const scheduleBase = Math.min(9, hikeCount * 2);
      return { hikeCount, score, quarterBase, monthBase, scheduleBase };
    });
  }, [monthly, availableMonths, hasQuarterData]);

  if (!monthly || monthly.length === 0) return null;

  return (
    <MonthGrid
      months={MONTH_ABBR}
      className="flex gap-1.5 flex-wrap"
      renderMonth={(month, idx) => {
        const { hikeCount, score, quarterBase, monthBase, scheduleBase } = scores[idx];
        const intensity = Math.min(score / 9, 1);
        const bg = score > 0 ? `rgba(34, 197, 94, ${0.15 + intensity * 0.7})` : 'bg-gray-100';
        const text = score > 0 ? 'text-green-800' : 'text-gray-400';

        const title = showBreakdown
          ? `${titlePrefix}${month}: ${quarterBase}+${monthBase}+${scheduleBase}=${score}`
          : `${titlePrefix}${month}: ${hikeCount} hikes -> score ${score}`;

        return (
          <div
            key={idx}
            className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center text-xs font-medium ${bg} ${text}`}
            title={title}
          >
            <span className="text-[9px] leading-none">{month.substring(0, 3)}</span>
            {score > 0 && <span className="text-sm leading-none mt-0.5 font-bold">{score}</span>}
          </div>
        );
      }}
    />
  );
}

// Render the score breakdown row (edit mode only)
// @param {Object} props
// @param {number[]} props.monthly - Array of 12 hike counts
// @param {number[]} props.availableMonths - 1-based month indices
// @param {Object} props.seasonal - Trail seasonal data
export function ScoreBreakdownRow({ monthly, availableMonths = [], seasonal }) {
  const { hasQuarterData } = getSeasonalInfo(seasonal || {});

  const scores = useMemo(() => {
    if (!monthly || monthly.length === 0) return [];
    return monthly.map((hikeCount, idx) => {
      const score = calculateMonthlyScore(hikeCount, idx, availableMonths, hasQuarterData);
      const quarterBase = hasQuarterData ? 1 : 0;
      const monthBase = availableMonths.includes(idx + 1) ? 1 : 0;
      const scheduleBase = Math.min(9, hikeCount * 2);
      return { score, quarterBase, monthBase, scheduleBase };
    });
  }, [monthly, availableMonths, hasQuarterData]);

  if (!monthly || monthly.length === 0) return null;

  return (
    <MonthGrid
      months={MONTH_ABBR}
      renderMonth={(month, idx) => {
        const { score, quarterBase, monthBase, scheduleBase } = scores[idx];
        return (
          <div key={idx} className="flex flex-col items-center min-w-[40px]">
            <span className="text-[9px] text-gray-400 leading-tight">
              {quarterBase}+{monthBase}+{scheduleBase}={score}
            </span>
          </div>
        );
      }}
    />
  );
}
