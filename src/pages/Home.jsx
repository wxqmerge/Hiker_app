import { Link } from 'react-router-dom';
import { useTrails } from '../hooks/useTrails';
import { useTrailStore } from '../hooks/useTrailStore';
import { useFilters } from '../hooks/useFilters';
import { useNextHike } from '../hooks/useNextHike';
import PageNav from '../components/PageNav';
import FilterPanel from '../components/FilterPanel';
import TrailList from '../components/TrailList';
import LoadingSpinner from '../components/LoadingSpinner';
import GPXHelp from '../components/GPXHelp';
import { DAY_NAMES, MONTH_NAMES, DIFFICULTY_COLORS } from '../utils/constants';
import { getRideCost } from '../utils/report';

const APP_VERSION = __APP_VERSION;

function NextHikeBanner({ nextHike }) {
  if (!nextHike) return null;
  const trail = nextHike.trail;
  const rideCost = trail.range ? getRideCost(parseInt(trail.range, 10)) : null;

  return (
    <div className="mb-6 bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl shadow-lg">
      <div className="p-5 md:p-7">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-shrink-0 w-20 h-20 bg-white/20 rounded-xl flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-white leading-none">{nextHike.day}</span>
              <span className="text-base text-green-100 font-medium">{DAY_NAMES[nextHike.date.getDay()]}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <Link
                  to={`/trail/${nextHike.trailId}`}
                  className="text-2xl md:text-3xl font-bold text-white hover:text-green-100 transition-colors truncate"
                >
                  {nextHike.hikeName}
                </Link>
                <span className={`px-3 py-1 rounded-full text-base font-medium ${DIFFICULTY_COLORS[trail.difficulty] || 'bg-gray-100 text-gray-800'}`}>
                  {trail.difficulty}
                </span>
                {nextHike.earlyStart && (
                  <span className="px-3 py-1 rounded-full text-base font-medium bg-orange-500 text-white">Early Start</span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-2 text-green-100 text-lg">
                <span>{MONTH_NAMES[nextHike.monthIndex]} {nextHike.day}</span>
                {nextHike.leader && (
                  <>
                    <span className="text-green-300">•</span>
                    <span>Leader: <span className="font-medium text-white">{nextHike.leader}</span></span>
                  </>
                )}
              </div>
            </div>
            <Link
              to={`/trail/${nextHike.trailId}`}
              className="flex-shrink-0 px-5 py-3 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xl font-bold transition-colors"
            >
              Details →
            </Link>
          </div>
           <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 border-t border-white/20">
             <div className="flex items-center gap-2 text-green-50">
               <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
               </svg>
               <span className="text-base">
                 {trail.distance?.toFixed(1) || 'N/A'} mi
                 {trail.distanceExtended && ` / ${trail.distanceExtended.toFixed(1)}`}
               </span>
             </div>
             <div className="flex items-center gap-2 text-green-50">
               <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
               </svg>
               <span className="text-base">
                 {trail.elevationStart?.toLocaleString() || 'N/A'}'
                 {trail.elevationMax && ` - ${trail.elevationMax.toLocaleString()}'`}
               </span>
             </div>
             {trail.parking && (
               <div className="flex items-center gap-2 text-green-50">
                 <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                 </svg>
                 <span className="text-base truncate">{trail.parking}</span>
               </div>
             )}
             {trail.range && (
               <div className="flex items-center gap-2 text-green-50">
                 <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                 </svg>
                 <span className="text-base truncate">{trail.range} min{rideCost ? ` / ${rideCost}` : ''}</span>
               </div>
             )}
             <div className="flex items-center justify-end gap-2">
               <GPXHelp variant="dark" />
             </div>
           </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const { trails, lookup, schedule, loading } = useTrails();
  const { trailDetails } = useTrailStore();
  const { filters, setFilters, sortedTrails, resetFilters } = useFilters(trails, trailDetails);
  const nextHike = useNextHike({ trails, schedule });

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

        <NextHikeBanner nextHike={nextHike} />

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
