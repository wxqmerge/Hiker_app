import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useTrails, useFilters } from '../hooks/useTrails';
import { useSchedulePolling } from '../hooks/useSchedulePolling';
import PageNav from '../components/PageNav';
import FilterPanel from '../components/FilterPanel';
import TrailCard from '../components/TrailCard';
import { MONTH_NAMES, DAY_NAMES, DEFAULT_FILTERS, MONTH_ABBR_TO_FULL, MONTH_FULL_TO_ABBR } from '../utils/constants';
import { filterTrails, sortTrails } from '../utils/filterTrails';
import { generateReportText } from '../utils/report';
import { getTrailDetailsById, findTrailById as findTrailByIdUtil } from '../utils/data';
import { downloadBlob, createFileInput } from '../utils/io';
import { importScheduleFromXls, updateSchedule, getScheduleHistory, restoreSchedule, getSchedule, getTrails } from '../api/client';
import { useTrailDetails } from '../hooks/useTrailDetails';
import { setSchedule } from '../hooks/useTrailStore';

// Convert server schedule format to client format
function serverScheduleToStore(serverData) {
  const store = {};
  if (!serverData) return store;
  for (const [key, entries] of Object.entries(serverData)) {
    // Abbreviation → full name, or already full name
    const fullName = MONTH_ABBR_TO_FULL[key] || (MONTH_NAMES.includes(key) ? key : null);
    if (!fullName || !Array.isArray(entries)) continue;
    store[fullName] = {};
    for (const entry of entries) {
      const day = String(entry.day);
      if (day === 'NaN' || day === 'null' || day === 'undefined') continue;
      store[fullName][day] = { trail_id: entry.trail_id || null, hike: entry.hike || null, early_start: !!entry.early_start };
    }
  }
  return store;
}

// Convert client store format back to server format
function storeToServerSchedule(store) {
  const serverData = {};
  for (const [fullName, days] of Object.entries(store)) {
    const abbr = MONTH_FULL_TO_ABBR[fullName];
    if (!abbr || !days || typeof days !== 'object') continue;
    serverData[abbr] = [];
    for (const [day, entry] of Object.entries(days)) {
      if (entry?.trail_id) {
        const dayNum = parseInt(day, 10);
        if (!isNaN(dayNum) && dayNum > 0) {
          serverData[abbr].push({ day: dayNum, hike: entry.hike || '', trail_id: entry.trail_id, early_start: !!entry.early_start });
        }
      }
    }
    serverData[abbr].sort((a, b) => a.day - b.day);
  }
  return serverData;
}

const DEBUG_STORAGE_KEY = 'hiker-schedule-debug';
let prevSearch = null;

function debugLog(...args) {
  console.log('[ScheduleBuilder]', ...args);
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


export default function ScheduleBuilder() {
  const { trails, loading, lookup, schedule: scheduleData } = useTrails();
  const { filters, setFilters } = useFilters(trails);
  const trailDetails = useTrailDetails();
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    const nextMonth = (now.getMonth() + 1) % 12;
    return nextMonth;
  });
  const [isSaving, setIsSaving] = useState(false); // eslint-disable-line no-unused-vars
  const [hasApiKey, setHasApiKey] = useState(() => !!localStorage.getItem('hiker-api-key')); // eslint-disable-line no-unused-vars
  const [scheduleStore, setScheduleStore] = useState(() => {
    return {};
  });
  // Load server schedule into local store on mount
  useEffect(() => {
    if (scheduleData && Object.keys(scheduleData).length > 0) {
      const converted = serverScheduleToStore(scheduleData);
      setScheduleStore(converted);
      lastSavedStoreRef.current = JSON.stringify(converted);
    }
  }, [scheduleData]);

  useSchedulePolling({ setSchedule }, 5000);

  useEffect(() => {
    const hostname = window.location.hostname;
    const path = window.location.pathname;
    let healthUrl;
    if (hostname.endsWith('.example.com')) {
      healthUrl = `https://${hostname}/health`;
    } else {
      const match = path.match(/^\/(sothh-[\w-]+)/);
      if (match) {
        healthUrl = `https://${match[1]}.example.com/health`;
      } else {
        healthUrl = '/health';
      }
    }
    fetch(healthUrl)
      .then(r => r.json())
      .then(data => {
        console.log('[ScheduleBuilder] Server health:', data.status, 'Build:', data.build?.full);
      })
      .catch(e => console.error('[ScheduleBuilder] Health check failed:', e));
  }, []);

  // Save schedule to server (debounced 1s)
  const saveTimeoutRef = useRef(null);
  const lastSavedStoreRef = useRef(null);
  const saveScheduleToServer = useCallback(async () => {
    const currentStoreJson = JSON.stringify(scheduleStore);
    if (lastSavedStoreRef.current === currentStoreJson) {
      return;
    }
    lastSavedStoreRef.current = currentStoreJson;
    const serverData = storeToServerSchedule(scheduleStore);
    const entryCount = Object.values(serverData).reduce((sum, entries) => sum + (Array.isArray(entries) ? entries.length : 0), 0);
    try {
      setIsSaving(true);
      console.log('[ScheduleBuilder] Saving schedule:', entryCount, 'entries');
      const result = await updateSchedule(serverData);
      console.log('[ScheduleBuilder] Save successful, ETag:', result?.etag);
      return result;
    } catch (err) {
      console.error('[ScheduleBuilder] Failed to save schedule:', err);
      alert('Failed to save schedule to server: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  }, [scheduleStore]);

  useEffect(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveScheduleToServer();
    }, 1000);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [scheduleStore, saveScheduleToServer]);

  const assignedHikes = useMemo(() => {
    const raw = scheduleStore[MONTH_NAMES[selectedMonth]] || {};
    const result = {};
    Object.entries(raw).forEach(([day, val]) => {
      if (typeof val === 'string') {
        result[day] = { trail_id: val, hike: null, early_start: false };
      } else if (val && typeof val === 'object') {
        result[day] = { trail_id: typeof val.trail_id === 'string' ? val.trail_id : null, hike: val.hike || null, early_start: !!val.early_start };
      } else {
        result[day] = { trail_id: null, hike: null, early_start: false };
      }
    });
    return result;
  }, [scheduleStore, selectedMonth]);

  const [dragData, setDragData] = useState(null);
  const [showScheduled, setShowScheduled] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyEntries, setHistoryEntries] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [debugMode, setDebugMode] = useState(false);

  const hikeTrailMap = useMemo(() => {
    const scheduleIds = Object.values(assignedHikes).map(v => v?.trail_id).filter(Boolean);
    const result = [];
    trails.forEach((t, idx) => {
      let isScheduled = false;
      for (const sid of scheduleIds) {
        if (sid === t.id) { isScheduled = true; break; }
        if (sid.toLowerCase() === t.id.toLowerCase()) { isScheduled = true; break; }
      }
      if (isScheduled) return;
      result.push({ hike: t.fullName || t.name, trail: t, hikeIndex: idx + 1, trailId: t.id });
    });
    if (debugMode) {
      debugLog('trails =', trails.length, '| hikeTrailMap =', result.length);
    }
    return result;
  }, [trails, assignedHikes, debugMode]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showSettings && !e.target.closest('.relative')) {
        setShowSettings(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showSettings]);

  const updateMonthSchedule = useCallback(async (monthName, updater) => {
    setScheduleStore(prev => {
      const current = prev[monthName] || {};
      const next = updater(current);
      const newStore = { ...prev, [monthName]: next };
      return newStore;
    });
    const serverData = storeToServerSchedule(scheduleStore);
    const currentStore = scheduleStore;
    const current = currentStore[monthName] || {};
    const next = updater(current);
    const abbr = MONTH_FULL_TO_ABBR[monthName];
    if (abbr && serverData[abbr]) {
      serverData[abbr] = [];
      for (const [day, entry] of Object.entries(next)) {
        if (entry?.trail_id) {
          const dayNum = parseInt(day, 10);
          if (!isNaN(dayNum) && dayNum > 0) {
            serverData[abbr].push({ day: dayNum, hike: entry.hike || '', trail_id: entry.trail_id, early_start: !!entry.early_start });
          }
        }
      }
      serverData[abbr].sort((a, b) => a.day - b.day);
    }
    try {
      await updateSchedule(serverData);
      lastSavedStoreRef.current = JSON.stringify(scheduleStore);
    } catch (error) {
      console.error('[ScheduleBuilder] Auto-save failed:', error);
    }
  }, [scheduleStore]);

  const year = 2026;

  const findTrailById = useCallback((trailId) => findTrailByIdUtil(trails, trailId), [trails]);

  const trailIndexToId = useMemo(() => {
    const map = {};
    trails.forEach((t, idx) => {
      map[idx + 1] = t.id;
    });
    return map;
  }, [trails]);



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
        const { trail_id: trailId, hike: hikeName, early_start: earlyStart } = assignedHikes[day];
        const trail = findTrailById(trailId);
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
              <TrailCard trail={trail} hikeName={trail.fullName || trail.name} isActive={false} />
              <div className="absolute top-2 right-2 bg-green-600 text-white text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center flex-col leading-none">
                {day}
                <span className="text-[8px]">{new Date(year, selectedMonth, day).getDay() === 3 ? 'W' : 'F'}</span>
              </div>
              {earlyStart && (
                <div className="absolute top-2 left-2 bg-orange-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center" title="Early Start">
                  ⏰
                </div>
              )}
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
  }, [assignedHikes, trailIndexToId, handleDragStart, handleDragEnd, debugMode, selectedMonth, findTrailById, year]);

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

    const monthName = MONTH_NAMES[selectedMonth];
    const targetEntry = (scheduleStore[monthName] || {})[targetDay];

    // Check if target day already has a hike – offer swap
    if (targetEntry && targetEntry.trail_id) {
      const sourceTrail = findTrailById(trailId);
      const targetTrail = findTrailById(targetEntry.trail_id);
      const sourceTrailName = sourceTrail ? (sourceTrail.fullName || sourceTrail.name) : hikeName || trailId;
      const targetTrailName = targetTrail ? (targetTrail.fullName || targetTrail.name) : targetEntry.hike || targetEntry.trail_id;
      const sourceDayOfWeek = new Date(year, selectedMonth, sourceDay).getDay();
      const targetDayOfWeek = new Date(year, selectedMonth, targetDay).getDay();
      const sourceDayLabel = `${DAY_NAMES[sourceDayOfWeek]} ${sourceDay}`;
      const targetDayLabel = `${DAY_NAMES[targetDayOfWeek]} ${targetDay}`;

      if (!confirm(`Swap "${sourceTrailName}" (${sourceDayLabel}) with "${targetTrailName}" (${targetDayLabel})?`)) {
        setDragData(null);
        return;
      }

      // Swap: source hike goes to target day, target hike goes to source day
      const sourceEntry = sourceDay !== null && sourceDay !== undefined ? (scheduleStore[monthName] || {})[sourceDay] : null;
      const sourceEarlyStart = sourceEntry?.early_start || false;

      updateMonthSchedule(monthName, prev => {
        const next = { ...prev };
        next[targetDay] = { trail_id: trailId, hike: hikeName || null, early_start: sourceEarlyStart };
        if (sourceDay !== null && sourceDay !== undefined) {
          next[sourceDay] = { trail_id: targetEntry.trail_id, hike: targetEntry.hike || null, early_start: targetEntry.early_start };
        }
        return next;
      });
      setDragData(null);
      return;
    }

    // Normal drop on empty date
    const sourceEntry = sourceDay !== null && sourceDay !== undefined ? (scheduleStore[monthName] || {})[sourceDay] : null;
    const earlyStart = sourceEntry?.early_start || false;

    updateMonthSchedule(monthName, prev => {
      const next = { ...prev };
      if (sourceDay !== null && sourceDay !== undefined) {
        delete next[sourceDay];
      }
      next[targetDay] = { trail_id: trailId, hike: hikeName || null, early_start: earlyStart };
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

  const clearSchedule = () => {
    if (confirm('Clear all schedule data?')) {
      setScheduleStore({});
      setShowSettings(false);
    }
  };

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const entries = await getScheduleHistory();
      setHistoryEntries(entries);
    } catch (err) {
      console.error('[ScheduleBuilder] Failed to load history:', err);
      alert('Failed to load schedule history: ' + err.message);
    } finally {
      setLoadingHistory(false);
    }
  };

  const openHistory = () => {
    setShowHistory(true);
    setShowSettings(false);
    loadHistory();
  };

  const closeHistory = () => {
    setShowHistory(false);
  };

  const handleRestore = async (timestamp) => {
    const entry = historyEntries.find(e => e.timestamp === timestamp);
    const dateStr = entry ? new Date(timestamp).toLocaleString() : '';
    if (!confirm(`Restore schedule from ${dateStr}?\nThis will replace your current schedule.`)) return;
    try {
      const result = await restoreSchedule(timestamp);
      if (result.success) {
        closeHistory();
        alert('Schedule restored successfully.');
      }
    } catch (err) {
      alert('Restore failed: ' + err.message);
    }
  };

  const handleClearCurrentSchedule = async () => {
    if (!confirm('Clear the current schedule? Your history will be preserved.')) return;
    try {
      await updateSchedule({});
      closeHistory();
    } catch (err) {
      alert('Clear failed: ' + err.message);
    }
  };

  const verifyServerSchedule = async () => {
    try {
      const [serverData, serverTrails] = await Promise.all([getSchedule(), getTrails()]);
      const local = storeToServerSchedule(scheduleStore);

      // Normalize both to abbreviations for comparison
      const serverEntries = Object.entries(serverData).flatMap(([m, entries]) => {
        const abbr = MONTH_FULL_TO_ABBR[m] || m;
        if (Array.isArray(entries)) {
          return entries.map(e => `${abbr}:${e.day}:${e.trail_id}`);
        }
        return Object.entries(entries).map(([day, entry]) => `${abbr}:${day}:${entry.trail_id}`);
      });
      const localEntries = Object.entries(local).flatMap(([m, entries]) => entries.map(e => `${m}:${e.day}:${e.trail_id}`));

      const serverSet = new Set(serverEntries);
      const localSet = new Set(localEntries);

      const missingOnServer = localEntries.filter(e => !serverSet.has(e));
      const extraOnServer = serverEntries.filter(e => !localSet.has(e));

      // Compare trails
      const localTrailIds = new Set(trails.map(t => t.id));
      const serverTrailIds = new Set(serverTrails.map(t => t.id));
      const missingTrails = [...localTrailIds].filter(id => !serverTrailIds.has(id));
      const extraTrails = [...serverTrailIds].filter(id => !localTrailIds.has(id));

      const schedulesMatch = missingOnServer.length === 0 && extraOnServer.length === 0;
      const trailsMatch = missingTrails.length === 0 && extraTrails.length === 0;

      const result = { schedulesMatch, trailsMatch, serverEntries: serverEntries.length, localEntries: localEntries.length, serverTrails: serverTrails.length, localTrails: trails.length, missingOnServer, extraOnServer, missingTrails, extraTrails };
        console.log('[Verify Pushed to Server]', result);

        if (schedulesMatch && trailsMatch) {
        alert('✓ Local matches server.\n\nSchedule: ' + serverEntries.length + ' entries\nTrails: ' + serverTrails.length + ' trails');
      } else {
        let msg = '⚠ Local differs from server!\n\n';
        msg += 'Schedule — Server: ' + serverEntries.length + ' | Local: ' + localEntries.length + ' entries\n';
        msg += 'Trails — Server: ' + serverTrails.length + ' | Local: ' + trails.length + '\n\n';
        if (missingOnServer.length > 0) {
          msg += missingOnServer.length + ' schedule entry(ies) NOT on server:\n' + missingOnServer.slice(0, 5).join('\n');
          if (missingOnServer.length > 5) msg += '\n...and ' + (missingOnServer.length - 5) + ' more';
        }
        if (extraOnServer.length > 0) {
          msg += '\n\n' + extraOnServer.length + ' schedule entry(ies) NOT in local:\n' + extraOnServer.slice(0, 5).join('\n');
          if (extraOnServer.length > 5) msg += '\n...and ' + (extraOnServer.length - 5) + ' more';
        }
        if (missingTrails.length > 0) {
          msg += '\n\n' + missingTrails.length + ' trail(s) NOT on server:\n' + missingTrails.slice(0, 5).join('\n');
          if (missingTrails.length > 5) msg += '\n...and ' + (missingTrails.length - 5) + ' more';
        }
        if (extraTrails.length > 0) {
          msg += '\n\n' + extraTrails.length + ' trail(s) NOT in local:\n' + extraTrails.slice(0, 5).join('\n');
          if (extraTrails.length > 5) msg += '\n...and ' + (extraTrails.length - 5) + ' more';
        }
        alert(msg);
      }
    } catch (err) {
      alert('Failed to verify: ' + err.message);
    }
  };

  const toggleEarlyStart = (day) => {
    const entry = (scheduleStore[MONTH_NAMES[selectedMonth]] || {})[day];
    if (!entry) return;
    updateMonthSchedule(MONTH_NAMES[selectedMonth], prev => {
      const next = { ...prev };
      next[day] = { ...entry, early_start: !entry.early_start };
      return next;
    });
  };

  const importFromExcel = () => {
    createFileInput({
      accept: '.xls,.xlsx',
      onFile: async (file) => {
        try {
          const result = await importScheduleFromXls(file);
          if (!result.success) {
            alert('Import failed: ' + (result.error?.message || 'Unknown error'));
            return;
          }
          const serverData = storeToServerSchedule(scheduleStore);
          const excelData = result.schedule || {};
          for (const [month, entries] of Object.entries(excelData)) {
            const abbr = MONTH_FULL_TO_ABBR[month] || month;
            if (!serverData[abbr]) serverData[abbr] = [];
            const existingDays = new Set(serverData[abbr].map(e => e.day));
            for (const entry of entries) {
              if (!existingDays.has(entry.day) && entry.trail_id) {
                serverData[abbr].push({ day: entry.day, hike: entry.hike || '', trail_id: entry.trail_id, early_start: !!entry.early_start });
              }
            }
            serverData[abbr].sort((a, b) => a.day - b.day);
          }
          await updateSchedule(serverData);
          if (result.months.length > 0) {
            const firstMonth = MONTH_NAMES.indexOf(result.months[0]);
            if (firstMonth >= 0) setSelectedMonth(firstMonth);
          }
          let msg = `Imported ${result.matched} hikes across ${result.months.length} month(s): ${result.months.join(', ')}.\n`;
          if (result.unmatched > 0) {
            msg += `\n${result.unmatched} hike(s) could not be matched to a trail.\n`;
            if (result.unmatchedDetails?.length) {
              msg += 'Unmatched: ' + result.unmatchedDetails.slice(0, 5).map(u => u.hike).join(', ');
              if (result.unmatched > 5) msg += '...';
            }
          }
          alert(msg);
        } catch (err) {
          alert('Import error: ' + err.message);
        }
      },
      onCleanup: () => setShowSettings(false),
    });
  };

  const getQuarterForMonth = (monthIndex) => {
    // Calendar quarters: Q1=Jan/Feb/Mar, Q2=Apr/May/Jun, Q3=Jul/Aug/Sep, Q4=Oct/Nov/Dec
    if (monthIndex >= 0 && monthIndex <= 2) return { q: '1', months: ['Jan', 'Feb', 'Mar'], label: '1st Quarter' };
    if (monthIndex >= 3 && monthIndex <= 5) return { q: '2', months: ['Apr', 'May', 'Jun'], label: '2nd Quarter' };
    if (monthIndex >= 6 && monthIndex <= 8) return { q: '3', months: ['Jul', 'Aug', 'Sep'], label: '3rd Quarter' };
    return { q: '4', months: ['Oct', 'Nov', 'Dec'], label: '4th Quarter' };
  };

  const getQuarterYear = () => year;

  const exportExcelSchedule = () => {
    const quarter = getQuarterForMonth(selectedMonth);
    const qYear = getQuarterYear(selectedMonth);

    // Collect all Wed and Fri hikes for the quarter
    const wedHikes = [];
    const friHikes = [];

    for (const monthAbbr of quarter.months) {
      const monthIndex = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(monthAbbr);
      const daysInMonth = new Date(qYear, monthIndex + 1, 0).getDate();
      const monthKey = MONTH_NAMES[monthIndex];
      const monthData = scheduleStore[monthKey] || {};

      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(qYear, monthIndex, day);
        const dayOfWeek = date.getDay();
        const entry = monthData[String(day)];
        if (!entry || !entry.trail_id) continue;

        const trail = findTrailById(entry.trail_id);
        let hikeName = trail ? trail.fullName || trail.name : entry.trail_id;
        if (entry.early_start) hikeName += ' (Early Start)';

        if (dayOfWeek === 3) {
          wedHikes.push({ month: monthAbbr, day, hike: hikeName });
        } else if (dayOfWeek === 5) {
          friHikes.push({ month: monthAbbr, day, hike: hikeName });
        }
      }
    }

    // Build TSV matching Excel layout
    const cols = 10;
    const pad = (arr, len) => {
      while (arr.length < len) arr.push('');
      return arr;
    };

    let rows = [];

    // Row 0: title
    rows.push(pad(['', '', quarter.label + ' Hikes ' + qYear], cols));
    rows.push(pad([], cols));
    rows.push(pad([], cols));

    // Row 3: headers
    rows.push(pad(['Month', 'Wed', 'Hike', 'Leader / Shadow', '', 'Month', 'Fri', 'Hike', 'Leader / Shadow'], cols));

    // Interleave Wed/Fri rows by month
    const wedByMonth = {};
    const friByMonth = {};
    for (const m of quarter.months) {
      wedByMonth[m] = wedHikes.filter(h => h.month === m);
      friByMonth[m] = friHikes.filter(h => h.month === m);
    }

    for (const month of quarter.months) {
      const weds = wedByMonth[month];
      const fris = friByMonth[month];
      const maxRows = Math.max(weds.length, fris.length);

      for (let i = 0; i < maxRows; i++) {
        const w = weds[i];
        const f = fris[i];
        const row = [];

        // Left side (Wed)
        if (i === 0) row.push(month);
        else row.push('');
        row.push(w ? String(w.day) : '');
        row.push(w ? w.hike : '');
        row.push('');

        // Spacer
        row.push('');

        // Right side (Fri)
        if (i === 0) row.push(month);
        else row.push('');
        row.push(f ? String(f.day) : '');
        row.push(f ? f.hike : '');
        row.push('');

        rows.push(pad(row, cols));
      }
    }

    // Alternate hikes section
    rows.push(pad([], cols));
    rows.push(pad(['', '', 'Alternate Wednesday Hike', '', '', '', 'Alternate Friday Hike', '', ''], cols));

    const tsv = rows.map(r => r.join('\t')).join('\n');
    downloadBlob(tsv, `${quarter.q}Q${qYear.toString().slice(2)}_hikes.tsv`, 'text/tab-separated-values');
  };

  const handleExport = () => {
    const month = MONTH_NAMES[selectedMonth];
    let output = `Over-the-Hill Hike Descriptions -- ${month}, ${year}\n`;

    for (const day of wedFriDates) {
      const { trail_id: trailId, early_start: earlyStart } = assignedHikes[day] || { trail_id: null, early_start: false };
      const dayOfWeek = DAY_NAMES[new Date(year, selectedMonth, day).getDay()];

      if (!trailId) {
        output += `${dayOfWeek}, ${month} ${day}\tTBD\n\n`;
        continue;
      }

      const trail = findTrailById(trailId);
      if (trail) {
        const detailsForTrail = getTrailDetailsById(trailDetails, trail.id);
        let report = generateReportText(trail, detailsForTrail);
        if (earlyStart) report += ' (Early Start)';
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
          key={`${trail.id}-${item.hikeIndex}`}
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
          <PageNav />
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
                    onClick={handleExport}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0l-4 4m4-4v12" />
                    </svg>
                    Export Monthly Description
                  </button>
               <button onClick={exportExcelSchedule} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export Quarterly Schedule
                </button>
                <button onClick={importFromExcel} disabled={!hasApiKey} className={`w-full text-left px-3 py-2 text-sm rounded flex items-center gap-2 ${hasApiKey ? 'text-gray-700 hover:bg-gray-100' : 'text-gray-300 cursor-not-allowed'}`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Import Excel Schedule {!hasApiKey && '(need API key)'}
                </button>
                <button onClick={openHistory} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Schedule History
                </button>
                <button onClick={verifyServerSchedule} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Verify Pushed to Server
                </button>
                <button
                   onClick={() => setDebugMode(!debugMode)}
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
            onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-green-500 focus:border-green-500"
          >
             {MONTH_NAMES.map((name, idx) => {
                 const monthAbbr = name.substring(0, 3);
                 const localCount = scheduleStore[name] ? Object.keys(scheduleStore[name]).length : 0;
                 const serverCount = scheduleData[monthAbbr] ? Object.keys(scheduleData[monthAbbr]).length : 0;
                 const count = Math.max(localCount, serverCount);
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

        {/* Schedule History Panel */}
        {showHistory && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-4">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800">
                Schedule History ({historyEntries.length})
              </h3>
              <div className="flex items-center gap-2">
                <button onClick={handleClearCurrentSchedule} disabled={!hasApiKey} className={`text-xs font-medium px-2 py-1 rounded transition-colors ${hasApiKey ? 'text-red-600 hover:bg-red-50' : 'text-gray-300 cursor-not-allowed'}`}>
                  Clear Schedule
                </button>
                <button onClick={closeHistory} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-4">
              {loadingHistory ? (
                <p className="text-sm text-gray-500 text-center py-4">Loading history...</p>
              ) : historyEntries.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No saved history yet. History is created automatically when you modify your schedule.</p>
              ) : (
                <div className="space-y-2">
                  {historyEntries.map((entry) => {
                    const date = new Date(entry.timestamp);
                    const dateStr = date.toLocaleDateString();
                    const timeStr = date.toLocaleTimeString();
                    const monthSummary = entry.months?.length ? `${entry.months.join(', ')} (${entry.entryCount})` : 'empty';
                    return (
                      <div key={entry.timestamp} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{dateStr} at {timeStr}</div>
                          <div className="text-xs text-gray-500">{monthSummary} scheduled entries</div>
                        </div>
                        <button
                          onClick={() => handleRestore(entry.timestamp)}
                          disabled={!hasApiKey}
                          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                            hasApiKey
                              ? 'bg-green-600 text-white hover:bg-green-700'
                              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          Restore
                        </button>
                      </div>
                    );
                  })}
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
                  {MONTH_NAMES[selectedMonth]} {year} — Wed/Fri Dates
                </h3>
              </div>
              <div className="p-4">
                <div className="space-y-3">
                  {wedFriDates.map((day) => {
                    const dayOfWeek = DAY_NAMES[new Date(year, selectedMonth, day).getDay()];
                    const { trail_id: trailId, hike: hikeName, early_start: earlyStart } = assignedHikes[day] || { trail_id: null, hike: null, early_start: false };
                    const trail = findTrailById(trailId);

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
                                  {trail ? trail.fullName || trail.name : hikeName}
                                  {earlyStart && <span className="ml-1 text-orange-500" title="Early Start">⏰</span>}
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
                            <div className="flex items-center gap-1 ml-3">
                              <label className="flex items-center gap-1 cursor-pointer" title="Early Start">
                                <input
                                  type="checkbox"
                                  checked={!!earlyStart}
                                  onChange={() => toggleEarlyStart(day)}
                                  className="w-4 h-4 text-orange-500 rounded"
                                />
                                <span className="text-xs text-gray-500">ES</span>
                              </label>
                              <button
                                onClick={() => removeHike(day)}
                                className="text-red-400 hover:text-red-600 transition-colors"
                                title="Remove hike"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
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

 
      </main>
    </div>
  );
}
