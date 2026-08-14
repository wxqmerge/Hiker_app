import { useMemo, useCallback } from 'react';
import { MONTH_NAMES } from '../utils/constants';
import TrailCard from './TrailCard';
import { createDate, getHikeDaysForMonth } from '../utils/dateUtils';
import { getHikeDays, getDayLabel } from '../utils/config';

export default function ScheduledCards({
  assignedHikes,
  trailIndexToId,
  findTrailById,
  year,
  selectedMonth,
  hasApiKey,
  dragData,
  handleDragStart,
  handleDragEnd,
  onLeaderChange,
  tt,
  weatherMap,
}) {
  const cards = useMemo(() => {
    const hikeDays = getHikeDays();
    const allDays = getHikeDaysForMonth(year, selectedMonth, hikeDays);
        return allDays
        .flatMap(day => {
          const entries = assignedHikes[day] || [];
           return entries
             .map((entry, idx) => {
               if (!entry?.trail_id) return null;
               const { trail_id: trailId, early_start: earlyStart, leader } = entry;
               const trail = findTrailById(trailId);
               if (!trail) return null;
               const hikeIdx = Object.entries(trailIndexToId).find(([, id]) => id === trailId);
                return {
                  day,
                  idx,
                  hikeIdx: hikeIdx ? Number(hikeIdx[0]) : null,
                  trail,
                  trailId,
                  earlyStart,
                  leader,
                };
             });
        })
       .filter(Boolean);
  }, [assignedHikes, trailIndexToId, selectedMonth, findTrailById, year]);

  const memoizedDragStart = useCallback((item) => {
    if (!item.hikeIdx || !hasApiKey) return;
    handleDragStart(item.hikeIdx, item.day, item.idx, item.trailId, item.earlyStart, item.leader);
  }, [handleDragStart, hasApiKey]);

  const memoizedLeaderChange = useCallback((item) => {
    if (!onLeaderChange) return;
    onLeaderChange(item.day, item.idx, item.leader);
  }, [onLeaderChange]);


  if (cards.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-800">
            Assigned Hikes (0)
          </h3>
        </div>
        <div className="p-4">
          <p className="text-sm text-gray-500 text-center py-8">No hikes assigned for {MONTH_NAMES[selectedMonth]}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-800">
          Assigned Hikes ({cards.length})
        </h3>
      </div>
      <div className="p-4">
        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (!dragData) return;
          }}
        >
           {cards.map((item) => (
             <div
               key={`${item.day}-${item.idx}`}
               draggable={hasApiKey}
               onDragStart={() => memoizedDragStart(item)}
               onDragEnd={handleDragEnd}
               onDragOver={(e) => e.preventDefault()}
               className={hasApiKey ? 'cursor-grab active:cursor-grabbing' : ''}
               title={hasApiKey ? tt('Drag to swap with another date') : undefined}
               style={{ opacity: dragData?.sourceDay === item.day ? 0.4 : 1 }}
             >
               <div className="relative">
                  <TrailCard trail={item.trail} isActive={false} leader={item.leader} onLeaderChange={() => memoizedLeaderChange(item)} hikeDate={createDate(year, selectedMonth, item.day)} weather={weatherMap?.[item.day]?.[item.trailId]} />
                <div className="absolute top-2 right-2 bg-green-600 text-white text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center flex-col leading-none">
                  {item.day}
                  <span className="text-[8px]">{getDayLabel(createDate(year, selectedMonth, item.day).getDay())}</span>
                </div>
                 {item.earlyStart && (
                   <div className="absolute top-2 left-2 bg-orange-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center" title="Early Start">
                    ⏰
                  </div>
                )}
              </div>
            </div>
           ))}
        </div>
      </div>
    </div>
  );
}
