import { useState, useEffect, useMemo } from 'react';

export function useTrails() {
  const [trails, setTrails] = useState([]);
  const [lookup, setLookup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadData() {
      try {
        // Check for embedded data (single-file standalone mode)
        if (window.__EMBEDDED_DATA__) {
          // trails.json has structure { trails: [...] }, so access .trails.trails
          const trailsArray = window.__EMBEDDED_DATA__.trails?.trails || window.__EMBEDDED_DATA__.trails || [];
          setTrails(Array.isArray(trailsArray) ? trailsArray : []);
          setLookup(window.__EMBEDDED_DATA__.lookup);
          setLoading(false);
          return;
        }

        // Fall back to fetch for dev mode
        const [trailsRes, lookupRes] = await Promise.all([
          fetch('/data/trails.json'),
          fetch('/data/lookup.json')
        ]);
        
        const trailsData = await trailsRes.json();
        const lookupData = await lookupRes.json();
        
        setTrails(trailsData.trails || []);
        setLookup(lookupData);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return { trails, lookup, loading, error };
}

export function useFilters(trails) {
  const [filters, setFilters] = useState({
    search: '',
    distanceMin: 0,
    distanceMax: 20,
    elevationMin: 0,
    elevationMax: 5000,
    difficulties: [],
    months: []
  });

  const filteredTrails = useMemo(() => {
    return trails.filter(trail => {
      // Search filter - search ALL text fields
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const searchText = [
          trail.name,
          trail.fullName,
          trail.notes,
          trail.difficulty,
          trail.parking,
          trail.seasonal?.parkingInfo,
          // Search seasonal months
          ...Object.entries(trail.seasonal || [])
            .filter(([k, v]) => typeof v === 'number' && v > 0)
            .map(([k]) => k.toLowerCase())
        ].filter(Boolean).join(' ').toLowerCase();
        
        if (!searchText.includes(searchLower)) return false;
      }

      // Distance filter
      if (trail.distance !== null && trail.distance !== undefined) {
        if (trail.distance < filters.distanceMin || trail.distance > filters.distanceMax) {
          return false;
        }
      }

      // Elevation filter
      if (trail.elevationStart !== null && trail.elevationStart !== undefined) {
        if (trail.elevationStart < filters.elevationMin || trail.elevationStart > filters.elevationMax) {
          return false;
        }
      }

      // Difficulty filter
      if (filters.difficulties.length > 0 && !filters.difficulties.includes(trail.difficulty)) {
        return false;
      }

      // Month filter
      if (filters.months.length > 0) {
        const seasonal = trail.seasonal || {};
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const matchesMonth = filters.months.some(monthIdx => {
          const monthName = monthNames[monthIdx];
          if (!monthName) return false;
          return seasonal[monthName] > 0;
        });
        if (!matchesMonth) return false;
      }

      return true;
    });
  }, [trails, filters]);

  const resetFilters = () => {
    setFilters({
      search: '',
      distanceMin: 0,
      distanceMax: 20,
      elevationMin: 0,
      elevationMax: 5000,
      difficulties: [],
      months: []
    });
  };

  return { filters, setFilters, filteredTrails, resetFilters };
}
