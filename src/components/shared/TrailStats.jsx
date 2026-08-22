// Shared trail stats grid - displays distance, elevation, parking, ride cost
// Used by TrailCard and NextHikeBanner with different styling

import { getRideCost } from '../../utils/report';

export default function TrailStats({ trail, className = '', itemClassName = '', iconSize = 'w-3.5 h-3.5', rideFormat = 'range', inline = false }) {
  const rideCost = trail.range ? getRideCost(parseInt(trail.range, 10)) : null;

  const wrapperClass = inline ? `${className} contents` : className;
  return (
    <div className={wrapperClass}>
      {/* Distance */}
      <div className={itemClassName}>
        <svg className={`${iconSize} flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
        <span>
          {trail.distance?.toFixed(1) || 'N/A'} mi
          {trail.distanceExtended && ` / ${trail.distanceExtended.toFixed(1)} mi`}
        </span>
      </div>

      {/* Elevation */}
      <div className={itemClassName}>
        <svg className={`${iconSize} flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
        <span>
          {trail.elevationStart?.toLocaleString() || 'N/A'}'
          {trail.elevationMax && ` - ${trail.elevationMax.toLocaleString()}'`}
        </span>
      </div>

      {/* Parking */}
      {trail.parking && (
        <div className={itemClassName}>
          <svg className={`${iconSize} flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <span className="truncate">{trail.parking}</span>
        </div>
      )}

      {/* Ride */}
      {(trail.range || rideCost) && (
        <div className={itemClassName}>
          <svg className={`${iconSize} flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
          <span className="truncate">
            {rideFormat === 'cost' ? (rideCost || `Range: ${trail.range}`) : `${trail.range} min${rideCost ? ` / ${rideCost}` : ''}`}
          </span>
        </div>
      )}

      {/* Duration */}
      {trail.duration && (
        <div className={itemClassName}>
          <svg className={`${iconSize} flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{trail.duration}</span>
        </div>
      )}
    </div>
  );
}
