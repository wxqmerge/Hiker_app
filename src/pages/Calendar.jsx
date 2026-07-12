import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useTrails } from '../hooks/useTrails';
import { useSchedulePolling } from '../hooks/useSchedulePolling';
import { useTooltips } from '../hooks/useTooltips';
import { useToast } from '../hooks/useToast';
import { useNextHike } from '../hooks/useNextHike';
import PageNav from '../components/PageNav';
import TrailCard from '../components/TrailCard';
import ScheduledCards from '../components/ScheduledCards';
import LoadingSpinner from '../components/LoadingSpinner';
import GPXHelp from '../components/GPXHelp';
import NextHikeBanner from '../components/NextHikeBanner';
import { MONTH_NAMES, DAY_NAMES, DIFFICULTY_COLORS } from '../utils/constants';
import { getGpx, updateSchedule } from '../api/client';
import { getRideCost } from '../utils/report';
import { setSchedule } from '../hooks/useTrailStore';
import { downloadBlob, getFirstCoordinateFromGpx, openGoogleMapsTrailhead } from '../utils/io';
import { serverScheduleToStore, storeToServerSchedule } from '../utils/scheduleFormat';
import { useScheduleData } from '../hooks/useScheduleData';
import { useScheduleDragDrop } from '../hooks/useScheduleDragDrop';

const APP_VERSION = __APP_VERSION;

export default function Calendar() {
  const { trails, schedule: scheduleData, loading } = useTrails();
  const { title: tt } = useTooltips();
  const showToast = useToast();

  const year = 2026;

  const scheduleStore = useMemo(() => serverScheduleToStore(scheduleData), [scheduleData]);

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
  const [gpxDownloading, setGpxDownloading] = useState(false);

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

  const {
    confirmSwap,
    cancelSwap,
    handleDropOnDate,
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
              const monthAbbr = name.substring(0, 3);
              const count = scheduleData?.[monthAbbr] ? Object.keys(scheduleData[monthAbbr]).length : 0;
              return (
                <option key={idx} value={idx}>
                  {name} ({count} hikes)
                </option>
              );
            })}
          </select>
           <p className="text-gray-600 text-sm ml-auto">
             {assignedCount}/{hikeDates.length} dates filled
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
          handleDropOnDate={handleDropOnDate}
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
