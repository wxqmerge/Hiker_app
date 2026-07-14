import { useState, useEffect } from 'react';
import { getGpx } from '../api/client';
import { getFirstCoordinateFromGpx, fetchNwsForecastForDate } from '../utils/io';

export function useTrailWeather(trailId, targetDate) {
  const [weather, setWeather] = useState(null);

  useEffect(() => {
    if (!trailId || !targetDate) return;
    let cancelled = false;

    getGpx(trailId).then(gpx => {
      if (cancelled || !gpx) return;
      const coord = getFirstCoordinateFromGpx(gpx);
      if (!coord) return;

      fetchNwsForecastForDate(coord.lat, coord.lon, targetDate).then(res => {
        if (!cancelled) setWeather(res);
      }).catch(() => {
        if (!cancelled) setWeather(null);
      });
    }).catch(() => {
      if (!cancelled) setWeather(null);
    });

    return () => { cancelled = true; };
  }, [trailId, targetDate]);

  return { weather };
}
