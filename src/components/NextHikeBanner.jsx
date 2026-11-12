import { Link } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { DAY_NAMES, DIFFICULTY_COLORS } from '../utils/constants';
import { getTrailName } from '../utils/data';
import { openWeatherForTrail, fetchWeatherAndTide, hasValidCoords } from '../utils/io';
import { getNoaaTideUrl } from '../utils/url';
import { getGpx } from '../api/client';
import { calculateETC, formatStartOffset, tideInfoForEntry } from '../utils/etc';
import { useGpxActions } from '../hooks/useGpxActions';
import TrailStats from './shared/TrailStats';
import TrailActionButtons from './shared/TrailActionButtons';
import GPXHelp from './GPXHelp';

export default function NextHikeBanner({ nextHikes }) {
  const [weatherMap, setWeatherMap] = useState({});

  useEffect(() => {
    if (!nextHikes || nextHikes.length === 0) return;
    let cancelled = false;
    (async () => {
      const weatherPromises = nextHikes.map((hike, idx) => {
        const trail = hike.trail;
        const hasCoords = hasValidCoords(trail?.trailHeadLat, trail?.trailHeadLon);
        const hasTide = !!trail?.tideStationId;
        if (!hasCoords && !hasTide) return null;
        return fetchWeatherAndTide(
          hasCoords ? trail.trailHeadLat : null,
          hasCoords ? trail.trailHeadLon : null,
          hike.date,
          trail.tideStationId || null,
          tideInfoForEntry(trail, hike.earlyStart)
        )
          .then(w => ({ idx, w }))
          .catch(() => null);
      });
      const weatherResults = await Promise.allSettled(weatherPromises);
      if (cancelled) return;
      const map = {};
      weatherResults.forEach(r => {
        if (r.status === 'fulfilled' && r.value) {
          map[r.value.idx] = r.value.w;
        }
      });
      setWeatherMap(map);
    })();
    return () => { cancelled = true; };
  }, [nextHikes]);

  if (!nextHikes || nextHikes.length === 0) return null;

  return (
    <>
      {nextHikes.map((hike, idx) => (
        <NextHikeCard key={idx} hike={hike} idx={idx} weather={weatherMap[idx]} />
      ))}
    </>
  );
}

function NextHikeCard({ hike, idx, weather }) {
  const trail = hike.trail;
  const { handleGpxDownload, handleGpxShare, handleTrailhead } = useGpxActions(trail);
  const handleWeather = useCallback(() => openWeatherForTrail(getGpx, hike.trailId), [hike.trailId]);
  const displayHikeName = getTrailName(hike.trail);

  // Calculate Estimated Completion Time: use the actual GPX track duration when
  // available, otherwise estimate from the longest route distance at 2 mph.
  const etc = calculateETC(Math.max(trail.distance, trail.distanceExtended || 0), trail.range, hike.earlyStart, trail.durationMinutes);

  // Double-click on the tide chip opens the NOAA predictions page for the
  // hike's station + date (TrailCard's chip does the same with a single click).
  const openNoaaTide = trail.tideStationId
    ? () => window.open(getNoaaTideUrl(trail.tideStationId, hike.date), '_blank')
    : null;

  return (
          <div className={`mb-6 bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl shadow-lg ${idx > 0 ? 'mt-4' : ''}`}>
            <div className="p-5 md:p-7">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-shrink-0 w-20 h-20 bg-white/20 rounded-xl flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold text-white leading-none">{hike.day}</span>
                    <span className="text-base text-green-100 font-medium">{DAY_NAMES[hike.date.getDay()]}</span>
                  </div>
                  <div className="flex items-center gap-2.5 flex-wrap justify-end">
                    <span className={`px-3 py-1 rounded-full text-base font-medium ${DIFFICULTY_COLORS[trail.difficulty] || 'bg-gray-100 text-gray-800'}`}>
                      {trail.difficulty}
                    </span>
                    {(() => {
                      const early = formatStartOffset(hike.earlyStart);
                      if (!early) return null;
                      return (
                        <span className={`px-3 py-1 rounded-full text-base font-medium ${early.className} text-white`}>{early.label}</span>
                      );
                    })()}
                  </div>
                </div>
                <Link
                  to={`/trail/${hike.trailId}`}
                  className="text-2xl md:text-3xl font-bold text-white hover:text-green-100 transition-colors"
                >
                  {displayHikeName}
                </Link>
                <div className="flex items-center gap-3 flex-wrap text-green-100 text-lg">
                  {hike.leader && (
                    <>
                      <span className="text-green-300">•</span>
                      <span>Leader: <span className="font-medium text-white">{hike.leader}</span></span>
                    </>
                  )}
                  {weather?.temp != null && (
                    <>
                      <span className="text-green-300">•</span>
                    <span title={`${weather.temp}°F, ${weather.rain}% rain${weather.om ? ' (Open-Meteo)' : ''}`} aria-label={`Forecast: ${weather.temp}°F, ${weather.rain}% rain${weather.om ? ' (Open-Meteo)' : ''}`} className={weather.rain >= 40 ? 'text-blue-200 font-medium' : ''}>
                      {weather.temp}°F{weather.rain >= 1 && ` · ${weather.rain}%${weather.om ? ' OM' : ''}`}
                    </span>
                    </>
                  )}
                  {weather?.tide != null && (
                    <>
                      <span className="text-green-300">•</span>
                      {weather.tideMode === 'level' ? (
                        <span
                          className={openNoaaTide ? 'cursor-pointer hover:text-white' : undefined}
                          onDoubleClick={openNoaaTide || undefined}
                          title={`Tide at turnaround ~${weather.tideTime}: ${weather.tide} ft, ${weather.tideRising ? 'rising' : 'falling'} (no low tide 6am-6pm) — double-click for NOAA predictions`}
                          aria-label={`Tide at turnaround about ${weather.tideTime}: ${weather.tide} feet, ${weather.tideRising ? 'rising' : 'falling'}. Double-click to open NOAA predictions.`}
                        >
                          Tide ~{weather.tideTime} · {weather.tide} ft {weather.tideRising ? '↑' : '↓'}
                        </span>
                      ) : (
                        <span
                          className={openNoaaTide ? 'cursor-pointer hover:text-white' : undefined}
                          onDoubleClick={openNoaaTide || undefined}
                          title={`Low tide ${weather.tideTime}: ${weather.tide} ft — double-click for NOAA predictions`}
                          aria-label={`Low tide ${weather.tideTime}: ${weather.tide} ft. Double-click to open NOAA predictions.`}
                        >
                          Low tide {weather.tideTime} · {weather.tide} ft
                        </span>
                      )}
                    </>
                  )}
                  {etc && (
                    <>
                      <span className="text-green-300">•</span>
                      <span className="font-medium text-white" title="Estimated Time to return to Sequim parking ± 90min">ETC {etc}</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <TrailActionButtons
                    trail={trail}
                    hikeDate={hike.date}
                    variant="hero"
                    iconSize="w-4 h-4"
                    onGpxDownload={handleGpxDownload}
                    onGpxShare={handleGpxShare}
                    onTrailhead={handleTrailhead}
                    onWeather={handleWeather}
                  />
                </div>
                   <div className="grid grid-cols-1 gap-2 pt-2 border-t border-white/20 min-[420px]:grid-cols-2 sm:grid-cols-5 sm:gap-3">
                     <TrailStats
                       trail={trail}
                       itemClassName="flex min-w-0 items-center gap-2 text-base text-green-50 sm:text-lg"
                       iconSize="w-5 h-5 sm:w-6 sm:h-6"
                       rideFormat="range"
                       inline
                     />
                     <div className="flex items-center justify-end gap-2">
                       <GPXHelp variant="dark" />
                     </div>
                   </div>
               </div>
             </div>
           </div>
  );
}
