import { useEffect, useRef } from 'react';
import { useTrails } from '../hooks/useTrails';
import { useTooltips } from '../hooks/useTooltips';
import { useNextHike } from '../hooks/useNextHike';
import { useMonthContext } from '../contexts/MonthContext';
import { useDayContext } from '../contexts/DayContext';
import ScheduledCards from '../components/ScheduledCards';
import LoadingSpinner from '../components/LoadingSpinner';
import NextHikeBanner from '../components/NextHikeBanner';
import { getMonthKey } from '../utils/dateUtils';
import { useScheduleStore } from '../hooks/useScheduleStore';
import { useScheduleData } from '../hooks/useScheduleData';
import { useScheduleWeather } from '../hooks/useScheduleWeather';

export default function Calendar() {
  const { trails, schedule: scheduleData, loading } = useTrails();
  const { title: tt } = useTooltips();

  const { selectedMonth, selectedYear, setSelectedMonthKey } = useMonthContext();
  const { setSelectedDay } = useDayContext();
  const year = selectedYear;

  const scheduleStore = useScheduleStore(scheduleData);

  const nextHikes = useNextHike({ trails, schedule: scheduleData });

  const hasSyncedInitialMonth = useRef(false);

  const dayWeatherMap = useScheduleWeather({ schedule: scheduleData, selectedMonth, trails, year });

  useEffect(() => {
    if (hasSyncedInitialMonth.current || loading) return;
    hasSyncedInitialMonth.current = true;

    if (nextHikes && nextHikes.length > 0) {
      setSelectedMonthKey(nextHikes[0].monthKey);
      setSelectedDay(String(nextHikes[0].day));
      return;
    }

    // No upcoming hikes — if current month is empty, advance to next month
    const currentMonthKey = getMonthKey(year, selectedMonth);
    const currentEntries = scheduleStore[currentMonthKey];
    const hasCurrentHikes = currentEntries && Object.values(currentEntries).some(
      (val) => Array.isArray(val) ? val.some(e => e?.trail_id) : val?.trail_id
    );
    if (!hasCurrentHikes) {
      const nextMonth = (selectedMonth + 1) % 12;
      const nextYear = selectedMonth === 11 ? year + 1 : year;
      setSelectedMonthKey(getMonthKey(nextYear, nextMonth));
    }
  }, [loading, nextHikes, selectedMonth, year, scheduleStore, setSelectedMonthKey, setSelectedDay]);

  const {
    assignedHikes,
    findTrailById,
    trailIndexToId,
  } = useScheduleData({ trails, scheduleStore, selectedMonth, year });

  if (loading) {
    return <LoadingSpinner message="Loading schedule..." />;
  }

  return (
    <>
      {nextHikes && selectedMonth === nextHikes[0]?.monthIndex && selectedYear === nextHikes[0]?.year && (
        <NextHikeBanner nextHikes={nextHikes} />
      )}

      <ScheduledCards
        assignedHikes={assignedHikes}
        trailIndexToId={trailIndexToId}
        findTrailById={findTrailById}
        year={year}
        selectedMonth={selectedMonth}
        hasApiKey={false}
        dragData={null}
        handleDragStart={() => {}}
        handleDragEnd={() => {}}
        onLeaderChange={undefined}
        onRequestMove={undefined}
        tt={tt}
        weatherMap={dayWeatherMap}
      />

      {/* Move functionality is disabled in the Calendar view (viewing only). */}
    </>
  );
}
