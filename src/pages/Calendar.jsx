import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useTrails } from '../hooks/useTrails';
import { useSchedulePolling } from '../hooks/useSchedulePolling';
import { useTooltips } from '../hooks/useTooltips';
import { useNextHike } from '../hooks/useNextHike';
import { useApiKey } from '../hooks/useApiKey';
import { useMonthContext } from '../contexts/MonthContext';
import ScheduledCards from '../components/ScheduledCards';
import LoadingSpinner from '../components/LoadingSpinner';
import NextHikeBanner from '../components/NextHikeBanner';
import SwapConfirmationModal from '../components/SwapConfirmationModal';
import { MONTH_NAMES } from '../utils/constants';
import { updateSchedule } from '../api/client';
import { setSchedule } from '../hooks/useTrailStore';
import { serverScheduleToStore, storeToServerSchedule } from '../utils/scheduleFormat';
import { updateLeader } from '../utils/scheduleActions';
import { useScheduleData } from '../hooks/useScheduleData';
import { useScheduleDragDrop } from '../hooks/useScheduleDragDrop';

export default function Calendar() {
  const { trails, schedule: scheduleData, loading } = useTrails();
  const { title: tt } = useTooltips();

  const year = 2026;

  const scheduleStore = useMemo(() => serverScheduleToStore(scheduleData), [scheduleData]);

  const nextHikes = useNextHike({ trails, schedule: scheduleData, year });

  const { selectedMonth, setSelectedMonth } = useMonthContext();
  const hasSyncedInitialMonth = useRef(false);
  const hasApiKey = useApiKey();
  const [pendingSwap, setPendingSwap] = useState(null);

  useEffect(() => {
    if (!hasSyncedInitialMonth.current && nextHikes && nextHikes.length > 0 && !loading) {
      hasSyncedInitialMonth.current = true;
      setSelectedMonth(nextHikes[0].monthIndex);
    }
  }, [loading, nextHikes, setSelectedMonth]);

  useSchedulePolling({ setSchedule }, 5000);

  const {
    assignedHikes,
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
    <>
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
    </>
  );
}
