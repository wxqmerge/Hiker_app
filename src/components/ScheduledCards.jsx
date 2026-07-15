import { useMemo } from 'react';
import { MONTH_NAMES } from '../utils/constants';
import TrailCard from './TrailCard';
import { getDaysInMonth, createDate } from '../utils/dateUtils';
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
}) {
  const cards = useMemo(() => {
    const daysInMonth = getDaysInMonth(year, selectedMonth);
    const allDays = [];
    const hikeDays = getHikeDays();
    for (let day = 1; day <= daysInMonth; day++) {
      const date = createDate(year, selectedMonth, day);
      if (hikeDays.includes(date.getDay())) allDays.push(day);
    }
    return allDays
       .flatMap(day => {
         const entries = assignedHikes[day] || [];
          const filteredEntries = entries.filter(entry => entry?.trail_id);
          return filteredEntries
            .map((entry, idx) => {
              const { trail_id: trailId, early_start: earlyStart, leader } = entry;
              const trail = findTrailById(trailId);
              if (!trail) return null;
              const hikeIdx = Object.entries(trailIndexToId).find(([, id]) => id === trailId);
               return (
                 <div
                   key={`${day}-${idx}`}
                   draggable={hasApiKey}
                    onDragStart={() => hikeIdx && hasApiKey && handleDragStart(Number(hikeIdx[0]), day, idx, trailId, earlyStart, leader)}
                  onDragEnd={handleDragEnd}
                  className={hasApiKey ? 'cursor-grab active:cursor-grabbing' : ''}
                  title={hasApiKey ? tt('Drag to swap with another date') : undefined}
                  style={{ opacity: dragData?.sourceDay === day ? 0.4 : 1 }}
                >
                  <div className="relative">
                    <TrailCard trail={trail} isActive={false} leader={leader} onLeaderChange={onLeaderChange ? () => onLeaderChange(day, idx, leader) : undefined} />
                    <div className="absolute top-2 right-2 bg-green-600 text-white text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center flex-col leading-none">
                      {day}
                      <span className="text-[8px]">{getDayLabel(createDate(year, selectedMonth, day).getDay())}</span>
                    </div>
                     {earlyStart && (
                       <div className="absolute top-2 left-2 bg-orange-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center" title="Early Start">
                        ⏰
                      </div>
                    )}
                  </div>
                </div>
             );
           });
       })
      .filter(Boolean);
  }, [assignedHikes, trailIndexToId, handleDragStart, handleDragEnd, selectedMonth, findTrailById, year, dragData, tt, hasApiKey, onLeaderChange]);


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
           {cards.map((card, idx) => (
             <div
               key={idx}
               onDragOver={(e) => e.preventDefault()}
             >
               {card}
             </div>
           ))}
        </div>
      </div>
    </div>
  );
}
