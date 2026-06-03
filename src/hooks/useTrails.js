import { useState, useMemo } from 'react';
import { useTrailStore } from './useTrailStore';
import { useFilters } from './useFilters';

export function useTrails() {
  const { trails, trailDetails, loading } = useTrailStore();
  const lookup = useMemo(() => window.__EMBEDDED_DATA__?.lookup ?? null, []);
  const schedule = useMemo(() => window.__EMBEDDED_DATA__?.schedule ?? null, []);

  return { trails, lookup, schedule, trailDetails, loading };
}

export { useFilters };
