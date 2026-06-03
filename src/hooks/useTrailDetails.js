import { useTrailStore } from './useTrailStore';

export function useTrailDetails() {
  const { trailDetails } = useTrailStore();
  return trailDetails;
}
