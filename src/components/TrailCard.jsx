
import { useState, memo, useMemo, useCallback } from 'react';
import { generateTrailHtml, copyToClipboard } from '../utils/report';
import { useToast } from '../hooks/useToast';
import { useGpxActions } from '../hooks/useGpxActions';
import { getTrailName, getTrailDetailsById, getAvailableMonthsFromSeasonal } from '../utils/data';
import { getNoaaTideUrl } from '../utils/url.js';
import { openHtmlInNewTab, hasValidCoords } from '../utils/io';
import { DIFFICULTY_COLORS } from '../utils/constants';
import { useTrailDetails } from '../hooks/useTrailDetails';
import { useTooltips } from '../hooks/useTooltips';
import { getSeasonalInfo, sumMonthlyScores } from '../utils/score.js';
import TrailStats from './shared/TrailStats';
import TrailActionButtons from './shared/TrailActionButtons';
import LeaderEdit from './LeaderEdit';
import { Icon } from './ui';

const TrailCard = memo(function TrailCard({ trail, isActive = false, selectedMonths, leader, weather, onLeaderChange, hikeDate, earlyStart }) {
  const showToast = useToast();
  const [nameCopied, setNameCopied] = useState(false);
  const [showLeaderEdit, setShowLeaderEdit] = useState(false);
  const { handleGpxDownload, handleTrailhead } = useGpxActions(trail);
  const trailDetails = useTrailDetails();
  const { title: tt } = useTooltips();
  const trailName = getTrailName(trail);

  // Calculate ETC if we have duration and range
  const etc = useMemo(() => {
    if (!trail.durationMinutes || !trail.range) return null;
    const startHour = 8;
    const startMinute = 30;
    let startMinutes = startHour * 60 + startMinute;
    
    // Apply early start adjustment - always 8am
    if (earlyStart) {
      startMinutes = 8 * 60; // 8:00am
    }
    
    const travelTime = parseInt(trail.range, 10) || 0;
    const hikeDuration = trail.durationMinutes;
    const totalMinutes = startMinutes + hikeDuration + (travelTime * 2);
    
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return `${hours}:${minutes.toString().padStart(2, '0')}`;
  }, [trail.durationMinutes, trail.range, earlyStart]);

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

  const trailDetailHref = useMemo(() => {
    const base = `${import.meta.env.BASE_URL}trail/${trail.id}`;
    if (!hikeDate) return base;
    const d = hikeDate instanceof Date ? hikeDate : new Date(hikeDate);
    if (Number.isNaN(d.getTime())) return base;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${base}?date=${y}-${m}-${day}`;
  }, [trail.id, hikeDate]);

  const handleOpenDetails = useCallback(() => {
    window.open(trailDetailHref, '_blank', 'noopener,noreferrer');
  }, [trailDetailHref]);

  const popScore = useMemo(() => {
    const detailsForTrail = getTrailDetailsById(trailDetails, trail.id);
    const monthly = detailsForTrail?.[trail.id]?.popularity?.monthly || [];
    if (monthly.length === 0) return null;
    const trailSeasonal = trail?.seasonal || {};
    const { hasQuarterData } = getSeasonalInfo(trailSeasonal);
    const availableMonths = getAvailableMonthsFromSeasonal(trail.seasonal || {});
    return sumMonthlyScores(monthly, availableMonths, selectedMonths || [], hasQuarterData);
  }, [trail, trailDetails, selectedMonths]);
  const hasPopScore = popScore != null && popScore > 0;

  return (
     <div className={`relative rounded-lg shadow-sm hover:shadow-md transition-all border-2 overflow-hidden ${
       isActive 
         ? 'border-green-500 ring-2 ring-green-200 bg-white' 
         : 'border-gray-100 bg-white'
     }`}>
          <div
            className="p-4 cursor-pointer"
            onClick={handleOpenDetails}
            title={tt('Open trail details')}
          >
           <div className="flex justify-between items-start mb-2">
             <div className="flex items-center gap-2">
               <h3 className="text-lg font-bold text-gray-900">
                 <a
                   href={trailDetailHref}
                   className="hover:text-green-700"
                   title={tt('Open trail details')}
                   target="_blank"
                   rel="noopener noreferrer"
                   onClick={(e) => e.stopPropagation()}
                 >
                   {getTrailName(trail)}
                 </a>
               </h3>
                   <button
                onClick={handleCopyName}
                className="text-gray-400 hover:text-green-700 flex-shrink-0"
                title={tt('Copy trail name')}
                aria-label={nameCopied ? `${trailName} name copied` : `Copy ${trailName} name`}
              >
                {nameCopied ? (
                  <Icon path="M5 13l4 4L19 7" />
                ) : (
                  <Icon path="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                )}
              </button>
            </div>
           <span className={`px-2 py-1 rounded-full text-xs font-medium ${DIFFICULTY_COLORS[trail.difficulty] || 'bg-gray-100 text-gray-800'}`}>
             {trail.difficulty}
           </span>
         </div>
         
            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs overflow-x-auto">
              <TrailStats
                trail={trail}
                itemClassName="flex items-center gap-1 text-gray-700 whitespace-nowrap"
                rideFormat="cost"
              />
               <div className="flex flex-col gap-1 overflow-x-auto">
                 {weather && (
                  <>
                    <a
                      href={hasValidCoords(trail.trailHeadLat, trail.trailHeadLon) ? `https://forecast.weather.gov/MapClick.php?lon=${trail.trailHeadLon}&lat=${trail.trailHeadLat}` : undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center gap-1 ${weather.rain >= 40 ? 'text-blue-500' : 'text-gray-700'} hover:text-blue-600`}
                      title={weather.temp != null ? `Forecast: ${weather.temp}°F, ${weather.rain}% rain — open weather` : undefined}
                      aria-label={weather.temp != null ? `Forecast for ${trailName}: ${weather.temp}°F, ${weather.rain}% rain` : `Open weather for ${trailName}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Icon size="w-3.5 h-3.5" className="flex-shrink-0" path="M3 15a4 4 0 004-4h1a4 4 0 003.77-5.53A6 6 0 0018 11h1a4 4 0 004-4" />
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
                        aria-label={`Low tide for ${trailName} at ${weather.tideTime}: ${weather.tide} ft, view NOAA predictions`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Icon size="w-3.5 h-3.5" className="flex-shrink-0" path="M3 15c2-1 4-1 6 0s4 1 6 0 4-1 6 0" />
                        <span>{weather.tideTime} · {weather.tide} ft</span>
                      </a>
                    )}
                    {etc && (
                      <div className="flex items-center gap-1 text-gray-700">
                        <Icon size="w-3.5 h-3.5" className="flex-shrink-0" path="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        <span>ETC {etc}</span>
                      </div>
                    )}
                  </>
                )}
               {leader && !onLeaderChange ? (
                  <div className="flex items-center gap-1 text-gray-700">
                    <Icon size="w-3.5 h-3.5" className="flex-shrink-0" path="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    <span className="truncate" title={leader}>{leader}</span>
                  </div>
               ) : null}
             </div>
            </div>
          </div>

         {/* Leader change button - outside clickable area to prevent navigation interference */}
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
                aria-label={`Change leader for ${trailName}`}
                onClick={handleLeaderClick}
              >
                <Icon size="w-3.5 h-3.5" className="flex-shrink-0" path="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
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
                onGpxDownload={handleGpxDownload}
                onTrailhead={handleTrailhead}
              />
           </div>

      {/* Pop score indicator */}
      {hasPopScore && (
        <div
          className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-blue-400 flex items-center justify-center text-white text-xs font-semibold"
          title={`Popularity score: ${popScore}`}
          role="img"
          aria-label={`Popularity score: ${popScore}`}
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
          <Icon path="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          <span>Report</span>
        </button>
      </div>
    </div>
  );
});

export default TrailCard;
