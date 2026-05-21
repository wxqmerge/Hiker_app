import { Link } from 'react-router-dom';
import { useTrails, useFilters } from '../hooks/useTrails';
import FilterPanel from '../components/FilterPanel';
import TrailList from '../components/TrailList';

export default function Home() {
  const { trails, lookup, loading, error } = useTrails();
  const { filters, setFilters, sortedTrails, resetFilters } = useFilters(trails);

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

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center text-red-600">
          <p>Error loading data: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="container mx-auto px-4 py-3">
        <div className="mb-6 flex items-baseline gap-3">
          <h2 className="text-2xl font-bold text-gray-900">Browse Trails</h2>
          <span className="text-gray-300">|</span>
          <Link to="/trails" className="text-green-700 hover:text-green-900 font-medium text-sm">
            Manage Trails
          </Link>
          <Link to="/schedule" className="text-green-700 hover:text-green-900 font-medium text-sm">
            Schedule Builder
          </Link>
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

        <TrailList trails={sortedTrails} />
      </main>
    </div>
  );
}
