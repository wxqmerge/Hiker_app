import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useTrails } from '../hooks/useTrails';
import { useSchedulePolling } from '../hooks/useSchedulePolling';
import { useTooltips } from '../hooks/useTooltips';
import { useNextHike } from '../hooks/useNextHike';
import { useMonthSlotStats } from '../hooks/useMonthSlotStats';
import { useApiKey } from '../hooks/useApiKey';
import PageNav from '../components/PageNav';
import ScheduledCards from '../components/ScheduledCards';
import LoadingSpinner from '../components/LoadingSpinner';
import NextHikeBanner from '../components/NextHikeBanner';
import SwapConfirmationModal from '../components/SwapConfirmationModal';
import MonthSelector from '../components/MonthSelector';
import { MONTH_NAMES } from '../utils/constants';
import { updateSchedule } from '../api/client';
import { setSchedule } from '../hooks/useTrailStore';
import { serverScheduleToStore, storeToServerSchedule } from '../utils/scheduleFormat';
import { updateLeader } from '../utils/scheduleActions';
import { useScheduleData } from '../hooks/useScheduleData';
import { useScheduleDragDrop } from '../hooks/useScheduleDragDrop';

const APP_VERSION = __APP_VERSION;

export default function Calendar() {
  const { trails, schedule: scheduleData, loading } = useTrails();
  const { title: tt } = useTooltips();

  const year = 2026;

  const scheduleStore = useMemo(() => serverScheduleToStore(scheduleData), [scheduleData]);

  const monthSlotStats = useMonthSlotStats({ trails, scheduleStore, year });

  const nextHikes = useNextHike({ trails, schedule: scheduleData, year });

  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth());
  const hasSyncedInitialMonth = useRef(false);
  const hasApiKey = useApiKey();
  const [pendingSwap, setPendingSwap] = useState(null);

  useEffect(() => {
    if (!hasSyncedInitialMonth.current && nextHikes && nextHikes.length > 0 && !loading) {
      hasSyncedInitialMonth.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedMonth(nextHikes[0].monthIndex);
    }
  }, [loading, nextHikes]);

  useSchedulePolling({ setSchedule }, 5000);

  const {
    assignedHikes,
    assignedCount,
    hikeDates,
    findTrailById,
    trailIndexToId,
    dragData,
    setDragData,
    handleDragStart,
    handleDragEnd,
  } = useScheduleData({ trails, scheduleStore, selectedMonth, year });


  const applyScheduleChange = useCallback(async (monthName, updater) => {
    const newStore = { ...scheduleStore };
    const current = newStore[monthName] || {};
    newStore[monthName] = updater(current);
    const serverData = storeToServerSchedule(newStore);
    try {
      await updateSchedule(serverData);
      setSchedule(serverData);
    } catch (error) {
      console.error('[Calendar] Failed to save schedule:', error);
      alert('Failed to save schedule to server: ' + error.message);
    }
  }, [scheduleStore]);

  const handleLeaderChange = useCallback(async (day, slotIdx, currentLeader) => {
    await updateLeader(scheduleStore, selectedMonth, day, slotIdx, currentLeader);
  }, [selectedMonth, scheduleStore]);

  const {
    confirmSwap,
    cancelSwap,
  } = useScheduleDragDrop({
    scheduleStore,
    selectedMonth,
    year,
    dragData,
    setDragData,
    pendingSwap,
    setPendingSwap,
    findTrailById,
    trailIndexToId,
    updateScheduleFn: applyScheduleChange,
    hasApiKey,
  });

  if (loading) {
    return <LoadingSpinner message="Loading schedule..." />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="container mx-auto px-4 py-3">
        <div className="mb-6 flex items-baseline gap-3">
          <PageNav />
          <span className="text-xs text-gray-400">v{APP_VERSION}</span>
          <MonthSelector
            selectedMonth={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
            monthSlotStats={monthSlotStats}
            assignedCount={assignedCount}
            hikeDates={hikeDates}
            title={tt('Select month to view')}
          />

        </div>

        {nextHikes && selectedMonth === nextHikes[0]?.monthIndex && (
          <NextHikeBanner nextHikes={nextHikes} />
        )}

        <ScheduledCards
          assignedHikes={assignedHikes}
          trailIndexToId={trailIndexToId}
          findTrailById={findTrailById}
          year={year}
          selectedMonth={selectedMonth}
          hasApiKey={hasApiKey}
          dragData={dragData}
          handleDragStart={handleDragStart}
          handleDragEnd={handleDragEnd}
          onLeaderChange={hasApiKey ? handleLeaderChange : undefined}
          tt={tt}
        />

        <SwapConfirmationModal
          pendingSwap={pendingSwap}
          onConfirm={confirmSwap}
          onCancel={cancelSwap}
        />
      </main>
    </div>
  );
}
