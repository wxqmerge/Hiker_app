
import { useState, memo, useMemo, useCallback } from 'react';
import { generateTrailHtml, copyToClipboard } from '../utils/report';
import { useToast } from '../hooks/useToast';
import { useGpxActions } from '../hooks/useGpxActions';
import { getTrailName, getTrailDetailsById, getAvailableMonthsFromSeasonal } from '../utils/data';
import { getNoaaTideUrl } from '../utils/url.js';
import { openHtmlInNewTab } from '../utils/io';
import { MONTH_ABBR, DIFFICULTY_COLORS } from '../utils/constants';
import { useTrailDetails } from '../hooks/useTrailDetails';
import { useTooltips } from '../hooks/useTooltips';
import { getSeasonalInfo, calculateMonthlyScore } from '../utils/score.js';
import TrailStats from './shared/TrailStats';
import TrailActionButtons from './shared/TrailActionButtons';
import LeaderEdit from './LeaderEdit';

const TrailCard = memo(function TrailCard({ trail, isActive = false, selectedMonths, leader, weather, onLeaderChange, hikeDate }) {
  const showToast = useToast();
  const [nameCopied, setNameCopied] = useState(false);
  const [showLeaderEdit, setShowLeaderEdit] = useState(false);
  const { handleGpxDownload, handleTrailhead } = useGpxActions(trail);
  const trailDetails = useTrailDetails();
  const { title: tt } = useTooltips();

  const handleLeaderClick = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    if (onLeaderChange) setShowLeaderEdit(true);
  }, [onLeaderChange]);

  const handleCopy = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();

    const detailsForTrail = getTrailDetailsById(trailDetails, trail.id);
    const html = generateTrailHtml(trail, detailsForTrail, hikeDate);
    openHtmlInNewTab(html);
  }, [trail, trailDetails, hikeDate]);

  const handleCopyName = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const name = getTrailName(trail);
    await copyToClipboard(name, setNameCopied, showToast);
  }, [trail, showToast]);

  const popScore = useMemo(() => {
    const detailsForTrail = getTrailDetailsById(trailDetails, trail.id);
    const monthly = detailsForTrail?.[trail.id]?.popularity?.monthly || [];
    if (monthly.length === 0) return null;
    const trailSeasonal = trail?.seasonal || {};
    const { hasQuarterData } = getSeasonalInfo(trailSeasonal);
    const availableMonths = getAvailableMonthsFromSeasonal(trail.seasonal || {});
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
          href={`${import.meta.env.BASE_URL}trail/${trail.id}`}
          className="block p-4"
          title={tt('Open trail details')}
          target="_blank"
          rel="noopener noreferrer"
        >
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-gray-900">{getTrailName(trail)}</h3>
                  <button
                onClick={handleCopyName}
                className="text-gray-400 hover:text-green-700 flex-shrink-0"
                title={tt('Copy trail name')}
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
              <div className="flex flex-col gap-1">
                {weather && (
                  <>
                    <a
                      href={trail.trailHeadLat != null && trail.trailHeadLon != null ? `https://forecast.weather.gov/MapClick.php?lon=${trail.trailHeadLon}&lat=${trail.trailHeadLat}` : undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center gap-1 ${weather.rain >= 40 ? 'text-blue-500' : 'text-gray-700'} hover:text-blue-600`}
                      title={weather.temp != null ? `Forecast: ${weather.temp}°F, ${weather.rain}% rain — open weather` : undefined}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004-4h1a4 4 0 003.77-5.53A6 6 0 0018 11h1a4 4 0 004-4" />
                      </svg>
                      <span>
                        {weather.temp != null && `${weather.temp}°`}
                        {weather.rain >= 1 && ` · ${weather.rain}%`}
                      </span>
                    </a>
                    {weather.tide != null && (
                      <a
                        className="flex items-center gap-1 text-gray-700 hover:text-blue-600"
                        href={getNoaaTideUrl(trail.tideStationId, hikeDate)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`Low tide ${weather.tideTime}: ${weather.tide} ft — view NOAA predictions`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15c2-1 4-1 6 0s4 1 6 0 4-1 6 0" />
                        </svg>
                        <span>{weather.tideTime} · {weather.tide} ft</span>
                      </a>
                    )}
                  </>
                )}
               {leader && !onLeaderChange ? (
                 <div className="flex items-center gap-1 text-gray-700">
                   <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                   </svg>
                   <span className="truncate" title={leader}>{leader}</span>
                 </div>
               ) : null}
             </div>
           </div>
        </a>

        {/* Leader change button - outside anchor to prevent navigation interference */}
        {leader && onLeaderChange && (
          <div className="px-4 py-1">
            {showLeaderEdit ? (
              <LeaderEdit
                initialLeader={leader}
                tt={tt}
                onSave={(newLeader) => {
                  onLeaderChange(newLeader);
                  setShowLeaderEdit(false);
                }}
                onCancel={() => setShowLeaderEdit(false)}
              />
            ) : (
              <button
                type="button"
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 cursor-pointer"
                title="Change hike leader"
                onClick={handleLeaderClick}
              >
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span>Leader: {leader}</span>
              </button>
            )}
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
                      title={tt('Open trail report')}
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
