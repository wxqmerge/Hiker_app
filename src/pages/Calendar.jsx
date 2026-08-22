import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useTrails } from '../hooks/useTrails';
import { useTooltips } from '../hooks/useTooltips';
import { useNextHike } from '../hooks/useNextHike';
import { useApiKey } from '../hooks/useApiKey';
import { useMonthContext } from '../contexts/MonthContext';
import ScheduledCards from '../components/ScheduledCards';
import LoadingSpinner from '../components/LoadingSpinner';
import NextHikeBanner from '../components/NextHikeBanner';
import SwapConfirmationModal from '../components/SwapConfirmationModal';
import MoveHikeModal from '../components/MoveHikeModal';
import { updateSchedule } from '../api/client';
import { setSchedule } from '../hooks/useTrailStore';
import { serverScheduleToStore, storeToServerSchedule } from '../utils/scheduleFormat';
import { updateLeader } from '../utils/scheduleActions';
import { useScheduleData } from '../hooks/useScheduleData';
import { useScheduleDragDrop } from '../hooks/useScheduleDragDrop';
import { useScheduleWeather } from '../hooks/useScheduleWeather';
import { useToast } from '../hooks/useToast';

export default function Calendar() {
  const { trails, schedule: scheduleData, loading } = useTrails();
  const { title: tt } = useTooltips();
  const showToast = useToast();

  const { selectedMonth, selectedYear, setSelectedMonthKey } = useMonthContext();
  const year = selectedYear;

  const scheduleStore = useMemo(() => serverScheduleToStore(scheduleData), [scheduleData]);

  const nextHikes = useNextHike({ trails, schedule: scheduleData, year });

  const hasSyncedInitialMonth = useRef(false);
  const hasApiKey = useApiKey();
  const [pendingSwap, setPendingSwap] = useState(null);
  const [moveSource, setMoveSource] = useState(null);

  const dayWeatherMap = useScheduleWeather({ schedule: scheduleData, selectedMonth, trails, year });

  useEffect(() => {
    if (!hasSyncedInitialMonth.current && nextHikes && nextHikes.length > 0 && !loading) {
      hasSyncedInitialMonth.current = true;
      setSelectedMonthKey(nextHikes[0].monthKey);
    }
  }, [loading, nextHikes, setSelectedMonthKey]);

  const {
    assignedHikes,
    hikeDates,
    findTrailById,
    trailIndexToId,
    dragData,
    setDragData,
    handleDragStart,
    handleDragEnd,
  } = useScheduleData({ trails, scheduleStore, selectedMonth, year });


  const scheduleStoreRef = useRef(scheduleStore);
  useEffect(() => {
    scheduleStoreRef.current = scheduleStore;
  }, [scheduleStore]);

  const applyScheduleChange = useCallback(async (monthKey, updater) => {
    const newStore = { ...scheduleStoreRef.current };
    const current = newStore[monthKey] || {};
    newStore[monthKey] = updater(current);
    const serverData = storeToServerSchedule(newStore);
    try {
      await updateSchedule(serverData);
      setSchedule(serverData);
      scheduleStoreRef.current = newStore;
    } catch (error) {
      console.error('[Calendar] Failed to save schedule:', error);
      showToast('Failed to save schedule to server: ' + error.message, 'error');
    }
  }, [showToast]);

  const handleLeaderChange = useCallback(async (day, slotIdx, newLeader) => {
    await updateLeader(scheduleStore, selectedMonth, day, slotIdx, newLeader, year);
  }, [selectedMonth, scheduleStore, year]);

  const {
    confirmSwap,
    cancelSwap,
    moveHike,
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
      {nextHikes && selectedMonth === nextHikes[0]?.monthIndex && selectedYear === nextHikes[0]?.year && (
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
        onRequestMove={hasApiKey ? (item) => setMoveSource({
          hikeIndex: item.hikeIdx,
          sourceDay: item.day,
          sourceSlot: item.idx,
          trailId: item.trailId,
          earlyStart: item.earlyStart,
          leader: item.leader,
        }) : undefined}
        tt={tt}
        weatherMap={dayWeatherMap}
      />

      <MoveHikeModal
        open={!!moveSource}
        source={moveSource}
        hikeDates={hikeDates}
        assignedHikes={assignedHikes}
        findTrailById={findTrailById}
        year={year}
        selectedMonth={selectedMonth}
        onMove={moveHike}
        onClose={() => setMoveSource(null)}
      />

      <SwapConfirmationModal
        pendingSwap={pendingSwap}
        onConfirm={confirmSwap}
        onCancel={cancelSwap}
      />
    </>
  );
}
