import { Link } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { DAY_NAMES, MONTH_NAMES, DIFFICULTY_COLORS } from '../utils/constants';
import { getRideCost } from '../utils/report';
import { getGpx } from '../api/client';
import { downloadBlob, getFirstCoordinateFromGpx, openGoogleMapsTrailhead, openWeatherForTrail, fetchNwsForecastForDate } from '../utils/io';
import GPXHelp from './GPXHelp';

function useHikeGpxActions(trailId, trailName) {
  const [gpxDownloading, setGpxDownloading] = useState(false);

  const handleGpxDownload = useCallback(async () => {
    if (gpxDownloading) return;
    setGpxDownloading(true);
    try {
      const gpx = await getGpx(trailId);
      if (gpx) {
        const safeName = (trailName || 'route').replace(/[^a-zA-Z0-9]/g, '_');
        downloadBlob(gpx, `${safeName}.gpx`, 'application/gpx+xml');
      }
    } finally {
      setTimeout(() => setGpxDownloading(false), 1000);
    }
  }, [trailId, trailName, gpxDownloading]);

  const handleTrailhead = useCallback(async () => {
    const gpx = await getGpx(trailId);
    if (!gpx) return;
    const coord = getFirstCoordinateFromGpx(gpx);
    if (coord) {
      openGoogleMapsTrailhead(coord.lat, coord.lon);
    }
  }, [trailId]);

  return { gpxDownloading, handleGpxDownload, handleTrailhead };
}

export default function NextHikeBanner({ nextHikes }) {
  const [weatherMap, setWeatherMap] = useState({});

  useEffect(() => {
    if (!nextHikes || nextHikes.length === 0) return;
    let cancelled = false;
    const promises = nextHikes.map(async (hike, idx) => {
      const gpx = await getGpx(hike.trailId).catch(() => null);
      if (!gpx) return;
      const coord = getFirstCoordinateFromGpx(gpx);
      if (!coord) return;
      const w = await fetchNwsForecastForDate(coord.lat, coord.lon, hike.date).catch(() => null);
      if (w && !cancelled) {
        setWeatherMap(prev => ({ ...prev, [idx]: w }));
      }
    });
    Promise.allSettled(promises);
    return () => { cancelled = true; };
  }, [nextHikes]);

  if (!nextHikes || nextHikes.length === 0) return null;

  return (
    <>
      {nextHikes.map((hike, idx) => (
        <NextHikeCard key={idx} hike={hike} idx={idx} weather={weatherMap[idx]} totalHikes={nextHikes.length} />
      ))}
    </>
  );
}

function NextHikeCard({ hike, idx, weather, totalHikes }) {
  const trail = hike.trail;
  const rideCost = trail.range ? getRideCost(parseInt(trail.range, 10)) : null;
  const { handleGpxDownload, handleTrailhead } = useHikeGpxActions(hike.trailId, trail.fullName || trail.name);

  const handleWeather = () => openWeatherForTrail(getGpx, hike.trailId);

  const displayHikeName = hike.trail.fullName || hike.trail.name;

  return (
          <div key={idx} className={`mb-6 bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl shadow-lg ${idx > 0 ? 'mt-4' : ''}`}>
            <div className="p-5 md:p-7">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-shrink-0 w-20 h-20 bg-white/20 rounded-xl flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold text-white leading-none">{hike.day}</span>
                    <span className="text-base text-green-100 font-medium">{DAY_NAMES[hike.date.getDay()]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      {totalHikes > 1 && (
                        <span className="text-sm font-bold bg-white/30 px-2 py-0.5 rounded text-white uppercase">
                          Hike {String.fromCharCode(65 + idx)}
                        </span>
                      )}
                      <Link
                        to={`/trail/${hike.trailId}`}
                        className="text-2xl md:text-3xl font-bold text-white hover:text-green-100 transition-colors truncate"
                      >
                        {displayHikeName}
                      </Link>
                      <span className={`px-3 py-1 rounded-full text-base font-medium ${DIFFICULTY_COLORS[trail.difficulty] || 'bg-gray-100 text-gray-800'}`}>
                        {trail.difficulty}
                      </span>
                      {hike.earlyStart && (
                        <span className="px-3 py-1 rounded-full text-base font-medium bg-orange-500 text-white">Early Start</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-green-100 text-lg">
                      <span>{MONTH_NAMES[hike.monthIndex]} {hike.day}</span>
                      {hike.leader && (
                        <>
                          <span className="text-green-300">•</span>
                          <span>Leader: <span className="font-medium text-white">{hike.leader}</span></span>
                        </>
                      )}
                      {weather && (
                        <>
                          <span className="text-green-300">•</span>
                          <span title={`${weather.temp}°F, ${weather.rain}% rain`} className={weather.rain >= 40 ? 'text-blue-200 font-medium' : ''}>
                            {weather.temp}°F{weather.rain >= 1 && ` · ${weather.rain}%`}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 flex-shrink-0">
                    {trail.hasGpx && (
                      <>
                        <button
                          onClick={() => handleGpxDownload()}
                          className="flex items-center gap-2 px-5 py-3 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xl font-bold transition-colors"
                          title={`Download GPX for ${displayHikeName}`}
                        >
                          <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          <span>GPX</span>
                        </button>
                        <button
                          onClick={() => handleTrailhead()}
                          className="flex items-center gap-2 px-5 py-3 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xl font-bold transition-colors"
                          title={`Open trailhead for ${displayHikeName} in Google Maps`}
                        >
                          <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span>TH</span>
                        </button>
                        <button
                          onClick={() => handleWeather()}
                          className="flex items-center gap-2 px-5 py-3 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xl font-bold transition-colors"
                          title={`Open weather forecast for ${displayHikeName}`}
                        >
                          <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004-4h1a4 4 0 003.77-5.53A6 6 0 0018 11h1a4 4 0 004-4" />
                          </svg>
                          <span>W</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
                 <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 border-t border-white/20">
                    <div className="flex items-center gap-2 text-green-50">
                      <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                      <span className="text-base">
                        {trail.distance?.toFixed(1) || 'N/A'} mi
                        {trail.distanceExtended && ` / ${trail.distanceExtended.toFixed(1)}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-green-50">
                      <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                      </svg>
                      <span className="text-base">
                        {trail.elevationStart?.toLocaleString() || 'N/A'}'
                        {trail.elevationMax && ` - ${trail.elevationMax.toLocaleString()}'`}
                      </span>
                    </div>
                    {trail.parking && (
                      <div className="flex items-center gap-2 text-green-50">
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        <span className="text-base truncate">{trail.parking}</span>
                      </div>
                    )}
                    {trail.range && (
                      <div className="flex items-center gap-2 text-green-50">
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                        </svg>
                        <span className="text-base truncate">{trail.range} min{rideCost ? ` / ${rideCost}` : ''}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-end gap-2">
                      <GPXHelp variant="dark" />
                    </div>
                  </div>
               </div>
             </div>
           </div>
  );
}
