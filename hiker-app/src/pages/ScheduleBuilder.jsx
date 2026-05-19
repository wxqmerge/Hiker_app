import { useState, useMemo, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTrails, useFilters } from '../hooks/useTrails';
import FilterPanel from '../components/FilterPanel';
import TrailCard from '../components/TrailCard';
import { MONTH_NAMES, MONTH_ABBR, DAY_NAMES, DEFAULT_FILTERS } from '../utils/constants';
import { formatTrailLine } from '../utils/formatTrail';

const SCHEDULE_STORAGE_KEY = 'hiker-schedule';

export default function ScheduleBuilder() {
  const { trails, loading, lookup } = useTrails();
  const { filters, setFilters } = useFilters(trails);
  const [scheduleData] = useState(() => window.__EMBEDDED_DATA__?.schedule || null);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    const nextMonth = (now.getMonth() + 1) % 12;
    return nextMonth;
  });
  const [assignedHikes, setAssignedHikes] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SCHEDULE_STORAGE_KEY));
      return saved && typeof saved === 'object' ? saved : {};
    } catch {
      return {};
    }
  });
  const [dragData, setDragData] = useState(null);

  useEffect(() => {
    localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(assignedHikes));
  }, [assignedHikes]);

  const year = 2026;

  const monthHikes = useMemo(() => {
    if (!scheduleData) return [];
    const monthAbbr = MONTH_ABBR[selectedMonth];
    return scheduleData[monthAbbr] || [];
  }, [scheduleData, selectedMonth]);

  const assignedDays = useMemo(() => {
    const days = new Set();
    Object.keys(assignedHikes).forEach(d => days.add(parseInt(d)));
    return days;
  }, [assignedHikes]);

  const availableHikes = useMemo(() => {
    const assignedDaysArr = Array.from(assignedDays);
    return monthHikes.filter(h => !assignedDaysArr.includes(h.day));
  }, [monthHikes, assignedDays]);

  const filteredHikes = useMemo(() => {
    let result = availableHikes;

    if (filters.search.trim()) {
      const q = filters.search.toLowerCase();
      result = result.filter(h => h.hike.toLowerCase().includes(q));
    }

    result = result.filter(h => {
      const hikeLower = h.hike.toLowerCase();
      const hikeKey = hikeLower.substring(0, 8);
      const trail = trails.find(t => {
        const name = (t.fullName || t.name).toLowerCase();
        return name.includes(hikeKey) || hikeKey.includes(name.substring(0, 8));
      });
      if (!trail) return true;

      if (filters.distanceMax < 20 && trail.distance != null && trail.distance > filters.distanceMax) return false;
      if (filters.elevationMax < 5000 && trail.elevationStart != null && trail.elevationStart > filters.elevationMax) return false;
      if (filters.difficulties.length > 0 && !filters.difficulties.includes(trail.difficulty)) return false;
      if (filters.months.length > 0) {
        const seasonal = trail.seasonal || {};
        const hasMonth = filters.months.some(mIdx => {
          const monthName = MONTH_ABBR[mIdx];
          return monthName && seasonal[monthName] > 0;
        });
        if (!hasMonth) return false;
      }

      return true;
    });

    return result;
  }, [availableHikes, filters, trails]);

  const wedFriDates = useMemo(() => {
    const daysInMonth = new Date(year, selectedMonth + 1, 0).getDate();
    const dates = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, selectedMonth, day);
      const dayOfWeek = date.getDay();
      if (dayOfWeek === 3 || dayOfWeek === 5) {
        dates.push(day);
      }
    }
    return dates;
  }, [selectedMonth]);

  const assignedCount = useMemo(() => {
    return Object.keys(assignedHikes).length;
  }, [assignedHikes]);

  const matchTrail = useCallback((hikeName) => {
    return trails.find(t => {
      const name = (t.fullName || t.name).toLowerCase();
      return name.includes(hikeName.toLowerCase().substring(0, 8)) ||
             hikeName.toLowerCase().includes(name.substring(0, 8));
    });
  }, [trails]);

  const handleDragStart = (hike, sourceDay) => {
    setDragData({ hike, sourceDay });
  };

  const handleDragEnd = () => {
    setDragData(null);
  };

  const handleDropOnDate = (targetDay) => {
    if (!dragData) return;

    const { hike, sourceDay } = dragData;

    if (sourceDay === targetDay) {
      setDragData(null);
      return;
    }

    setAssignedHikes(prev => {
      const next = { ...prev };
      if (sourceDay !== null && sourceDay !== undefined) {
        delete next[sourceDay];
      }
      next[targetDay] = hike;
      return next;
    });
    setDragData(null);
  };

  const handleDropOnAvailable = () => {
    if (!dragData) return;

    const { sourceDay } = dragData;
    if (sourceDay === null || sourceDay === undefined) {
      setDragData(null);
      return;
    }

    setAssignedHikes(prev => {
      const next = { ...prev };
      delete next[sourceDay];
      return next;
    });
    setDragData(null);
  };

  const removeHike = (day) => {
    setAssignedHikes(prev => {
      const next = { ...prev };
      delete next[day];
      return next;
    });
  };

  const handleExport = () => {
    const month = MONTH_NAMES[selectedMonth];
    let output = `Over-the-Hill Hike Descriptions -- ${month}, ${year}\n`;

    for (const day of wedFriDates) {
      const assigned = assignedHikes[day];

      if (!assigned) {
        const dayOfWeek = DAY_NAMES[new Date(year, selectedMonth, day).getDay()];
        output += `${dayOfWeek}, ${month} ${day}\tTBD\n\n`;
        continue;
      }

      const trail = matchTrail(assigned.hike);
      const dayOfWeek = DAY_NAMES[new Date(year, selectedMonth, day).getDay()];

      if (trail) {
        output += `${dayOfWeek}, ${month} ${day}\t${formatTrailLine(trail)}\n`;

        if (trail.seasonal?.bestSeason) {
          output += `Season: ${trail.seasonal.bestSeason}\n`;
        }
        if (trail.notes && trail.notes !== trail.fullName) {
          output += `${trail.notes}\n`;
        }
      } else {
        output += `${dayOfWeek}, ${month} ${day}\t${assigned.hike}\t(No match)\n`;
      }
      output += '\n';
    }

    const blob = new Blob([output], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${month.toLowerCase()}_${year}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading trails...</p>
        </div>
      </div>
    );
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

  const hikeCards = filteredHikes.map((hike) => {
    const trail = matchTrail(hike.hike);
    if (!trail) return null;
    return (
      <div
        key={`${hike.day}-${hike.hike}`}
        draggable
        onDragStart={() => handleDragStart(hike, null)}
        onDragEnd={handleDragEnd}
        className="cursor-grab active:cursor-grabbing"
      >
        <TrailCard trail={trail} isActive={false} />
      </div>
    );
  }).filter(Boolean);

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="container mx-auto px-4 py-3">
        <div className="mb-6 flex items-baseline gap-3">
          <h2 className="text-2xl font-bold text-gray-900">Schedule Builder</h2>
          <span className="text-gray-300">|</span>
          <Link to="/" className="text-green-700 hover:text-green-900 font-medium text-sm">
            Browse Trails
          </Link>
          <p className="text-gray-600 text-sm ml-auto">
            {assignedCount}/{wedFriDates.length} dates filled
          </p>
        </div>

        <FilterPanel 
          filters={filters}
          setFilters={setFilters}
          lookup={lookup}
          resetFilters={() => setFilters({ ...DEFAULT_FILTERS })}
        />

        <div className="flex gap-6">
          {/* Left Panel - Available Hikes */}
          <div className="flex-[4]">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-800">
                  Available Hikes ({filteredHikes.length})
                </h3>
              </div>
              <div
                className="p-4"
                onDragOver={(e) => { e.preventDefault(); }}
                onDrop={handleDropOnAvailable}
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
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[60vh] overflow-y-auto pr-1">
                    {hikeCards}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Panel - Dates */}
          <div className="flex-[1]">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-800">
                  {MONTH_NAMES[selectedMonth]} {year} — Wed/Fri
                </h3>
              </div>
              <div className="p-4">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-4 focus:ring-green-500 focus:border-green-500"
                >
                  {MONTH_NAMES.map((name, idx) => {
                    const monthAbbr = name.substring(0, 3);
                    const count = scheduleData[monthAbbr] ? scheduleData[monthAbbr].length : 0;
                    return (
                      <option key={idx} value={idx}>
                        {name} ({count} hikes)
                      </option>
                    );
                  })}
                </select>
                <div className="space-y-3">
                  {wedFriDates.map((day) => {
                    const dayOfWeek = DAY_NAMES[new Date(year, selectedMonth, day).getDay()];
                    const assigned = assignedHikes[day];

                    return (
                      <div
                        key={day}
                        onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('bg-green-50'); }}
                        onDragLeave={(e) => { e.currentTarget.classList.remove('bg-green-50'); }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.currentTarget.classList.remove('bg-green-50');
                          handleDropOnDate(day);
                        }}
                        className={`border-2 rounded-lg p-3 transition-all ${
                          assigned
                            ? 'border-green-300 bg-green-50'
                            : 'border-dashed border-gray-300 hover:border-green-300 hover:bg-green-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="text-center min-w-[48px]">
                              <div className={`text-xl font-bold ${
                                dayOfWeek === 'Wed' ? 'text-blue-600' : 'text-purple-600'
                              }`}>
                                {day}
                              </div>
                              <div className="text-xs text-gray-500">{dayOfWeek}</div>
                            </div>
                            <div className="w-px h-8 bg-gray-200"></div>
                            {assigned ? (
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-900 truncate">
                                  {assigned.hike}
                                </div>
                                {matchTrail(assigned.hike) && (
                                  <div className="text-xs text-gray-500 truncate">
                                    ({matchTrail(assigned.hike).fullName || matchTrail(assigned.hike).name})
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-sm text-gray-400 italic">
                                Drop hike here
                              </div>
                            )}
                          </div>
                          {assigned && (
                            <button
                              onClick={() => removeHike(day)}
                              className="ml-3 text-red-400 hover:text-red-600 transition-colors"
                              title="Remove hike"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleExport}
            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 text-sm ${
              assignedCount === 0
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
            disabled={assignedCount === 0}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0l-4 4m4-4v12" />
            </svg>
            Export to Text File
          </button>
        </div>
      </main>
    </div>
  );
}
