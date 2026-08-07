
import { useState, memo, useMemo, useCallback } from 'react';
import { generateTrailHtml, copyToClipboard } from '../utils/report';
import { useToast } from '../hooks/useToast';
import { useGpxActions } from '../hooks/useGpxActions';
import { getTrailName, getTrailDetailsById, getScoredMonths } from '../utils/data';
import { MONTH_ABBR, DIFFICULTY_COLORS } from '../utils/constants';
import { useTrailDetails } from '../hooks/useTrailDetails';
import { useTooltips } from '../hooks/useTooltips';
import { getSeasonalInfo, calculateMonthlyScore } from '../utils/score.js';
import TrailStats from './shared/TrailStats';
import TrailActionButtons from './shared/TrailActionButtons';

const TrailCard = memo(function TrailCard({ trail, isActive = false, selectedMonths, leader, weather, onLeaderChange, hikeDate }) {
  const showToast = useToast();
  const [nameCopied, setNameCopied] = useState(false);
  const { handleGpxDownload, handleTrailhead } = useGpxActions(trail, showToast);
  const trailDetails = useTrailDetails();
  const { title: tt } = useTooltips();

  const handleLeaderClick = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    if (onLeaderChange) onLeaderChange();
  }, [onLeaderChange]);

  const handleCopy = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();

    const detailsForTrail = getTrailDetailsById(trailDetails, trail.id);
    const html = generateTrailHtml(trail, detailsForTrail, hikeDate);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [trail, trailDetails, hikeDate]);

  const handleCopyName = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const name = getTrailName(trail);
    await copyToClipboard(name, setNameCopied, showToast);
  }, [trail, showToast]);

  const seasonal = trail.seasonal || {};
  const bestSeason = seasonal.bestSeason || '';
  const scoreMonths = getScoredMonths(seasonal);
  const availableMonthsStr = scoreMonths.length > 0 ? scoreMonths.join(', ') : 'Year-round';

  const popScore = useMemo(() => {
    const detailsForTrail = getTrailDetailsById(trailDetails, trail.id);
    const monthly = detailsForTrail?.[trail.id]?.popularity?.monthly || [];
    if (monthly.length === 0) return null;
    const trailSeasonal = trail?.seasonal || {};
    const { hasQuarterData } = getSeasonalInfo(trailSeasonal);
    const availableMonths = Object.entries(trail.seasonal || {})
      .filter(([k, v]) => typeof v === 'number' && v > 0 && MONTH_ABBR.indexOf(k) !== -1)
      .map(([k]) => MONTH_ABBR.indexOf(k) + 1);
    const allScores = monthly.map((hikeCount, idx) =>
      calculateMonthlyScore(hikeCount, idx, availableMonths, hasQuarterData)
    );
    if (selectedMonths && selectedMonths.length > 0) {
      return selectedMonths.reduce((sum, mIdx) => sum + (allScores[mIdx] || 0), 0);
    }
    return allScores.reduce((sum, s) => sum + s, 0);
  }, [trail, trailDetails, selectedMonths]);
  const hasPopScore = popScore != null && popScore > 0;

  return (
     <div className={`relative rounded-lg shadow-sm hover:shadow-md transition-all border-2 overflow-hidden ${
       isActive 
         ? 'border-green-500 ring-2 ring-green-200 bg-white' 
         : 'border-gray-100 bg-white'
     }`}>
        <a
          href={`/trail/${trail.id}`}
          className="block p-4"
          title={tt('View full trail details')}
          target="_blank"
          rel="noopener noreferrer"
        >
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-gray-900">{getTrailName(trail)}</h3>
              <button
                onClick={handleCopyName}
                className="text-gray-400 hover:text-green-700 flex-shrink-0"
                title={tt('Copy trail name to clipboard')}
              >
                {nameCopied ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                )}
              </button>
            </div>
           <span className={`px-2 py-1 rounded-full text-xs font-medium ${DIFFICULTY_COLORS[trail.difficulty] || 'bg-gray-100 text-gray-800'}`}>
             {trail.difficulty}
           </span>
         </div>
         
          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <TrailStats
              trail={trail}
              itemClassName="flex items-center gap-1 text-gray-700"
              rideFormat="cost"
            />
            {/* Leader or Seasonal Availability */}
            {leader ? (
              <div className="flex items-center gap-1 text-gray-700">
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="truncate" title={leader}>{leader}</span>
              </div>
            ) : scoreMonths.length > 0 ? (
              <div className="flex items-center gap-1 text-gray-700">
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="truncate" title={availableMonthsStr}>{availableMonthsStr}</span>
              </div>
            ) : bestSeason ? (
              <div className="flex items-center gap-1 text-gray-700">
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
                <span className="truncate">{bestSeason}</span>
              </div>
            ) : null}
          </div>
        </a>

        {/* Leader change button - outside anchor to prevent navigation interference */}
        {leader && onLeaderChange && (
          <div className="px-4 py-1">
            <button
              type="button"
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 cursor-pointer"
              title="Click to change leader"
              onClick={handleLeaderClick}
            >
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>Leader: {leader}</span>
            </button>
          </div>
        )}

          {/* Web Link / Tide / Search / GPX - outside Link to avoid nested anchors */}
          <div className="px-4 pb-2 flex items-center gap-2">
            <TrailActionButtons
              trail={trail}
              hikeDate={hikeDate}
              buttonClassName="flex items-center gap-1 text-blue-600 hover:text-blue-800"
              onGpxDownload={handleGpxDownload}
              onTrailhead={handleTrailhead}
            />
            {weather && (
              <span
                className={`text-xs font-medium ${weather.rain >= 40 ? 'text-blue-500' : 'text-gray-400'}`}
                title={`Forecast: ${weather.temp}°F, ${weather.rain}% rain`}
              >
                {weather.temp}°{weather.rain >= 1 && ` · ${weather.rain}%`}
              </span>
            )}
          </div>

      {/* Pop score indicator */}
      {hasPopScore && (
        <div
          className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-blue-400 flex items-center justify-center text-white text-xs font-semibold"
          title={`Popularity score: ${popScore}`}
        >
          {popScore}
        </div>
      )}

      {/* Report button bar */}
      <div className="bg-gray-50 px-4 py-2 border-t border-gray-100 flex items-center justify-between">
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 text-sm text-green-600 hover:text-green-800 font-medium"
          title={tt('Open trail report in new tab')}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          Report
        </button>
      </div>
    </div>
  );
});

export default TrailCard;
