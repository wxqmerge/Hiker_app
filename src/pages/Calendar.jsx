import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useTrails } from '../hooks/useTrails';
import { useSchedulePolling } from '../hooks/useSchedulePolling';
import { useTooltips } from '../hooks/useTooltips';
import { useNextHike } from '../hooks/useNextHike';
import PageNav from '../components/PageNav';
import ScheduledCards from '../components/ScheduledCards';
import LoadingSpinner from '../components/LoadingSpinner';
import NextHikeBanner from '../components/NextHikeBanner';
import { MONTH_NAMES, MONTH_FULL_TO_ABBR } from '../utils/constants';
import { updateSchedule, getSchedule as fetchSchedule } from '../api/client';
import { setSchedule } from '../hooks/useTrailStore';
import { serverScheduleToStore, storeToServerSchedule } from '../utils/scheduleFormat';
import { useScheduleData } from '../hooks/useScheduleData';
import { useScheduleDragDrop } from '../hooks/useScheduleDragDrop';
import { getHikeDays } from '../utils/config';
import { getDaysInMonth, createDate } from '../utils/dateUtils';

const APP_VERSION = __APP_VERSION;

export default function Calendar() {
  const { trails, schedule: scheduleData, loading } = useTrails();
  const { title: tt } = useTooltips();

  const year = 2026;

  const scheduleStore = useMemo(() => {
    const result = serverScheduleToStore(scheduleData);
    console.log('[Calendar] scheduleStore memo recomputed, months:', Object.keys(result));
    return result;
  }, [scheduleData]);

  const monthSlotStats = useMemo(() => {
    const hikeDays = getHikeDays();
    const trailIdSet = new Set(trails.map(t => t.id));
    const stats = {};
    MONTH_NAMES.forEach((name, idx) => {
      const daysInMonth = getDaysInMonth(year, idx);
      let total = 0;
      for (let day = 1; day <= daysInMonth; day++) {
        const date = createDate(year, idx, day);
        const dayOfWeek = date.getDay();
        hikeDays.forEach(configDay => {
          if (configDay === dayOfWeek) total++;
        });
      }
      let filled = 0;
      const monthData = scheduleStore[name] || {};
      Object.values(monthData).forEach(val => {
        const entries = Array.isArray(val) ? val : (val ? [val] : []);
        filled += entries.filter(e => e?.trail_id && trailIdSet.has(e.trail_id)).length;
      });
      stats[idx] = { total, filled };
    });
    return stats;
  }, [scheduleStore, year, trails]);

  const nextHikes = useNextHike({ trails, schedule: scheduleData, year });

  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth());
  const hasSyncedInitialMonth = useRef(false);

  useEffect(() => {
    if (!hasSyncedInitialMonth.current && nextHikes && nextHikes.length > 0 && !loading) {
      hasSyncedInitialMonth.current = true;
      setSelectedMonth(nextHikes[0].monthIndex);
    }
  }, [loading, nextHikes]);
  const hasApiKey = !!localStorage.getItem('hiker-api-key');
  const [pendingSwap, setPendingSwap] = useState(null);

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
    const newLeader = prompt('Enter new leader name:', currentLeader || '');
    if (newLeader === null) return;
    const trimmed = newLeader.trim();
    const monthName = MONTH_NAMES[selectedMonth];
    // Fetch latest schedule from server to avoid stale closure
    let latestServer;
    try {
      latestServer = await fetchSchedule();
    } catch {
      latestServer = scheduleData || {};
    }
    const store = serverScheduleToStore(latestServer);
    const monthAbbr = MONTH_FULL_TO_ABBR[monthName];
    console.log('[Calendar] Leader change debug:', {
      day, slotIdx, leader: trimmed, monthName, monthAbbr,
      storeMonths: Object.keys(store),
      monthData: store[monthName],
      dayEntries: store[monthName]?.[day],
    });
    const current = store[monthName] || {};
    const updated = { ...current };
    const existing = updated[day];
    if (Array.isArray(existing)) {
      const updatedEntry = { ...existing[slotIdx], leader: trimmed };
      updated[day] = [...existing];
      updated[day][slotIdx] = updatedEntry;
    } else {
      updated[day] = [{ ...existing, leader: trimmed }];
    }
    const newStore = { ...store, [monthName]: updated };
    const serverData = storeToServerSchedule(newStore);
    console.log('[Calendar] Server data for month:', monthAbbr, serverData[monthAbbr]?.find(e => e.day == day));
    try {
      const result = await updateSchedule(serverData);
      console.log('[Calendar] PUT result:', result, 'server response day 17:', result[monthAbbr]?.find(e => e.day == day));
      setSchedule(serverData);
    } catch (error) {
      console.error('[Calendar] Failed to save leader:', error);
      alert('Failed to save leader: ' + error.message);
    }
  }, [selectedMonth, scheduleData]);

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
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-green-500 focus:border-green-500"
            title={tt('Select month to view')}
          >
            {MONTH_NAMES.map((name, idx) => {
              const { total, filled } = monthSlotStats[idx] || { total: 0, filled: 0 };
              const label = total > 0 ? `${filled}/${total}` : '0/0';
              const color = filled === 0 ? '#9ca3af' : filled === total ? '#15803d' : '#a16207';
              return (
                <option key={idx} value={idx} style={{ color }}>
                  {name} ({label})
                </option>
              );
            })}
          </select>
            <p className="text-gray-600 text-sm ml-auto">
              {monthSlotStats[selectedMonth]?.filled ?? assignedCount}/{monthSlotStats[selectedMonth]?.total ?? hikeDates.length} slots filled
            </p>

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

        {pendingSwap && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Swap Hikes?</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">{pendingSwap.sourceDayLabel}:</span>
                  <span className="font-medium">{pendingSwap.sourceTrailName}</span>
                </div>
                <div className="flex justify-center text-gray-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">{pendingSwap.targetDayLabel}:</span>
                  <span className="font-medium">{pendingSwap.targetTrailName}</span>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={cancelSwap}
                  className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmSwap}
                  className="px-4 py-2 text-sm text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                >
                  Confirm Swap
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
