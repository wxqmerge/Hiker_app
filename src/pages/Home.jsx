import { useTrails } from '../hooks/useTrails';
import { useTrailStore } from '../hooks/useTrailStore';
import { useFilters } from '../hooks/useFilters';
import FilterPanel from '../components/FilterPanel';
import TrailList from '../components/TrailList';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Home() {
  const { trails, lookup, loading } = useTrails();
  const { trailDetails } = useTrailStore();
  const { filters, setFilters, sortedTrails, resetFilters } = useFilters(trails, trailDetails);

  if (loading) {
    return <LoadingSpinner message="Loading trails..." />;
  }

  return (
    <>
      <FilterPanel
        filters={filters}
        setFilters={setFilters}
        lookup={lookup}
        resetFilters={resetFilters}
        totalCount={trails.length}
        filteredCount={sortedTrails.length}
      />

      <TrailList trails={sortedTrails} selectedMonths={filters.months} />
    </>
  );
}
