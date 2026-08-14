// Shared trail action buttons - GPX, Trailhead, Weather, Tide, Web/Search
// Used by TrailCard and NextHikeBanner with different styling

import { getTrailName } from '../../utils/data';
import { getGoogleAllTrailsSearchUrl, getNoaaTideUrl } from '../../utils/url.js';
import { openWeatherUrl } from '../../utils/io';

export default function TrailActionButtons({ trail, hikeDate, buttonClassName = '', iconSize = 'w-3.5 h-3.5', onGpxDownload, onTrailhead, onWeather }) {
  const trailName = getTrailName(trail);

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
          className={buttonClassName}
          title={trail.webLink}
        >
          <svg className={`${iconSize} flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          className={buttonClassName}
          title={`NOAA Tide Station ${trail.tideStationId}`}
        >
          <svg className={`${iconSize} flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          className={buttonClassName}
          title={`Search for ${trailName} on AllTrails in Washington`}
        >
          <svg className={`${iconSize} flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="truncate">Search</span>
        </a>
      )}

      {trail.hasGpx && (
        <button
          onClick={onGpxDownload}
          className={buttonClassName}
          title={`Download GPX for ${trailName}`}
        >
          <svg className={`${iconSize} flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4-4V4" />
          </svg>
          <span className="truncate">GPX</span>
        </button>
      )}

      {trail.trailHeadLat != null && trail.trailHeadLon != null && (
        <>
          <button
            onClick={onTrailhead}
            className={buttonClassName}
            title={`Open trailhead for ${trailName} in Google Maps`}
          >
            <svg className={`${iconSize} flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="truncate">TH</span>
          </button>

          <button
            onClick={handleWeatherClick}
            className={buttonClassName}
            title={`Open weather forecast for ${trailName}`}
          >
            <svg className={`${iconSize} flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004-4h1a4 4 0 003.77-5.53A6 6 0 0018 11h1a4 4 0 004-4" />
            </svg>
            <span className="truncate">W</span>
          </button>
        </>
      )}
    </>
  );
}
