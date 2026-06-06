import { useTrails } from '../hooks/useTrails';
import { useTrailStore } from '../hooks/useTrailStore';
import { useFilters } from '../hooks/useFilters';
import PageNav from '../components/PageNav';
import FilterPanel from '../components/FilterPanel';
import TrailList from '../components/TrailList';

export default function Home() {
  const { trails, lookup, loading } = useTrails();
  const { trailDetails } = useTrailStore();
  const { filters, setFilters, sortedTrails, resetFilters } = useFilters(trails, trailDetails);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading trails...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="container mx-auto px-4 py-3">
        <div className="flex items-baseline justify-between mb-6">
          <PageNav />
          <p className="text-gray-600 text-sm ml-auto">
            Showing {sortedTrails.length} of {trails.length} trails
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
