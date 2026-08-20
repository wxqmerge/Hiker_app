// Shared trail action buttons - GPX, Trailhead, Weather, Tide, Web/Search
// Used by TrailCard and NextHikeBanner with different styling

import { getTrailName } from '../../utils/data';
import { getGoogleAllTrailsSearchUrl, getNoaaTideUrl } from '../../utils/url.js';
import { openWeatherUrl, hasValidCoords } from '../../utils/io';

// Named button styles so TrailCard (link) and NextHikeBanner (hero) stay consistent.
const VARIANTS = {
  link: 'flex items-center gap-1 text-blue-600 hover:text-blue-800',
  hero: 'flex items-center gap-2 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm font-medium transition-colors',
};

export default function TrailActionButtons({ trail, hikeDate, variant = 'link', buttonClassName = '', iconSize = 'w-3.5 h-3.5', onGpxDownload, onGpxShare, onTrailhead, onWeather }) {
  const trailName = getTrailName(trail);
  const baseClass = `${VARIANTS[variant] || VARIANTS.link} ${buttonClassName}`.trim();

  const handleWeatherClick = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (onWeather) {
      onWeather();
    } else if (trail.trailHeadLat != null && trail.trailHeadLon != null) {
      openWeatherUrl(trail.trailHeadLat, trail.trailHeadLon);
    }
  };

  return (
    <>
      {trail.webLink && (
        <a
          href={trail.webLink}
          target="_blank"
          rel="noopener noreferrer"
          className={baseClass}
          title={trail.webLink}
          aria-label={`Open web link for ${trailName}`}
        >
          <svg className={`${iconSize} flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <span className="truncate">Web</span>
        </a>
      )}

      {trail.tideStationId && (
        <a
          href={getNoaaTideUrl(trail.tideStationId, hikeDate)}
          target="_blank"
          rel="noopener noreferrer"
          className={baseClass}
          title={`NOAA Tide Station ${trail.tideStationId}`}
          aria-label={`View NOAA tide predictions for ${trailName}`}
        >
          <svg className={`${iconSize} flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15c2-1 4-1 6 0s4 1 6 0 4-1 6 0" />
          </svg>
          <span className="truncate">Tide</span>
        </a>
      )}

      {!trail.webLink && !trail.tideStationId && (
        <a
          href={getGoogleAllTrailsSearchUrl(trailName)}
          target="_blank"
          rel="noopener noreferrer"
          className={baseClass}
          title={`Search for ${trailName} on AllTrails in Washington`}
          aria-label="Search this trail on AllTrails in Washington"
        >
          <svg className={`${iconSize} flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="truncate">Search</span>
        </a>
      )}

      {trail.hasGpx && (
        <button
          onClick={onGpxDownload}
          className={baseClass}
          title={`Download GPX for ${trailName}`}
          aria-label={`Download GPX for ${trailName}`}
        >
          <svg className={`${iconSize} flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4-4V4" />
          </svg>
          <span className="truncate">GPX</span>
        </button>
      )}

      {trail.hasGpx && onGpxShare && (
        <button
          onClick={onGpxShare}
          className={baseClass}
          title={`Share GPX for ${trailName} (opens in Organic Maps or downloads)`}
          aria-label={`Share GPX for ${trailName}`}
        >
          <svg className={`${iconSize} flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <span className="truncate">Share</span>
        </button>
      )}

      {hasValidCoords(trail.trailHeadLat, trail.trailHeadLon) && (
        <>
          <button
            onClick={onTrailhead}
            className={baseClass}
            title={`Open trailhead for ${trailName} in Google Maps`}
            aria-label={`Open trailhead for ${trailName} in Google Maps`}
          >
            <svg className={`${iconSize} flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="truncate">TH</span>
          </button>

          <button
            onClick={handleWeatherClick}
            className={baseClass}
            title={`Open weather forecast for ${trailName}`}
            aria-label={`Open weather forecast for ${trailName}`}
          >
            <svg className={`${iconSize} flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004-4h1a4 4 0 003.77-5.53A6 6 0 0018 11h1a4 4 0 004-4" />
            </svg>
            <span className="truncate">W</span>
          </button>
        </>
      )}
    </>
  );
}
