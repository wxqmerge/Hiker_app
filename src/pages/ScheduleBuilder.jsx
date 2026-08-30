import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTrails } from '../hooks/useTrails';
import { useFilters } from '../hooks/useFilters';
import { useTooltips } from '../hooks/useTooltips';
import { useApiKey } from '../hooks/useApiKey';

import FilterPanel from '../components/FilterPanel';
import { useMonthContext } from '../contexts/MonthContext';
import { useScheduleSettings } from '../contexts/ScheduleSettingsContext';
import { getTrailName } from '../utils/data';
import TrailCard from '../components/TrailCard';
import LoadingSpinner from '../components/LoadingSpinner';
import SwapConfirmationModal from '../components/SwapConfirmationModal';
import MoveHikeModal from '../components/MoveHikeModal';
import { MONTH_NAMES, DEFAULT_FILTERS } from '../utils/constants';
import LeaderEdit from '../components/LeaderEdit';
import { filterTrails, sortTrails } from '../utils/filterTrails';
import { getNoaaTideUrl } from '../utils/url.js';
import { createDate, getMonthKey } from '../utils/dateUtils';
import { useGpxActions } from '../hooks/useGpxActions';
import { getDayEntries, setDayEntry } from '../utils/scheduleFormat';
import { useTrailDetails } from '../hooks/useTrailDetails';
import { useScheduleData } from '../hooks/useScheduleData';
import { useScheduleDragDrop } from '../hooks/useScheduleDragDrop';
import { updateLeader } from '../utils/scheduleActions';
import { getDayName, getHikeDaysLabel, slotLetter } from '../utils/config';
import { START_OFFSET_OPTIONS, normalizeStartOffset } from '../utils/etc';

// Distinct color per day-of-week so all 7 days are visually distinguishable.
const DAY_COLORS = {
  0: 'text-red-600',      // Sunday
  1: 'text-blue-600',     // Monday
  2: 'text-green-600',    // Tuesday
  3: 'text-cyan-600',     // Wednesday
  4: 'text-indigo-600',   // Thursday
  5: 'text-purple-600',   // Friday
  6: 'text-amber-600',    // Saturday
};

export default function ScheduleBuilder() {
  const { trails, loading, lookup, schedule: scheduleData } = useTrails();
  const trailDetails = useTrailDetails();
  const navigate = useNavigate();
  const { filters, setFilters } = useFilters(trails, trailDetails);
  const { title: tt } = useTooltips();
  const { selectedMonth, selectedYear } = useMonthContext();
  const hasApiKey = useApiKey();
  const [pendingSwap, setPendingSwap] = useState(null);
  const year = selectedYear;

  const {
    scheduleStore, setScheduleStore,
    saveStatus, weatherMap, debugMode,
    hikeTrailMap,
  } = useScheduleSettings();

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

  const [leaderEdit, setLeaderEdit] = useState(null);
  const [moveSource, setMoveSource] = useState(null);
  const { isDownloading, downloadGpx, openTrailhead } = useGpxActions();

  const scheduledMap = useMemo(() => {
    const map = {};
    Object.entries(assignedHikes).forEach(([day, entries]) => {
      (Array.isArray(entries) ? entries : [entries]).forEach((entry) => {
        if (entry?.trail_id) {
          if (!map[entry.trail_id]) map[entry.trail_id] = [];
          map[entry.trail_id].push(Number(day));
        }
      });
    });
    return map;
  }, [assignedHikes]);

  const updateMonthSchedule = useCallback((monthKey, updater) => {
    setScheduleStore(prev => {
      const current = prev[monthKey] || {};
      const next = updater(current);
      return { ...prev, [monthKey]: next };
    });
  }, [setScheduleStore]);

  const filteredHikes = useMemo(() => {
    const filtered = filterTrails(hikeTrailMap, filters, trailDetails);
    const sorted = sortTrails(filtered, filters, trailDetails, weatherMap);
    return sorted;
  }, [hikeTrailMap, filters, trailDetails, weatherMap]);

  const {
    confirmSwap,
    cancelSwap,
    handleDropOnDate,
    handleDropOnAvailable,
    removeHike,
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
    updateScheduleFn: updateMonthSchedule,
  });

  const setStartOffset = (day, slotIdx, offset) => {
    const monthKey = getMonthKey(year, selectedMonth);
    const monthData = scheduleStore[monthKey] || {};
    const entry = getDayEntries(monthData, day)[slotIdx];
    if (!entry?.trail_id) return;

    updateMonthSchedule(monthKey, prev => setDayEntry(prev, day, slotIdx, { ...entry, early_start: offset }));
  };


    const hikeCards = useMemo(() => {
       return filteredHikes.reduce((cards, item) => {
         const trail = item.trail;
         if (!trail) return cards;
         const scheduledDays = scheduledMap[trail.id];
         cards.push(
          <div
             key={`${trail.id}-${item.hikeIndex}`}
             draggable
              onDragStart={() => handleDragStart(item.hikeIndex, null, null, trail.id, false, '')}
             onDragEnd={handleDragEnd}
             className="cursor-grab active:cursor-grabbing"
             title={tt('Drag to schedule on a date')}
             aria-label={`Drag ${getTrailName(trail)} to schedule on a date`}
           >
             <div className="relative">
                <TrailCard trail={trail} isActive={false} selectedMonths={filters.months} weather={weatherMap[trail.id]} />
             {debugMode && (
               <div className="absolute top-2 left-2 bg-gray-700 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                 {item.hikeIndex}
               </div>
             )}
             {scheduledDays && scheduledDays.length > 0 && (
               <div className="absolute top-2 right-2 bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full" title={`Scheduled: ${scheduledDays.join(', ')}`}>
                 {scheduledDays.length === 1 ? `Day ${scheduledDays[0]}` : `${scheduledDays.length} dates`}
               </div>
             )}
             {hasApiKey && (
               <button
                 type="button"
                 onClick={() => setMoveSource({ hikeIndex: item.hikeIndex, sourceDay: null, sourceSlot: null, trailId: trail.id, earlyStart: false, leader: '' })}
                 className="absolute bottom-2 right-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-2 py-1 rounded"
                 title={tt('Move to another date')}
                 aria-label={`Move ${getTrailName(trail)} to another date`}
               >
                 Move
               </button>
             )}
           </div>
         </div>
       );
       return cards;
     }, []);
  }, [filteredHikes, handleDragStart, handleDragEnd, debugMode, filters.months, tt, weatherMap, hasApiKey, scheduledMap]);

  if (loading) {
    return <LoadingSpinner message="Loading trails..." />;
  }

  if (!scheduleData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Schedule data not loaded. Run `python match_schedule.py` first.</p>
        </div>
      </div>
    );
  }

  return (
    <>


        <div className="flex gap-6">
          {/* Left Panel - Available Hikes */}
          <div className="flex-[4]">
            <FilterPanel
              filters={filters}
              setFilters={setFilters}
              lookup={lookup}
              resetFilters={() => setFilters({ ...DEFAULT_FILTERS })}
              totalCount={trails.length}
              filteredCount={filteredHikes.length}
            />
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-800">
                  Available Hikes ({filteredHikes.length})
                </h3>
              </div>
               <div
                 className="p-4"
                 onDragOver={(e) => { e.preventDefault(); }}
                 onDrop={(e) => {
                   e.preventDefault();
                   handleDropOnAvailable(dragData?.sourceDay, dragData?.sourceSlot);
                 }}
                 title={tt('Drag hikes here to schedule')}
               >
                {filteredHikes.length === 0 ? (
                  <div className="text-center py-12">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No hikes found</h3>
                    <p className="mt-1 text-sm text-gray-500">Try adjusting your filters or search terms.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pr-1">
                    {hikeCards}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Panel - Dates */}
          <div className="flex-[1]">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between gap-2">
               <h3 className="text-sm font-semibold text-gray-800">
                  {MONTH_NAMES[selectedMonth]} {year} — {getHikeDaysLabel()}
                </h3>
                {saveStatus !== 'idle' && (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                    saveStatus === 'saving' ? 'bg-yellow-100 text-yellow-700'
                      : saveStatus === 'saved' ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved' : 'Save failed'}
                  </span>
                )}
              </div>
              <div className="p-4 max-h-[calc(100vh-14rem)] overflow-y-auto">
                <div className="space-y-3">
                    {hikeDates.map((slot) => {
                      const day = slot.day;
                      const slotIdx = slot.slot;
                      const dayOfWeek = createDate(year, selectedMonth, day).getDay();

                        const entry = assignedHikes[day]?.[slotIdx] || { trail_id: null, early_start: 0, leader: '' };
                        const trailId = entry.trail_id;
                        const earlyStart = normalizeStartOffset(entry.early_start);
                        const leader = entry.leader;
                         const trail = findTrailById(trailId);
                         const displayHikeName = trail ? getTrailName(trail) : trailId;
                       const hasMultipleSlots = hikeDates.filter(s => s.day === day).length > 1;

                       return (
                        <div
                          key={`${day}-${slotIdx}`}
                          draggable={!!trailId}
                          onDragStart={trailId ? () => handleDragStart(null, day, slotIdx, trailId, earlyStart, leader) : undefined}
                          onDragEnd={handleDragEnd}
                          onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('bg-green-50'); }}
                          onDragLeave={(e) => { e.currentTarget.classList.remove('bg-green-50'); }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.currentTarget.classList.remove('bg-green-50');
                            handleDropOnDate(day, slotIdx);
                          }}
                           onDoubleClick={() => trailId && hasApiKey && navigate(`/trail/${trailId}?edit=true`)}
                             className={`border-2 rounded-lg p-3 transition-all ${
                               trailId && trail
                                 ? 'border-green-300 bg-green-50 cursor-pointer'
                                 : trailId
                                   ? 'border-amber-300 bg-amber-50 cursor-pointer'
                                   : 'border-dashed border-gray-300 hover:border-green-300 hover:bg-green-50'
                             }`}
                            style={{ opacity: dragData?.sourceDay === day ? 0.4 : 1 }}
                          title={trailId ? tt('Drop another hike here to swap · Double-click to edit trail (requires API key)') : tt('Drop a hike here to schedule')}
                          aria-label={trailId ? `Day ${day}, ${getDayName(dayOfWeek)}: ${displayHikeName}` : `Empty slot on day ${day}, ${getDayName(dayOfWeek)}`}
                        >
                           <div className="flex items-start gap-3">
                              <div className="text-center flex-shrink-0">
                                  <div className={`text-2xl font-bold ${DAY_COLORS[dayOfWeek] || 'text-gray-600'}`}>
                                    {day}
                                  </div>
                                  <div className="text-xs text-gray-500">{getDayName(dayOfWeek)}</div>
                                </div>
                              <div className="flex-1 min-w-0">
                                {displayHikeName ? (
                                  <>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      {hasMultipleSlots && (
                                        <span className="text-[10px] font-bold bg-gray-200 px-1.5 py-0.5 rounded text-gray-600 uppercase">
                                          {slotLetter(slotIdx)}
                                        </span>
                                      )}
                                      <span className="text-base font-semibold text-gray-900 truncate">
                                        {displayHikeName}
                                      </span>
                                       {earlyStart !== 0 && <span className={`text-sm font-bold ${earlyStart > 0 ? 'text-green-700' : 'text-orange-500'}`} title={`Start offset: ${earlyStart > 0 ? '+' : ''}${earlyStart}m`}>{earlyStart > 0 ? `+${earlyStart}m` : `${earlyStart}m`}</span>}
                                     </div>
                                      {!trailId && (
                                       <div className="text-xs text-gray-400 italic mt-0.5">
                                         Unmatched trail_id — drag a trail here
                                       </div>
                                     )}
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setLeaderEdit({ day, slotIdx });
                                          }}
                                          className={`mt-1 w-full text-xs border rounded px-1.5 py-0.5 text-left truncate transition-colors ${
                                            leader
                                              ? 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 cursor-pointer'
                                              : 'border-gray-300 text-gray-400 hover:bg-gray-50 cursor-pointer'
                                          }`}
                                          title="Click to set leader"
                                        >
                                          {leader || 'Set Leader'}
                                        </button>
                                        {leaderEdit && leaderEdit.day === day && leaderEdit.slotIdx === slotIdx && (
                                          <LeaderEdit
                                            initialLeader={leader}
                                            tt={tt}
                                              onSave={async (newLeader) => {
                                                await updateLeader(scheduleStore, selectedMonth, day, slotIdx, newLeader, year);
                                                setLeaderEdit(null);
                                              }}
                                            onCancel={() => setLeaderEdit(null)}
                                          />
                                        )}
                                  </>
                                ) : trailId ? (
                                 <div className="text-sm text-amber-600 italic">
                                   Trail not found (ID: {trailId})
                                 </div>
                                ) : (
                                 <div className="text-sm text-gray-400 italic">
                                   Drop hike here
                                 </div>
                                )}
                              </div>
                          </div>
                            {trailId && (
                              <div className="flex items-center gap-1 ml-3">
                                <select
                                  value={normalizeStartOffset(earlyStart)}
                                  onChange={(e) => setStartOffset(day, slotIdx, Number(e.target.value))}
                                  className="text-xs border border-gray-300 rounded px-1 py-0.5 bg-white"
                                  title={tt('Start time offset')}
                                  aria-label="Start time offset"
                                >
                                  {START_OFFSET_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                  ))}
                                </select>
                               {trail?.hasGpx && (
                                 <>
                                     <button
                                        onClick={() => downloadGpx(trailId, getTrailName(trail))}
                                       disabled={isDownloading(trailId)}
                                       className="text-green-600 hover:text-green-800 transition-colors disabled:opacity-50"
                                       title={tt('Download GPX file')}
                                       aria-label={`Download GPX for ${getTrailName(trail)}`}
                                     >
                                       <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4-4V4" />
                                      </svg>
                                    </button>
                                     <button
                                       onClick={() => openTrailhead(trail)}
                                       className="text-blue-600 hover:text-blue-800 transition-colors"
                                       title={tt('Open trailhead in Google Maps')}
                                       aria-label={`Open trailhead for ${getTrailName(trail)} in Google Maps`}
                                     >
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                     </svg>
                                   </button>
                                  </>
                                )}
                                {trail?.tideStationId && (
                                  <a
                                     href={getNoaaTideUrl(trail.tideStationId, createDate(year, selectedMonth, day))}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                     className="text-blue-600 hover:text-blue-800 transition-colors"
                                     title={`NOAA Tide Station ${trail.tideStationId}`}
                                     aria-label={`View NOAA tide predictions for ${getTrailName(trail)}`}
                                   >
                                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15c2-1 4-1 6 0s4 1 6 0 4-1 6 0" />
                                    </svg>
                                  </a>
                                )}
                                {trail?.webLink && (
                                  <a
                                    href={trail.webLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                     className="text-blue-600 hover:text-blue-800 transition-colors"
                                     title={trail.webLink}
                                     aria-label={`Open web link for ${getTrailName(trail)}`}
                                   >
                                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                    </svg>
                                  </a>
                                )}
                                <button
                                  onClick={() => setMoveSource({ hikeIndex: null, sourceDay: day, sourceSlot: slotIdx, trailId, earlyStart, leader, duplicate: false })}
                                  className="text-blue-600 hover:text-blue-800 transition-colors text-xs font-medium"
                                  title={tt('Move to another date')}
                                  aria-label={`Move ${displayHikeName || 'hike'} to another date`}
                                >
                                  Move
                                </button>
                                <button
                                  onClick={() => setMoveSource({ hikeIndex: null, sourceDay: day, sourceSlot: slotIdx, trailId, earlyStart, leader, duplicate: true })}
                                  className="text-green-600 hover:text-green-800 transition-colors text-xs font-medium"
                                  title={tt('Duplicate to another date')}
                                  aria-label={`Duplicate ${displayHikeName || 'hike'} to another date`}
                                >
                                  Copy
                                </button>
                                <button
                                  onClick={() => removeHike(day, slotIdx)}
                                   className="text-red-400 hover:text-red-600 transition-colors"
                                   title={tt('Remove hike from this date')}
                                   aria-label={`Remove ${displayHikeName || 'hike'} from day ${day}`}
                                 >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                 </svg>
                               </button>
                                </div>
                           )}
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        </div>
        <MoveHikeModal
          open={!!moveSource}
          source={moveSource}
          duplicate={moveSource?.duplicate || false}
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
