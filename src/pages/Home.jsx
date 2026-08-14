import { useMemo } from 'react';
import { useTrails } from '../hooks/useTrails';
import { useTrailStore } from '../hooks/useTrailStore';
import { useFilters } from '../hooks/useFilters';
import { useMonthContext } from '../contexts/MonthContext';
import { useDayContext } from '../contexts/DayContext';
import { useDayWeather } from '../hooks/useDayWeather';
import FilterPanel from '../components/FilterPanel';
import TrailList from '../components/TrailList';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Home() {
  const { trails, lookup, schedule, loading } = useTrails();
  const { trailDetails } = useTrailStore();
  const { filters, setFilters, sortedTrails, resetFilters } = useFilters(trails, trailDetails);
  const { selectedMonth } = useMonthContext();
  const { selectedDay } = useDayContext();
  const hikeDate = useMemo(() => new Date(new Date().getFullYear(), selectedMonth, parseInt(selectedDay) || 1), [selectedMonth, selectedDay]);
  const trailIds = useMemo(() => sortedTrails.map(t => t.id), [sortedTrails]);
  const weatherMap = useDayWeather({ schedule, selectedMonth, selectedDay, trailIds, trails: sortedTrails });

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

      <TrailList trails={sortedTrails} selectedMonths={filters.months} weatherMap={weatherMap} hikeDate={hikeDate} />
    </>
  );
}
