import { useState, useMemo, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTrails, useFilters } from '../hooks/useTrails';
import FilterPanel from '../components/FilterPanel';
import TrailCard from '../components/TrailCard';
import { MONTH_NAMES, DAY_NAMES, DEFAULT_FILTERS } from '../utils/constants';
import { filterTrails, sortTrails } from '../utils/filterTrails';
import { generateReportText } from '../utils/report';
import { getTrailDetailsById } from '../utils/data';
import { downloadBlob, createImportFileInput } from '../utils/io';
import { useTrailDetails } from '../hooks/useTrailDetails';

const SCHEDULE_STORAGE_KEY = 'hiker-schedule';
const DEBUG_STORAGE_KEY = 'hiker-schedule-debug';
let prevSearch = null;

function debugLog(...args) {
  if (localStorage.getItem(DEBUG_STORAGE_KEY) === 'true') {
    console.log('[ScheduleBuilder]', ...args);
  }
}

function debugLogSearchChange(search, hikeTrailMapLen, filteredLen, sortedLen, assigned) {
  if (search !== prevSearch) {
    if (search) {
      console.clear();
      debugLog('search =', search, '| hikeTrailMap =', hikeTrailMapLen, '| filtered =', filteredLen, '| sorted =', sortedLen);
      if (assigned.length) debugLog('assignedHikes =', assigned);
    }
    prevSearch = search;
  }
}

function normalizeScheduleStore(store) {
  if (!store || typeof store !== 'object') return {};
  const normalized = {};
  Object.entries(store).forEach(([month, days]) => {
    normalized[month] = {};
    if (typeof days === 'object' && days !== null) {
      Object.entries(days).forEach(([day, val]) => {
        if (typeof val === 'string') {
          // Legacy format - trail ID as string
          normalized[month][day] = { trail_id: val, hike: null };
        } else if (val?.trail_id) {
          normalized[month][day] = { trail_id: val.trail_id, hike: val.hike || null };
        } else {
          normalized[month][day] = { trail_id: null, hike: null };
        }
      });
    }
  });
  return normalized;
}

export default function ScheduleBuilder() {
  const { trails, loading, lookup, schedule: scheduleData } = useTrails();
  const { filters, setFilters } = useFilters(trails);
  const trailDetails = useTrailDetails();
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    const nextMonth = (now.getMonth() + 1) % 12;
    return nextMonth;
  });
  const [scheduleStore, setScheduleStore] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(SCHEDULE_STORAGE_KEY));
      const normalized = normalizeScheduleStore(raw);
      if (JSON.stringify(normalized) !== JSON.stringify(raw)) {
        localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(normalized));
      }
      return normalized;
    } catch {
      return {};
    }
  });

  const assignedHikes = useMemo(() => {
    const raw = scheduleStore[MONTH_NAMES[selectedMonth]] || {};
    const result = {};
    Object.entries(raw).forEach(([day, val]) => {
      if (typeof val === 'string') {
        result[day] = { trail_id: val, hike: null };
      } else if (val && typeof val === 'object') {
        result[day] = { trail_id: typeof val.trail_id === 'string' ? val.trail_id : null, hike: val.hike || null };
      } else {
        result[day] = { trail_id: null, hike: null };
      }
    });
    return result;
  }, [scheduleStore, selectedMonth]);

  const [dragData, setDragData] = useState(null);
  const [showScheduled, setShowScheduled] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [debugMode, setDebugMode] = useState(() => {
    try {
      return localStorage.getItem(DEBUG_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showSettings && !e.target.closest('.relative')) {
        setShowSettings(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showSettings]);

  const updateMonthSchedule = useCallback((monthName, updater) => {
    setScheduleStore(prev => {
      const current = prev[monthName] || {};
      const next = updater(current);
      const newStore = { ...prev, [monthName]: next };
      localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(newStore));
      return newStore;
    });
  }, []);

  const year = 2026;

  const trailMap = useMemo(() => {
    const map = {};
    trails.forEach(t => {
      map[t.id] = t;
    });
    return map;
  }, [trails]);

  const trailIndexToId = useMemo(() => {
    const map = {};
    trails.forEach((t, idx) => {
      map[idx + 1] = t.id;
    });
    return map;
  }, [trails]);

const hikeTrailMap = useMemo(() => {
    const assignedSet = new Set(Object.values(assignedHikes).map(v => v?.trail_id).filter(Boolean));
    const result = [];
    trails.forEach((t, idx) => {
      if (assignedSet.has(t.id)) return;
      result.push({ hike: t.fullName || t.name, trail: t, hikeIndex: idx + 1, trailId: t.id });
    });
    if (localStorage.getItem(DEBUG_STORAGE_KEY) === 'true') {
      debugLog('trails =', trails.length, '| hikeTrailMap =', result.length);
    }
    return result;
  }, [trails, assignedHikes]);

  const filteredHikes = useMemo(() => {
    const filtered = filterTrails(hikeTrailMap, filters);
    const sorted = sortTrails(filtered, filters);
    if (debugMode) {
      const search = filters.search;
      const assigned = Object.values(assignedHikes).filter(Boolean);
      debugLogSearchChange(search, hikeTrailMap.length, filtered.length, sorted.length, assigned);
    }
    return sorted;
  }, [hikeTrailMap, filters, debugMode, assignedHikes]);

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
    return Object.values(assignedHikes).filter(v => v?.trail_id).length;
  }, [assignedHikes]);

  const handleDragStart = useCallback((hikeIndex, sourceDay, hikeName) => {
    setDragData({ hikeIndex, sourceDay, hikeName });
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragData(null);
  }, []);

  const scheduledCards = useMemo(() => {
    const daysInMonth = new Date(year, selectedMonth + 1, 0).getDate();
    const allDays = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, selectedMonth, day);
      if (date.getDay() === 3 || date.getDay() === 5) allDays.push(day);
    }
    return allDays
      .filter(day => assignedHikes[day]?.trail_id)
      .map(day => {
        const { trail_id: trailId, hike: hikeName } = assignedHikes[day];
        const trail = trailMap[trailId];
        if (!trail) return null;
        const hikeIdx = Object.entries(trailIndexToId).find(([, id]) => id === trailId);
        return (
          <div
            key={day}
            draggable
            onDragStart={() => hikeIdx && handleDragStart(Number(hikeIdx[0]), day, hikeName)}
            onDragEnd={handleDragEnd}
            className="cursor-grab active:cursor-grabbing"
          >
            <div className="relative">
              <TrailCard trail={trail} hikeName={hikeName} isActive={false} />
              <div className="absolute top-2 right-2 bg-green-600 text-white text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center flex-col leading-none">
                {day}
                <span className="text-[8px]">{new Date(year, selectedMonth, day).getDay() === 3 ? 'W' : 'F'}</span>
              </div>
              {debugMode && hikeIdx && (
                <div className="absolute top-2 left-2 bg-gray-700 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                  {hikeIdx[0]}
                </div>
              )}
            </div>
          </div>
        );
      })
      .filter(Boolean);
  }, [assignedHikes, trailMap, trailIndexToId, handleDragStart, handleDragEnd, debugMode, selectedMonth]);

  const handleDropOnDate = (targetDay) => {
    if (!dragData) return;

    const { hikeIndex, sourceDay, hikeName } = dragData;
    const trailId = trailIndexToId[hikeIndex] || dragData.trailId;

    if (sourceDay === targetDay) {
      setDragData(null);
      return;
    }

    if (!trailId) {
      setDragData(null);
      return;
    }

    updateMonthSchedule(MONTH_NAMES[selectedMonth], prev => {
      const next = { ...prev };
      if (sourceDay !== null && sourceDay !== undefined) {
        delete next[sourceDay];
      }
      next[targetDay] = { trail_id: trailId, hike: hikeName || null };
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

    updateMonthSchedule(MONTH_NAMES[selectedMonth], prev => {
      const next = { ...prev };
      delete next[sourceDay];
      return next;
    });
    setDragData(null);
  };

  const removeHike = (day) => {
    updateMonthSchedule(MONTH_NAMES[selectedMonth], prev => {
      const next = { ...prev };
      delete next[day];
      return next;
    });
  };

  const exportSchedule = () => {
    downloadBlob(JSON.stringify(scheduleStore, null, 2), `hiker-schedule-${new Date().toISOString().split('T')[0]}.json`);
  };

  const exportHikeEdits = () => {
    const editsStr = localStorage.getItem('hiker-trail-edits') || '{}';
    downloadBlob(editsStr, `trail-edits-${new Date().toISOString().split('T')[0]}.json`);
  };

  const importHikeEdits = () => {
    createImportFileInput(
      (imported) => {
        if (typeof imported !== 'object' || Array.isArray(imported)) {
          alert('Invalid edits file format');
          return;
        }
        localStorage.setItem('hiker-trail-edits', JSON.stringify(imported));
        alert('Hike edits imported successfully!');
      },
      (msg) => alert(msg)
    );
    setShowSettings(false);
  };

  const clearSchedule = () => {
    if (confirm('Clear all schedule data?')) {
      setScheduleStore({});
      localStorage.removeItem(SCHEDULE_STORAGE_KEY);
      setShowSettings(false);
    }
  };

  const importSchedule = () => {
    createImportFileInput(
      (imported) => {
        if (typeof imported !== 'object' || Array.isArray(imported)) {
          alert('Invalid schedule file format');
          return;
        }
        setScheduleStore(prev => {
          const merged = { ...prev, ...imported };
          const normalized = {};
          Object.entries(merged).forEach(([month, days]) => {
            normalized[month] = {};
            Object.entries(days).forEach(([day, val]) => {
              if (typeof val === 'string') {
                normalized[month][day] = { trail_id: val, hike: null };
              } else if (val?.trail_id) {
                normalized[month][day] = { trail_id: val.trail_id, hike: val.hike || null };
              } else {
                normalized[month][day] = { trail_id: null, hike: null };
              }
            });
          });
          localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(normalized));
          return normalized;
        });
        alert(`Imported ${Object.keys(imported).length} months of schedules`);
        setShowSettings(false);
      },
      (msg) => alert(msg)
    );
    setShowSettings(false);
  };

  const handleExport = () => {
    const month = MONTH_NAMES[selectedMonth];
    let output = `Over-the-Hill Hike Descriptions -- ${month}, ${year}\n`;

    for (const day of wedFriDates) {
      const { trail_id: trailId } = assignedHikes[day];
      const dayOfWeek = DAY_NAMES[new Date(year, selectedMonth, day).getDay()];

      if (!trailId) {
        output += `${dayOfWeek}, ${month} ${day}\tTBD\n\n`;
        continue;
      }

      const trail = trailMap[trailId];
      if (trail) {
        const detailsForTrail = getTrailDetailsById(trailDetails, trail.id);
        const report = generateReportText(trail, detailsForTrail);
        output += `${dayOfWeek}, ${month} ${day}\t${report}\n\n`;
      } else {
        output += `${dayOfWeek}, ${month} ${day}\tTBD\n\n`;
      }
    }

    downloadBlob(output, `${month.toLowerCase()}_${year}.txt`, 'text/plain');
  };

const hikeCards = useMemo(() => {
     return filteredHikes.reduce((cards, item) => {
       const trail = item.trail;
       if (!trail) return cards;
       cards.push(
        <div
          key={trail.id}
          draggable
          onDragStart={() => handleDragStart(item.hikeIndex, null, item.hike)}
          onDragEnd={handleDragEnd}
          className="cursor-grab active:cursor-grabbing"
        >
          <div className="relative">
            <TrailCard trail={trail} isActive={false} />
            {debugMode && (
              <div className="absolute top-2 left-2 bg-gray-700 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                {item.hikeIndex}
              </div>
            )}
          </div>
        </div>
      );
      return cards;
    }, []);
  }, [filteredHikes, handleDragStart, handleDragEnd, debugMode]);

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

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="container mx-auto px-4 py-3">
        <div className="mb-6 flex items-baseline gap-3">
          <h2 className="text-2xl font-bold text-gray-900">Schedule Builder</h2>
          <span className="text-gray-300">|</span>
          <Link to="/" className="text-green-700 hover:text-green-900 font-medium text-sm">
            Browse Trails
          </Link>
          <button
            onClick={() => setShowScheduled(!showScheduled)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              showScheduled
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Scheduled ({assignedCount})
          </button>
          <div className="relative">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
              title="Import/Export schedule"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </button>
            {showSettings && (
              <div className="absolute top-full right-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 p-2 min-w-[160px] z-50">
                <button
                  onClick={exportSchedule}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export All
                </button>
                <button
                  onClick={exportHikeEdits}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export Hike Edits
                </button>
                <button onClick={importHikeEdits} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Import Hike Edits
                </button>
                <button onClick={importSchedule} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Import
                </button>
                <button
                  onClick={() => {
                    const next = !debugMode;
                    setDebugMode(next);
                    localStorage.setItem(DEBUG_STORAGE_KEY, String(next));
                  }}
                  className={`w-full text-left px-3 py-2 text-sm rounded flex items-center gap-2 ${
                    debugMode
                      ? 'text-yellow-700 bg-yellow-50 hover:bg-yellow-100'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  Debug Mode {debugMode ? 'ON' : 'OFF'}
                </button>
                <button
                  onClick={clearSchedule}
                  className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Clear All Data
                </button>
              </div>
            )}
          </div>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-green-500 focus:border-green-500"
          >
             {MONTH_NAMES.map((name, idx) => {
                const monthAbbr = name.substring(0, 3);
                const count = scheduleData[monthAbbr] ? Object.keys(scheduleData[monthAbbr]).length : 0;
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

        <FilterPanel 
          filters={filters}
          setFilters={setFilters}
          lookup={lookup}
          resetFilters={() => setFilters({ ...DEFAULT_FILTERS })}
        />

        {/* Scheduled Hikes Section */}
        {showScheduled && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-4">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-800">
                Assigned Hikes ({scheduledCards.length})
              </h3>
            </div>
            <div className="p-4">
              {scheduledCards.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No hikes assigned yet</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {scheduledCards}
                </div>
              )}
            </div>
          </div>
        )}

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
                  {year} — Wed/Fri Dates
                </h3>
              </div>
              <div className="p-4">
                <div className="space-y-3">
                  {wedFriDates.map((day) => {
                    const dayOfWeek = DAY_NAMES[new Date(year, selectedMonth, day).getDay()];
const { trail_id: trailId, hike: hikeName } = assignedHikes[day] || { trail_id: null, hike: null };
                    const trail = trailMap[trailId];

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
                          trailId
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
                            {trailId && trail ? (
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-900 truncate">
                                  {hikeName || trail.fullName || trail.name}
                                </div>
                                <div className="text-xs text-gray-500 truncate">
                                  (ID: {trailId})
                                </div>
                              </div>
                            ) : trailId ? (
                              <div className="text-sm text-gray-400 italic">
                                Trail not found (ID: {trailId})
                              </div>
                            ) : (
                              <div className="text-sm text-gray-400 italic">
                                Drop hike here
                              </div>
                            )}
                          </div>
                          {trailId && (
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
