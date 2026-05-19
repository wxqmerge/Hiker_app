import { useState, useEffect, useMemo } from 'react';
import { MONTH_ABBR } from '../utils/constants';

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
    months: [],
    sortBy: 'name',
    wilderness: false
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
            .filter(([, v]) => typeof v === 'number' && v > 0)
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
        const monthNames = MONTH_ABBR;
        const matchesMonth = filters.months.some(monthIdx => {
          const monthName = monthNames[monthIdx];
          if (!monthName) return false;
          return seasonal[monthName] > 0;
        });
        if (!matchesMonth) return false;
      }

      // Wilderness filter
      if (filters.wilderness) {
        const name = trail.fullName || trail.name || '';
        if (!name.includes('\u25C6')) return false;
      }

      return true;
    });
  }, [trails, filters]);

  const sortedTrails = useMemo(() => {
    const sorted = [...filteredTrails];
    if (filters.sortBy === 'name') {
      sorted.sort((a, b) => (a.fullName || a.name || '').localeCompare(b.fullName || b.name || ''));
    } else if (filters.sortBy === 'popularity') {
      const monthNames = MONTH_ABBR;
      const selectedMonthNames = filters.months.length > 0 ? filters.months.map(i => monthNames[i]) : monthNames;
      sorted.sort((a, b) => {
        const seasonalA = a.seasonal || {};
        const seasonalB = b.seasonal || {};
        const scoreA = selectedMonthNames.reduce((sum, m) => sum + (seasonalA[m] || 0), 0);
        const scoreB = selectedMonthNames.reduce((sum, m) => sum + (seasonalB[m] || 0), 0);
        return scoreB - scoreA;
      });
    } else if (filters.sortBy === 'elevation-up') {
      sorted.sort((a, b) => (a.elevationStart || 0) - (b.elevationStart || 0));
    } else if (filters.sortBy === 'elevation-down') {
      sorted.sort((a, b) => (b.elevationStart || 0) - (a.elevationStart || 0));
    } else if (filters.sortBy === 'distance-up') {
      sorted.sort((a, b) => (a.distance || 0) - (b.distance || 0));
    } else if (filters.sortBy === 'distance-down') {
      sorted.sort((a, b) => (b.distance || 0) - (a.distance || 0));
    } else if (filters.sortBy === 'not-wilderness') {
      sorted.sort((a, b) => {
        const aWild = (a.fullName || a.name || '').includes('\u25C6') ? 1 : 0;
        const bWild = (b.fullName || b.name || '').includes('\u25C6') ? 1 : 0;
        if (aWild !== bWild) return aWild - bWild;
        return (a.fullName || a.name || '').localeCompare(b.fullName || b.name || '');
      });
    }
    return sorted;
  }, [filteredTrails, filters.sortBy, filters.months]);

  const resetFilters = () => {
    setFilters({
      search: '',
      distanceMin: 0,
      distanceMax: 20,
      elevationMin: 0,
      elevationMax: 5000,
  difficulties: [],
      months: [],
      sortBy: 'name',
      wilderness: false
    });
  };

  return { filters, setFilters, sortedTrails, resetFilters };
}
