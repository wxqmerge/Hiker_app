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

  const nextHike = useNextHike({ trails, schedule: scheduleData, year });

  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth());
  const hasSyncedInitialMonth = useRef(false);

  useEffect(() => {
    if (!hasSyncedInitialMonth.current && nextHike && !loading) {
      hasSyncedInitialMonth.current = true;
      setSelectedMonth(nextHike.monthIndex);
    }
  }, [loading, nextHike]);
  const hasApiKey = !!localStorage.getItem('hiker-api-key');
  const [pendingSwap, setPendingSwap] = useState(null);
  const [gpxDownloading, setGpxDownloading] = useState(false);

  useSchedulePolling({ setSchedule }, 5000);

  const {
    assignedHikes,
    assignedCount,
    wedFriDates,
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

  const handleGpxDownload = useCallback(async () => {
    if (!nextHike || gpxDownloading) return;
    setGpxDownloading(true);
    try {
      const gpx = await getGpx(nextHike.trailId);
      if (gpx) {
        const safeName = (nextHike.trail.fullName || nextHike.trail.name || 'route').replace(/[^a-zA-Z0-9]/g, '_');
        downloadBlob(gpx, `${safeName}.gpx`, 'application/gpx+xml');
      }
    } finally {
      setTimeout(() => setGpxDownloading(false), 1000);
    }
  }, [nextHike, gpxDownloading]);

  const handleTrailhead = useCallback(async () => {
    if (!nextHike) return;
    const gpx = await getGpx(nextHike.trailId);
    if (!gpx) return;
    const coord = getFirstCoordinateFromGpx(gpx);
    if (coord) {
      openGoogleMapsTrailhead(coord.lat, coord.lon);
    } else {
      showToast('No GPS coordinates found in GPX file', 'error');
    }
  }, [nextHike, showToast]);

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
            {assignedCount}/{wedFriDates.length} dates filled
          </p>
        </div>

        {nextHike && selectedMonth === nextHike.monthIndex && (() => {
          const trail = nextHike.trail;
          const rideCost = trail.range ? getRideCost(parseInt(trail.range, 10)) : null;
          return (
          <div className="mb-6 bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl shadow-lg overflow-hidden">
            <div className="p-5 md:p-7">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-shrink-0 w-20 h-20 bg-white/20 rounded-xl flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold text-white leading-none">{nextHike.day}</span>
                    <span className="text-base text-green-100 font-medium">{DAY_NAMES[nextHike.date.getDay()]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h2 className="text-2xl md:text-3xl font-bold text-white truncate">
                        {nextHike.hikeName}
                      </h2>
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
                  <div className="flex items-center gap-2.5 flex-shrink-0">
                     {trail.hasGpx && (
                       <>
                         <GPXHelp variant="dark" />
                         <button
                           onClick={handleGpxDownload}
                           disabled={gpxDownloading}
                           className="flex items-center gap-2 px-5 py-3 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xl font-bold transition-colors disabled:opacity-50"
                           title={`Download GPX for ${nextHike.hikeName}`}
                         >
                          <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          <span>GPX</span>
                        </button>
                        <button
                          onClick={handleTrailhead}
                          className="flex items-center gap-2 px-5 py-3 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xl font-bold transition-colors"
                          title={`Open trailhead for ${nextHike.hikeName} in Google Maps`}
                        >
                          <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span>TH</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-white/20">
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
                </div>
              </div>
            </div>
          </div>
          );
        })()}

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
