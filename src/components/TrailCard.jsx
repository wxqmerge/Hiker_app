import { Link } from 'react-router-dom';
import { useState } from 'react';
import { generateReportText as genReport, copyToClipboard, getRideCost } from '../utils/report';
import { getFirstCoordinateFromGpx, openGoogleMapsTrailhead, openOrganicMaps, downloadBlob } from '../utils/io';
import { getGpx } from '../api/client';
import { useToast } from '../hooks/useToast';
import { getTrailDetailsById, getScoredMonths } from '../utils/data';
import { MONTH_ABBR, DIFFICULTY_COLORS } from '../utils/constants';
import { useTrailDetails } from '../hooks/useTrailDetails';
import { useTooltips } from '../hooks/useTooltips';
import { getSeasonalInfo, calculateMonthlyScore } from '../utils/score.js';
import { getGoogleAllTrailsSearchUrl } from '../utils/url.js';

export default function TrailCard({ trail, isActive = false, hikeName, selectedMonths }) {
  const showToast = useToast();
  const [copied, setCopied] = useState(false);
  const [nameCopied, setNameCopied] = useState(false);
  const [gpxDownloading, setGpxDownloading] = useState(false);
  const trailDetails = useTrailDetails();
  const { title: tt } = useTooltips();

  const handleCopy = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const detailsForTrail = getTrailDetailsById(trailDetails, trail.id);
    await copyToClipboard(genReport(trail, detailsForTrail), setCopied, showToast);
  };

  const handleCopyName = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const name = hikeName || trail.fullName || trail.name;
    await copyToClipboard(name, setNameCopied, showToast);
  };

  const rideCost = trail.range ? getRideCost(parseInt(trail.range, 10)) : null;
  const seasonal = trail.seasonal || {};
  const bestSeason = seasonal.bestSeason || '';
  const scoreMonths = getScoredMonths(seasonal);
  const availableMonthsStr = scoreMonths.length > 0 ? scoreMonths.join(', ') : 'Year-round';
  const detailsForTrail = getTrailDetailsById(trailDetails, trail.id);
  const monthly = detailsForTrail?.[trail.id]?.popularity?.monthly || [];
  const trailSeasonal = trail?.seasonal || {};
  const { hasQuarterData } = getSeasonalInfo(trailSeasonal);
  const availableMonths = Object.entries(seasonal)
    .filter(([k, v]) => typeof v === 'number' && v > 0 && MONTH_ABBR.indexOf(k) !== -1)
    .map(([k]) => MONTH_ABBR.indexOf(k) + 1);
  const popScore = monthly.length > 0
    ? (() => {
        const allScores = monthly.map((hikeCount, idx) =>
          calculateMonthlyScore(hikeCount, idx, availableMonths, hasQuarterData)
        );
        if (selectedMonths && selectedMonths.length > 0) {
          return selectedMonths.reduce((sum, mIdx) => sum + (allScores[mIdx] || 0), 0);
        }
        return allScores.reduce((sum, s) => sum + s, 0);
      })()
    : null;
  const hasPopScore = popScore != null && popScore > 0;

  return (
     <div className={`relative rounded-lg shadow-sm hover:shadow-md transition-all border-2 overflow-hidden ${
       isActive 
         ? 'border-green-500 ring-2 ring-green-200 bg-white' 
         : 'border-gray-100 bg-white'
     }`}>
       <Link 
         to={`/trail/${trail.id}`}
         className="block p-4"
         title={tt('View full trail details')}
       >
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-gray-900">{hikeName || trail.fullName || trail.name}</h3>
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
           {/* Distance */}
           <div className="flex items-center gap-1 text-gray-700">
             <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
             </svg>
             <span>
               {trail.distance?.toFixed(1) || 'N/A'} mi
               {trail.distanceExtended && ` / ${trail.distanceExtended.toFixed(1)} mi`}
             </span>
           </div>
           
           {/* Elevation */}
           <div className="flex items-center gap-1 text-gray-700">
             <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
             </svg>
             <span>
               {trail.elevationStart?.toLocaleString()}'
               {trail.elevationMax && ` - ${trail.elevationMax.toLocaleString()}'`}
             </span>
           </div>
           
           {/* Parking */}
           {trail.parking && (
             <div className="flex items-center gap-1 text-gray-700">
               <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
               </svg>
               <span className="truncate">{trail.parking}</span>
             </div>
           )}
           
           {/* Ride - Combined Range and Cost */}
           {(trail.range || rideCost) && (
             <div className="flex items-center gap-1 text-gray-700">
               <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
               </svg>
               <span className="truncate">{rideCost || `Range: ${trail.range}`}</span>
             </div>
           )}
           
           {/* Seasonal Availability */}
           {scoreMonths.length > 0 && (
             <div className="flex items-center gap-1 text-gray-700">
               <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
               </svg>
               <span className="truncate" title={availableMonthsStr}>{availableMonthsStr}</span>
             </div>
           )}
           
           {/* Best Season */}
           {bestSeason && (
             <div className="flex items-center gap-1 text-gray-700">
               <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
               </svg>
               <span className="truncate">{bestSeason}</span>
             </div>
          )}
         </div>
       </Link>

        {/* Web Link / Search / GPX - outside Link to avoid nested anchors */}
        <div className="px-4 pb-2 flex items-center gap-2">
         {trail.webLink ? (
           <a
             href={trail.webLink}
             target="_blank"
             rel="noopener noreferrer"
             className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
             title={trail.webLink}
           >
             <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
             </svg>
             <span className="truncate">Link</span>
           </a>
         ) : (
            <a
              href={getGoogleAllTrailsSearchUrl(trail.fullName || trail.name)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
              title={`Search for ${trail.fullName || trail.name} on AllTrails in Washington`}
            >
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="truncate">Search</span>
            </a>
          )}
          {trail.hasGpx && (
            <button
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (gpxDownloading) return;
                setGpxDownloading(true);
                try {
                  const gpx = await getGpx(trail.id);
                  if (gpx) {
                    const safeName = (trail.fullName || trail.name || 'route').replace(/[^a-zA-Z0-9]/g, '_');
                    downloadBlob(gpx, `${safeName}.gpx`, 'application/gpx+xml');
                  }
                } finally {
                  setTimeout(() => setGpxDownloading(false), 1000);
                }
              }}
              className="flex items-center gap-1 text-green-600 hover:text-green-800"
              title={`Download GPX for ${trail.fullName || trail.name}`}
            >
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span className="truncate">GPX</span>
            </button>
          )}
          {trail.hasGpx && (
            <button
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const gpx = await getGpx(trail.id);
                if (!gpx) return;
                const coord = getFirstCoordinateFromGpx(gpx);
                if (coord) {
                  openGoogleMapsTrailhead(coord.lat, coord.lon);
                } else {
                  showToast('No GPS coordinates found in GPX file', 'error');
                }
              }}
              className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-semibold"
              title={`Open trailhead for ${trail.fullName || trail.name} in Google Maps`}
            >
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="truncate">TH</span>
            </button>
          )}
          {trail.hasGpx && (
            <button
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const gpx = await getGpx(trail.id);
                if (!gpx) return;
                const coord = getFirstCoordinateFromGpx(gpx);
                if (coord) {
                  openOrganicMaps(coord.lat, coord.lon, trail.fullName || trail.name);
                } else {
                  showToast('No GPS coordinates found in GPX file', 'error');
                }
              }}
              className="flex items-center gap-1 text-purple-600 hover:text-purple-800"
              title={`Open trailhead for ${trail.fullName || trail.name} in Organic Maps`}
            >
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="truncate">GPX_TH</span>
            </button>
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

      {/* Copy button bar */}
      <div className="bg-gray-50 px-4 py-2 border-t border-gray-100 flex items-center justify-between">
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 text-sm text-green-600 hover:text-green-800 font-medium"
          title={tt('Copy trail report to clipboard')}
        >
          {copied ? (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              Copy Report
            </>
          )}
        </button>
      </div>
    </div>
  );
}
