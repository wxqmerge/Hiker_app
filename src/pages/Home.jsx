import { useMemo } from 'react';
import { useTrails } from '../hooks/useTrails';
import { useTrailStore } from '../hooks/useTrailStore';
import { useFilters } from '../hooks/useFilters';
import { useMonthContext } from '../contexts/MonthContext';
import { useDayContext } from '../contexts/DayContext';
import { useDayWeather } from '../hooks/useDayWeather';
import { createDate } from '../utils/dateUtils';
import FilterPanel from '../components/FilterPanel';
import TrailList from '../components/TrailList';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Home() {
  const { trails, lookup, schedule, loading } = useTrails();
  const { trailDetails } = useTrailStore();
  const { selectedMonth, selectedYear } = useMonthContext();
  const { selectedDay } = useDayContext();
  const hikeDate = useMemo(() => createDate(selectedYear, selectedMonth, parseInt(selectedDay) || 1), [selectedYear, selectedMonth, selectedDay]);
  const trailIds = useMemo(() => trails.map(t => t.id), [trails]);
  const weatherMap = useDayWeather({ schedule, selectedMonth, selectedDay, trailIds, trails, year: selectedYear });
  const { filters, setFilters, sortedTrails, resetFilters } = useFilters(trails, trailDetails, weatherMap);

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
