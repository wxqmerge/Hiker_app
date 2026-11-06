import { useState, useEffect, useMemo } from 'react';

/**
 * Shared weather/tide fetch + state management.
 * Takes a target object (must have a `key` field) and an async fetch function.
 * Handles cancellation on unmount/target change and key-based staleness checks.
 * Returns a map (or {} when stale/empty).
 */
export function useWeatherFetch(target, fetchFn) {
  const [weather, setWeather] = useState({ key: null, map: {} });

  useEffect(() => {
    if (!target) return;
    let cancelled = false;
    (async () => {
      try {
        const results = await fetchFn(target);
        if (!cancelled) setWeather({ key: target.key, map: results });
      } catch (err) {
        console.warn('[useWeatherFetch] fetch failed:', err);
        if (!cancelled) setWeather({ key: target.key, map: {} });
      }
    })();
    return () => { cancelled = true; };
  }, [target, fetchFn]);

  const weatherMap = useMemo(() => {
    if (!target || weather.key !== target.key) return {};
    return weather.map;
  }, [target, weather]);

  return weatherMap;
}
