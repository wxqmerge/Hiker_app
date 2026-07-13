import { useTrails } from '../hooks/useTrails';
import { useTrailStore } from '../hooks/useTrailStore';
import { useFilters } from '../hooks/useFilters';
import PageNav from '../components/PageNav';
import FilterPanel from '../components/FilterPanel';
import TrailList from '../components/TrailList';
import LoadingSpinner from '../components/LoadingSpinner';

const APP_VERSION = __APP_VERSION;

export default function Home() {
  const { trails, lookup, loading } = useTrails();
  const { trailDetails } = useTrailStore();
  const { filters, setFilters, sortedTrails, resetFilters } = useFilters(trails, trailDetails);

  if (loading) {
    return <LoadingSpinner message="Loading trails..." />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="container mx-auto px-4 py-3">
        <div className="flex items-baseline justify-between mb-6">
          <PageNav />
          <p className="text-gray-600 text-sm ml-auto">
            Showing {sortedTrails.length} of {trails.length} trails
            <span className="ml-2 text-xs text-gray-400">v{APP_VERSION}</span>
          </p>
        </div>

        <FilterPanel 
          filters={filters}
          setFilters={setFilters}
          lookup={lookup}
          resetFilters={resetFilters}
        />

        <TrailList trails={sortedTrails} selectedMonths={filters.months} />
      </main>
    </div>
  );
}
