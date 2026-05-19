import { useState, useEffect, useMemo } from 'react';
import { filterTrails, sortTrails } from '../utils/filterTrails';

export function useTrails() {
  const [trails, setTrails] = useState([]);
  const [lookup, setLookup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadData() {
      try {
        if (window.__EMBEDDED_DATA__) {
          const trailsArray = window.__EMBEDDED_DATA__.trails?.trails || window.__EMBEDDED_DATA__.trails || [];
          setTrails(Array.isArray(trailsArray) ? trailsArray : []);
          setLookup(window.__EMBEDDED_DATA__.lookup);
          setLoading(false);
          return;
        }

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

  const filteredTrails = useMemo(() => filterTrails(trails, filters), [trails, filters]);
  const sortedTrails = useMemo(() => sortTrails(filteredTrails, filters), [filteredTrails, filters]);

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
