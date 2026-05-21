import { useState, useMemo } from 'react';
import { filterTrails, sortTrails } from '../utils/filterTrails';
import { useTrailStore } from './useTrailStore';

export function useTrails() {
  const { trails, trailDetails, loading } = useTrailStore();
  const lookup = useMemo(() => window.__EMBEDDED_DATA__?.lookup ?? null, []);
  const schedule = useMemo(() => window.__EMBEDDED_DATA__?.schedule ?? null, []);

  return { trails, lookup, schedule, trailDetails, loading };
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
