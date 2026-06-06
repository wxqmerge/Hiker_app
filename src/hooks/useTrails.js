import { useTrailStore } from './useTrailStore';

export function useTrails() {
  const { trails, trailDetails, loading, lookup, schedule } = useTrailStore();
  return { trails, lookup, schedule, trailDetails, loading };
}


