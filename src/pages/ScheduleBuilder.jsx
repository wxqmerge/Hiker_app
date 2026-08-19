import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTrails } from '../hooks/useTrails';
import { useFilters } from '../hooks/useFilters';
import { useSchedulePolling } from '../hooks/useSchedulePolling';
import { useTooltips } from '../hooks/useTooltips';
import { useApiKey } from '../hooks/useApiKey';

import FilterPanel from '../components/FilterPanel';
import { useMonthContext } from '../contexts/MonthContext';
import { useScheduleSettings } from '../contexts/ScheduleSettingsContext';
import { getTrailName } from '../utils/data';
import TrailCard from '../components/TrailCard';
import LoadingSpinner from '../components/LoadingSpinner';
import SwapConfirmationModal from '../components/SwapConfirmationModal';
import { MONTH_NAMES, DAY_NAMES, DEFAULT_FILTERS, MONTH_ABBR_TO_FULL, MONTH_FULL_TO_ABBR, CURRENT_YEAR } from '../utils/constants';
import { useToast } from '../hooks/useToast';
import ConfirmDialog from '../components/ConfirmDialog';
import LeaderEdit from '../components/LeaderEdit';
import { filterTrails, sortTrails } from '../utils/filterTrails';
import { generateReportHtml } from '../utils/report';
import { downloadBlob, createFileInput, openGoogleMapsTrailhead, fetchWeatherAndTide, openHtmlInNewTab } from '../utils/io';
import { getGroupName } from '../utils/config';
import { getNoaaTideUrl } from '../utils/url.js';
import { importScheduleFromXls, updateSchedule, getScheduleHistory, restoreSchedule, getSchedule, getTrails, reloadSchedule, getGpx } from '../api/client';
import { useTrailDetails } from '../hooks/useTrailDetails';
import { useScheduleData } from '../hooks/useScheduleData';
import { useScheduleDragDrop } from '../hooks/useScheduleDragDrop';
import { serverScheduleToStore, storeToServerSchedule } from '../utils/scheduleFormat';
import { updateLeader } from '../utils/scheduleActions';
import { getDayName, getHikeDaysLabel, getHikeDays } from '../utils/config';
import { createDate, getTodayHikeRef, getHikeDaysForMonth } from '../utils/dateUtils';

import { setSchedule } from '../hooks/useTrailStore';


async function loadSchedule() {
  const data = await getSchedule();
  setSchedule(data);
}

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
  const trailDetails = useTrailDetails();
  const navigate = useNavigate();
  const { filters, setFilters } = useFilters(trails, trailDetails);
  const { title: tt } = useTooltips();
  const { selectedMonth, setSelectedMonth } = useMonthContext();
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const savedTimeoutRef = useRef(null);
  const doTsvImportRef = useRef(null);
  const showToast = useToast();
  const [debugMode, setDebugMode] = useState(false);
  const hasApiKey = useApiKey();
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
      setSaveStatus('saving');
      if (debugMode) console.log('[ScheduleBuilder] Saving schedule:', entryCount, 'entries');
      const result = await updateSchedule(serverData);
      if (debugMode) console.log('[ScheduleBuilder] Save successful, ETag:', result?.etag);
      setSaveStatus('saved');
      showToast('Schedule saved', 'success');
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
      savedTimeoutRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
      return result;
    } catch (err) {
      console.error('[ScheduleBuilder] Failed to save schedule:', err);
      setSaveStatus('error');
      showToast('Failed to save schedule: ' + err.message, 'error');
    }
  }, [scheduleStore, debugMode, showToast]);

  useEffect(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveScheduleToServer();
    }, 1000);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [scheduleStore, saveScheduleToServer]);

  const [pendingSwap, setPendingSwap] = useState(null);
  const year = CURRENT_YEAR;

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

  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyEntries, setHistoryEntries] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [gpxDownloading, setGpxDownloading] = useState(null);
  const [weatherMap, setWeatherMap] = useState({});
  const [fetchingWeather, setFetchingWeather] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [pendingRestore, setPendingRestore] = useState(null);
  const [confirmClearCurrent, setConfirmClearCurrent] = useState(false);
  const [pendingTsvImport, setPendingTsvImport] = useState(null);
  const [leaderEdit, setLeaderEdit] = useState(null);



  const handleGpxDownload = useCallback(async (trailId, trailName) => {
    if (gpxDownloading) return;
    setGpxDownloading(trailId);
    try {
      const gpx = await getGpx(trailId);
      if (gpx) {
        const safeName = (trailName || 'route').replace(/[^a-zA-Z0-9]/g, '_');
        downloadBlob(gpx, `${safeName}.gpx`, 'application/gpx+xml');
      }
    } finally {
      setTimeout(() => setGpxDownloading(null), 1000);
    }
  }, [gpxDownloading]);

  const handleTrailhead = useCallback((trailId) => {
    const trail = trails.find(t => t.id === trailId);
    if (trail?.trailHeadLat != null && trail?.trailHeadLon != null) {
      openGoogleMapsTrailhead(trail.trailHeadLat, trail.trailHeadLon);
    }
  }, [trails]);

  const hikeTrailMap = useMemo(() => {
    const scheduleIds = Object.values(assignedHikes).flat().map(v => v?.trail_id).filter(Boolean);
    const scheduledSet = new Set(scheduleIds.map(id => id.toLowerCase()));
    const result = [];
    trails.forEach((t, idx) => {
      if (scheduledSet.has(t.id.toLowerCase())) return;
      result.push({ hike: getTrailName(t), trail: t, hikeIndex: idx + 1, trailId: t.id });
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

  const updateMonthSchedule = useCallback((monthName, updater) => {
    setScheduleStore(prev => {
      const current = prev[monthName] || {};
      const next = updater(current);
      return { ...prev, [monthName]: next };
    });
  }, []);

  const filteredHikes = useMemo(() => {
    const filtered = filterTrails(hikeTrailMap, filters, trailDetails);
    const sorted = sortTrails(filtered, filters, trailDetails);
    if (debugMode) {
      const search = filters.search;
      const assigned = Object.values(assignedHikes).filter(Boolean);
      debugLogSearchChange(search, hikeTrailMap.length, filtered.length, sorted.length, assigned);
    }
    return sorted;
  }, [hikeTrailMap, filters, debugMode, assignedHikes, trailDetails]);

  const {
    confirmSwap,
    cancelSwap,
    handleDropOnDate,
    handleDropOnAvailable,
    removeHike,
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

  const clearSchedule = useCallback(() => {
    setConfirmClear(true);
  }, []);

  const doClearSchedule = useCallback(() => {
    setScheduleStore({});
    setShowSettings(false);
    setConfirmClear(false);
  }, []);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const entries = await getScheduleHistory();
      setHistoryEntries(entries);
    } catch (err) {
      console.error('[ScheduleBuilder] Failed to load history:', err);
      showToast('Failed to load schedule history: ' + err.message, 'error');
    } finally {
      setLoadingHistory(false);
    }
  }, [showToast]);

  const openHistory = useCallback(() => {
    setShowHistory(true);
    setShowSettings(false);
    loadHistory();
  }, [loadHistory]);

  const closeHistory = () => {
    setShowHistory(false);
  };

  const handleRestore = (timestamp) => {
    setPendingRestore(timestamp);
  };

  const doRestore = async (timestamp) => {
    setPendingRestore(null);
    try {
      const result = await restoreSchedule(timestamp);
      if (result.success) {
        closeHistory();
        showToast('Schedule restored successfully.', 'success');
      }
    } catch (err) {
      showToast('Restore failed: ' + err.message, 'error');
    }
  };

  const handleClearCurrentSchedule = () => {
    setConfirmClearCurrent(true);
  };

  const doClearCurrentSchedule = async () => {
    setConfirmClearCurrent(false);
    try {
      await updateSchedule({});
      closeHistory();
      showToast('Current schedule cleared.', 'success');
    } catch (err) {
      showToast('Clear failed: ' + err.message, 'error');
    }
  };

  const handleReload = useCallback(async () => {
    try {
      await reloadSchedule();
      showToast('Schedule and trail data reloaded from disk.', 'success');
      // Force a refresh of the local state by triggering a load
      await loadSchedule();
    } catch (err) {
      showToast('Failed to reload: ' + err.message, 'error');
    }
  }, [showToast]);

  const nextHikeDate = useMemo(() => {
    const today = getTodayHikeRef();
    const hikeDays = getHikeDays();
    let earliest = null;
    MONTH_NAMES.forEach((monthName, m) => {
      const monthData = scheduleStore[monthName] || {};
      Object.keys(monthData).forEach(dayStr => {
        const day = parseInt(dayStr, 10);
        const date = createDate(year, m, day);
        if (date >= today && hikeDays.includes(date.getDay()) && (!earliest || date < earliest)) {
          earliest = date;
        }
      });
    });
    return earliest;
  }, [scheduleStore, year]);

  const fetchWeatherForAll = useCallback(async () => {
    if (fetchingWeather) return;
    setFetchingWeather(true);
    setShowSettings(false);
    const results = {};
    let successCount = 0;
    let failCount = 0;
    const concurrency = 5;
    const items = hikeTrailMap.filter(item => item.trail?.trailHeadLat != null && item.trail?.trailHeadLon != null);
    for (let i = 0; i < items.length; i += concurrency) {
      const batch = items.slice(i, i + concurrency);
      await Promise.allSettled(batch.map(async (item) => {
        const trail = item.trail;
        const w = await fetchWeatherAndTide(trail.trailHeadLat, trail.trailHeadLon, nextHikeDate, trail.tideStationId || null);
        if (w) {
          results[trail.id] = w;
          successCount++;
        } else {
          failCount++;
        }
      }));
    }
    setWeatherMap(results);
    setFetchingWeather(false);
    showToast(`Weather fetched: ${successCount} success, ${failCount} failed/skipped`, 'info');
  }, [fetchingWeather, hikeTrailMap, nextHikeDate, showToast]);

  const verifyServerSchedule = useCallback(async () => {
    try {
      const [serverData, serverTrails] = await Promise.all([getSchedule(), getTrails()]);
      const local = storeToServerSchedule(scheduleStore);

      // Normalize both to abbreviations for comparison
       const serverEntries = Object.entries(serverData).flatMap(([m, entries]) => {
        if (m === '_etag' || m === '_status') return [];
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
        showToast('Local matches server. Schedule: ' + serverEntries.length + ' entries, Trails: ' + serverTrails.length + ' trails', 'success');
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
        showToast(msg, 'error');
      }
    } catch (err) {
      showToast('Failed to verify: ' + err.message, 'error');
    }
  }, [scheduleStore, trails, showToast]);

  const toggleEarlyStart = (day, slotIdx) => {
    const monthData = scheduleStore[MONTH_NAMES[selectedMonth]] || {};
    const entries = Array.isArray(monthData[day]) ? monthData[day] : (monthData[day] ? [monthData[day]] : []);
    const entry = entries[slotIdx];
    if (!entry) return;

    updateMonthSchedule(MONTH_NAMES[selectedMonth], prev => {
      const next = { ...prev };
      const currentEntries = Array.isArray(next[day]) ? [...next[day]] : [next[day] || {}];
      currentEntries[slotIdx] = { ...entry, early_start: !entry.early_start };
      next[day] = currentEntries;
      return next;
    });
  };

  const importFromExcel = useCallback(() => {
    createFileInput({
      accept: '.xls,.xlsx',
      onFile: async (file) => {
        try {
          const result = await importScheduleFromXls(file);
          if (!result.success) {
            showToast('Import failed: ' + (result.error?.message || 'Unknown error'), 'error');
            return;
          }
          const serverData = storeToServerSchedule(scheduleStore);
          const excelData = result.schedule || {};
          for (const [month, entries] of Object.entries(excelData)) {
            const abbr = MONTH_FULL_TO_ABBR[month] || month;
            if (!serverData[abbr]) serverData[abbr] = [];
            const existingDays = new Set(serverData[abbr].map(e => e.day));
            for (const [day, entry] of Object.entries(entries)) {
              if (!existingDays.has(parseInt(day, 10)) && entry.trail_id) {
                serverData[abbr].push({ day: parseInt(day, 10), trail_id: entry.trail_id, early_start: !!entry.early_start, leader: entry.leader || '' });
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
           showToast(msg, 'success');
         } catch (err) {
           showToast('Import error: ' + err.message, 'error');
         }
       },
       onCleanup: () => setShowSettings(false),
     });
   }, [scheduleStore, setSelectedMonth, showToast]);

  const importScheduleTsv = useCallback(() => {
      createFileInput({
        accept: '.tsv,.txt',
        onFile: async (file) => {
          try {
            const text = await file.text();
            const lines = text.split('\n').map(l => l.split('\t'));
            console.log('[TSV Import] Lines:', lines.length, 'Trails:', trails?.length);

            let headerIdx = -1;
            for (let i = 0; i < Math.min(lines.length, 10); i++) {
              if (lines[i][0] === 'Month' && lines[i][2] === 'Hike') {
                headerIdx = i;
                break;
              }
            }
            console.log('[TSV Import] Header index:', headerIdx);

            if (headerIdx < 0) {
              showToast('Could not find quarterly schedule header in file.', 'error');
              return;
            }

            // Validate group name from title row
            const titleRow = lines[0]?.slice().join('').trim() || '';
            const fileGroupMatch = titleRow.match(/\(([^)]+)\)$/);
            const fileGroup = fileGroupMatch ? fileGroupMatch[1] : null;
            const currentGroup = getGroupName() || 'hiker';
            if (fileGroup && fileGroup !== currentGroup) {
              showToast(`This schedule is for "${fileGroup}" but you're running "${currentGroup}". Import cancelled.`, 'error');
              return;
            }

            // Parse header row to find column groups (each: DayName, Hike, Leader/Shadow, spacer)
            // Old format: Month|Wed|Hike|Leader||Month|Fri|Hike|Leader
            // New format: Month|Mon A|Hike|Leader||Mon B|Hike|Leader|
            const headerRow = lines[headerIdx];
            const columnGroups = [];
            for (let c = 1; c < headerRow.length - 2; c += 4) {
              let dayLabel = headerRow[c]?.trim();
              let dayCol = c;
              let hikeCol = c + 1;
              // Old format: column at position c is "Month", actual day label is at c+1
              if (dayLabel === 'Month') {
                dayLabel = headerRow[c + 1]?.trim();
                dayCol = c + 1;
                hikeCol = c + 2;
              }
              const hikeHeader = headerRow[hikeCol]?.trim();
              if (dayLabel && hikeHeader === 'Hike') {
                columnGroups.push({ dayLabel, dayCol, hikeCol, leaderCol: hikeCol + 1 });
              }
            }
            console.log('[TSV Import] Column groups:', columnGroups);

            // Map each column group to its slot: slot = occurrence within same day-of-week
            // sothh [3,5]: Wed→slot 0, Fri→slot 0 (different days, each has 1 hike)
            // ramblers [1,1]: Mon A→slot 0, Mon B→slot 1 (same day, 2 hikes)
            const dowOccurrence = {};
            const unmatchedDayLabels = [];
            for (const cg of columnGroups) {
              const dowMatch = DAY_NAMES.find(name => cg.dayLabel.split(' ')[0].startsWith(name));
              if (dowMatch) {
                const dow = DAY_NAMES.indexOf(dowMatch);
                if (!dowOccurrence[dow]) dowOccurrence[dow] = 0;
                cg.slot = dowOccurrence[dow]++;
              } else {
                unmatchedDayLabels.push(cg.dayLabel);
                cg.slot = 0;
              }
            }

            // Detect slot collisions: multiple columns mapping to same dow+slot
            const slotKeys = columnGroups.map(cg => `${cg.dayLabel}:${cg.slot}`);
            const slotCollisions = slotKeys.filter((k, i) => slotKeys.indexOf(k) !== i);

            if (unmatchedDayLabels.length > 0 || slotCollisions.length > 0) {
              let warnMsg = '⚠ Import warning — data may be lost:\n\n';
              if (unmatchedDayLabels.length > 0) {
                warnMsg += `Unrecognized day labels: ${unmatchedDayLabels.join(', ')}\n`;
                warnMsg += 'These columns will default to slot 0 and may collide.\n';
              }
              if (slotCollisions.length > 0) {
                const uniqueCollisions = [...new Set(slotCollisions)];
                warnMsg += `Slot collisions: ${uniqueCollisions.join(', ')}\n`;
                warnMsg += 'Multiple columns share the same day+slot — only one hike will survive per date.\n';
              }
              warnMsg += '\nDo you want to proceed anyway?';
              setPendingTsvImport({ lines, headerIdx, columnGroups, warnMsg });
              return;
            }

            await doTsvImportRef.current(lines, headerIdx, columnGroups);
            return;
          } catch (err) {
            showToast('Import error: ' + err.message, 'error');
          }
        },
        onCleanup: () => setShowSettings(false),
      });
    }, [trails, showToast]);

  async function doTsvImportSchedule(lines, headerIdx, columnGroups) {
    try {
            // Pre-build normalized trail lookup for O(1) matching
            const trailLookup = new Map();
            const trailIdLookup = new Map();
            const stopWords = new Set(['to', 'from', 'via', 'the', 'of', 'and', 'at', 'on', 'in', 'up', 'down', 'off', 'by', 'for', 'with']);
            for (const trail of trails) {
              const fullName = getTrailName(trail).toLowerCase().replace(/[^a-z0-9\s/]/g, '').replace(/\s*\([^)]*\)/g, '').trim();
              trailLookup.set(fullName, trail);
              const idSlug = trail.id.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
              trailIdLookup.set(idSlug, trail);
            }

            const schedule = {};
            let unmatchedCount = 0;
            let matchedCount = 0;
            let currentMonth = '';

            for (let i = headerIdx + 1; i < lines.length; i++) {
              const row = lines[i];
              if (row.length < 3) continue;

              const rawMonth = row[0]?.trim();
              if (rawMonth) {
                const m = MONTH_ABBR_TO_FULL[rawMonth] || MONTH_NAMES.find(n => n.toLowerCase().startsWith(rawMonth.toLowerCase()));
                if (m) currentMonth = m;
              }

              for (const cg of columnGroups) {
                const dayNum = parseInt(row[cg.dayCol], 10);
                const hikeName = row[cg.hikeCol]?.trim();
                const leader = row[cg.leaderCol]?.trim();

                if (!isNaN(dayNum) && hikeName && currentMonth) {
                  if (!schedule[currentMonth]) schedule[currentMonth] = [];
                  // Fast match using pre-built lookup
                  const hikeNorm = hikeName.replace(/\s*\(?Early Start\)?\s*/gi, '').trim().toLowerCase().replace(/[^a-z0-9\s/]/g, '').replace(/\s*\([^)]*\)/g, '').trim();
                  let trail = trailLookup.get(hikeNorm) || trailIdLookup.get(hikeNorm.replace(/[^a-z0-9\s]/g, ' ').trim());
                  // Fallback: word-level matching
                  if (!trail) {
                    const hikeWords = hikeNorm.replace(/\//g, ' ').split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
                    let bestMatch = null, bestScore = 0;
                    for (const [key, t] of trailLookup) {
                      const trailWords = key.replace(/\//g, ' ').split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
                      const matchCount = hikeWords.filter(hw => trailWords.some(tw => tw.includes(hw) || hw.includes(tw))).length;
                      const score = matchCount / hikeWords.length;
                      if (score > bestScore && score >= 0.6) {
                        bestScore = score;
                        bestMatch = t;
                      }
                    }
                    trail = bestMatch;
                  }
                   if (trail) {
                     const hasEarlyStart = /\(early start\)/i.test(hikeName);
                     const slot = cg.slot ?? 0;
                     schedule[currentMonth].push({ day: dayNum, slot, trail_id: trail.id, leader: leader || '', early_start: hasEarlyStart });
                    matchedCount++;
                  } else {
                    console.log('[TSV Import] Unmatched:', hikeName);
                    unmatchedCount++;
                  }
                }
              }
            }

            console.log('[TSV Import] Matched:', matchedCount, 'Unmatched:', unmatchedCount, 'Schedule:', JSON.stringify(schedule).substring(0, 200));

            if (!Object.keys(schedule).length) {
              showToast('No valid schedule data found in file.', 'error');
              return;
            }

            // Convert full month names to abbreviated keys for the server
            const normalized = {};
            for (const [month, entries] of Object.entries(schedule)) {
              const abbr = MONTH_FULL_TO_ABBR[month] || month;
              normalized[abbr] = entries;
            }
            const result = await updateSchedule(normalized);
            if (!result.success) {
              showToast('Import failed: ' + (result.error?.message || 'Unknown error'), 'error');
              return;
            }

            await loadSchedule();
            let msg = `Imported: ${matchedCount} hikes across ${Object.keys(schedule).length} month(s).`;
            if (unmatchedCount > 0) {
              msg += `\n${unmatchedCount} hike(s) could not be matched to a trail.`;
            }
            showToast(msg, 'success');
          } catch (err) {
            showToast('Import error: ' + err.message, 'error');
          }
  }
  doTsvImportRef.current = doTsvImportSchedule;

  const getQuarterForMonth = (monthIndex) => {
    // Calendar quarters: Q1=Jan/Feb/Mar, Q2=Apr/May/Jun, Q3=Jul/Aug/Sep, Q4=Oct/Nov/Dec
    if (monthIndex >= 0 && monthIndex <= 2) return { q: '1', months: ['Jan', 'Feb', 'Mar'], label: '1st Quarter' };
    if (monthIndex >= 3 && monthIndex <= 5) return { q: '2', months: ['Apr', 'May', 'Jun'], label: '2nd Quarter' };
    if (monthIndex >= 6 && monthIndex <= 8) return { q: '3', months: ['Jul', 'Aug', 'Sep'], label: '3rd Quarter' };
    return { q: '4', months: ['Oct', 'Nov', 'Dec'], label: '4th Quarter' };
  };

  const exportExcelSchedule = useCallback(() => {
    const quarter = getQuarterForMonth(selectedMonth);
    const qYear = year;
    const hikeDays = getHikeDays();

    // Collect all hikes from schedule, preserving original slot
    const hikesByDay = {};
    const maxEntriesPerDow = {};

    for (const monthAbbr of quarter.months) {
      const monthIndex = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(monthAbbr);
      const daysInMonth = new Date(qYear, monthIndex + 1, 0).getDate();
      const monthKey = MONTH_NAMES[monthIndex];
      const monthData = scheduleStore[monthKey] || {};

      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(qYear, monthIndex, day);
        const dayOfWeek = date.getDay();
        const entries = Array.isArray(monthData[String(day)]) ? monthData[String(day)] : [monthData[String(day)]];
        const validEntries = entries.filter(e => e && e.trail_id);

        if (validEntries.length > 0) {
          if (!maxEntriesPerDow[dayOfWeek]) maxEntriesPerDow[dayOfWeek] = 0;
          maxEntriesPerDow[dayOfWeek] = Math.max(maxEntriesPerDow[dayOfWeek], validEntries.length);
          entries.forEach((entry, slot) => {
            if (!entry || !entry.trail_id) return;
            const key = `${dayOfWeek}-${slot}`;
            if (!hikesByDay[key]) hikesByDay[key] = [];
            const trail = findTrailById(entry.trail_id);
            let trailName = trail ? getTrailName(trail) : entry.trail_id;
            if (entry.early_start) trailName += ' (Early Start)';
            hikesByDay[key].push({ month: monthAbbr, day, trailName, leader: entry.leader || '' });
          });
        }
      }
    }

    // A/B based on actual entries per date, not config slot indices
    const configuredDayCounts = {};
    hikeDays.forEach(d => configuredDayCounts[d] = (configuredDayCounts[d] || 0) + 1);
    const dayCounts = { ...maxEntriesPerDow };
    for (const [d, c] of Object.entries(configuredDayCounts)) {
      if (!(d in dayCounts)) dayCounts[d] = c;
    }
    const uniqueDays = Object.keys(dayCounts).map(Number).sort((a, b) => a - b);

    // Ensure all day+slot combinations exist
    for (const dow of uniqueDays) {
      for (let slot = 0; slot < (dayCounts[dow] || 1); slot++) {
        if (!hikesByDay[`${dow}-${slot}`]) hikesByDay[`${dow}-${slot}`] = [];
      }
    }

    // Build column headers and day labels
    const dayLabels = [];
    for (const dow of uniqueDays) {
      const name = getDayName(dow);
      const count = dayCounts[dow] || 1;
      for (let slot = 0; slot < count; slot++) {
        dayLabels.push({ dow, slot, label: count > 1 ? `${name} ${String.fromCharCode(65 + slot)}` : name });
      }
    }

    // Build TSV
    const pad = (arr, len) => {
      while (arr.length < len) arr.push('');
      return arr;
    };

    const numCols = dayLabels.length * 4 + 1;
    const prefix = getGroupName() || 'hiker';
    let rows = [];

    // Row 0: title
    rows.push(pad(['', '', quarter.label + ' Hikes ' + qYear + ' (' + prefix + ')'], numCols));
    rows.push(pad([], numCols));
    rows.push(pad([], numCols));

    // Row 3: headers
    const headerRow = ['Month'];
    for (const dl of dayLabels) {
      headerRow.push(dl.label, 'Hike', 'Leader / Shadow', '');
    }
    rows.push(pad(headerRow, numCols));

    // Group hikes by month for each day label
    const hikesByMonth = {};
    for (const dl of dayLabels) {
      const key = `${dl.dow}-${dl.slot}`;
      hikesByMonth[key] = {};
      for (const m of quarter.months) {
        hikesByMonth[key][m] = (hikesByDay[key] || []).filter(h => h.month === m);
      }
    }

    for (const month of quarter.months) {
      const allMonthHikes = dayLabels.map(dl => hikesByMonth[`${dl.dow}-${dl.slot}`][month] || []);
      const maxRows = Math.max(...allMonthHikes.map(arr => arr.length), 1);

      for (let i = 0; i < maxRows; i++) {
        const row = [];
        if (i === 0) row.push(month);
        else row.push('');

        for (let j = 0; j < allMonthHikes.length; j++) {
          const h = allMonthHikes[j][i];
          row.push(h ? String(h.day) : '');
          row.push(h ? h.trailName : '');
          row.push(h ? (h.leader || '') : '');
          row.push('');
        }

        rows.push(pad(row, numCols));
      }
    }

    // Alternate hikes section
    rows.push(pad([], numCols));
    const altRow = ['', ''];
    for (const dl of dayLabels) {
      altRow.push(`Alternate ${dl.label} Hike`, '', '', '');
    }
    rows.push(pad(altRow, numCols));

    const tsv = rows.map(r => r.join('\t')).join('\n');
    downloadBlob(tsv, `${prefix}-${quarter.q}Q${qYear.toString().slice(2)}_hikes.tsv`, 'text/tab-separated-values');
  }, [selectedMonth, year, scheduleStore, findTrailById]);

  const handleExport = useCallback(() => {
    const month = MONTH_NAMES[selectedMonth];
    const title = `Over-the-Hill Hike Descriptions -- ${month}, ${year}`;
    const hikeDays = getHikeDays();
    const hikeDates = getHikeDaysForMonth(year, selectedMonth, hikeDays);
    const hikesPerDowExport = {};
    hikeDays.forEach(d => { hikesPerDowExport[d] = (hikesPerDowExport[d] || 0) + 1; });
    const entries = hikeDates.flatMap(day => {
        const date = createDate(year, selectedMonth, day);
        const dowNum = date.getDay();
        const hikesForThisDow = (hikesPerDowExport[dowNum] || 1);
        return Array.from({ length: hikesForThisDow }, (_, slot) => {
            const entry = assignedHikes[day]?.[slot] || { trail_id: null, early_start: false };
            const { trail_id: trailId, early_start: earlyStart } = entry;
            const dayOfWeek = DAY_NAMES[dowNum];
           const dateStr = `${dayOfWeek}, ${month} ${day}`;
           if (!trailId) return { dateStr, trail: null, trailDetails: null, earlyStart: false };
           const trail = findTrailById(trailId);
           if (!trail) return { dateStr, trail: null, trailDetails: null, earlyStart: false };
           return { dateStr, trail, trailDetails: trailDetails, earlyStart };
        });
    });

    const html = generateReportHtml(entries, title);
    openHtmlInNewTab(html);
  }, [selectedMonth, year, assignedHikes, findTrailById, trailDetails]);

   const hikeCards = useMemo(() => {
      return filteredHikes.reduce((cards, item) => {
        const trail = item.trail;
        if (!trail) return cards;
        cards.push(
         <div
            key={`${trail.id}-${item.hikeIndex}`}
            draggable
             onDragStart={() => handleDragStart(item.hikeIndex, null, null, trail.id, false, '')}
            onDragEnd={handleDragEnd}
            className="cursor-grab active:cursor-grabbing"
            title={tt('Drag to schedule on a date')}
          >
           <div className="relative">
              <TrailCard trail={trail} isActive={false} selectedMonths={filters.months} weather={weatherMap[trail.id]} />
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
  }, [filteredHikes, handleDragStart, handleDragEnd, debugMode, filters.months, tt, weatherMap]);

  // Register settings into context for header dropdown
  const { register } = useScheduleSettings();
  const settingsActions = useMemo(() => ({
    showSettings, setShowSettings,
    fetchingWeather, nextHikeDate, fetchWeatherForAll,
    handleExport, exportExcelSchedule,
    importFromExcel, hasApiKey, importScheduleTsv,
    openHistory, verifyServerSchedule,
    debugMode, setDebugMode,
    handleReload, clearSchedule,
  }), [
    showSettings, setShowSettings,
    fetchingWeather, nextHikeDate, fetchWeatherForAll,
    handleExport, exportExcelSchedule,
    importFromExcel, hasApiKey, importScheduleTsv,
    openHistory, verifyServerSchedule,
    debugMode, setDebugMode,
    handleReload, clearSchedule,
  ]);
  useEffect(() => {
    register(settingsActions);
  }, [register, settingsActions]);

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

         {/* Schedule History Panel */}
        {showHistory && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-4">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800">
                Schedule History ({historyEntries.length})
              </h3>
              <div className="flex items-center gap-2">
                <button onClick={handleClearCurrentSchedule} disabled={!hasApiKey} className={`text-xs font-medium px-2 py-1 rounded transition-colors ${hasApiKey ? 'text-red-600 hover:bg-red-50' : 'text-gray-300 cursor-not-allowed'}`} title={tt('Clear all schedule data and preserve history')}>
                  Clear Schedule
                </button>
                <button onClick={closeHistory} className="text-gray-400 hover:text-gray-600" title={tt('Close history panel')}>
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
                          title={tt('Restore schedule from this backup')}
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
              <div className="p-4">
                <div className="space-y-3">
                    {hikeDates.map((slot) => {
                      const day = slot.day;
                      const slotIdx = slot.slot;
                      const dayOfWeek = new Date(year, selectedMonth, day).getDay();

                        const entry = assignedHikes[day]?.[slotIdx] || { trail_id: null, early_start: false, leader: '' };
                        const trailId = entry.trail_id;
                        const earlyStart = entry.early_start;
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
                        >
                           <div className="flex items-start gap-3">
                             <div className="text-center flex-shrink-0">
                                 <div className={`text-2xl font-bold ${
                                  dayOfWeek === 3 ? 'text-blue-600' : dayOfWeek === 5 ? 'text-purple-600' : 'text-gray-600'
                                 }`}>
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
                                          {String.fromCharCode(65 + slotIdx)}
                                        </span>
                                      )}
                                      <span className="text-base font-semibold text-gray-900 truncate">
                                        {displayHikeName}
                                      </span>
                                      {earlyStart && <span className="text-orange-500 text-sm" title="Early Start">⏰</span>}
                                    </div>
                                    {trailId && (
                                      <div className="text-xs text-gray-500 truncate mt-0.5">
                                        (ID: {trailId})
                                      </div>
                                    )}
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
                                              await updateLeader(scheduleStore, selectedMonth, day, slotIdx, newLeader);
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
                               <label className="flex items-center gap-1 cursor-pointer" title={tt('Toggle early start (affects hike description)')}>
                                 <input
                                   type="checkbox"
                                    checked={!!earlyStart}
                                    onChange={() => toggleEarlyStart(day, slotIdx)}
                                    className="w-4 h-4 text-orange-500 rounded"
                                 />
                                 <span className="text-xs text-gray-500">ES</span>
                               </label>
                               {trail?.hasGpx && (
                                 <>
                                   <button
                                      onClick={() => handleGpxDownload(trailId, getTrailName(trail))}
                                     disabled={gpxDownloading !== null}
                                     className="text-green-600 hover:text-green-800 transition-colors disabled:opacity-50"
                                     title={tt('Download GPX file')}
                                   >
                                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4-4V4" />
                                     </svg>
                                   </button>
                                   <button
                                     onClick={() => handleTrailhead(trailId)}
                                     className="text-blue-600 hover:text-blue-800 transition-colors"
                                     title={tt('Open trailhead in Google Maps')}
                                   >
                                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                     </svg>
                                   </button>
                                  </>
                                )}
                                {trail?.tideStationId && (
                                  <a
                                    href={getNoaaTideUrl(trail.tideStationId, new Date(year, selectedMonth, day))}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 transition-colors"
                                    title={`NOAA Tide Station ${trail.tideStationId}`}
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                    </svg>
                                  </a>
                                )}
                                <button
                                  onClick={() => removeHike(day, slotIdx)}
                                  className="text-red-400 hover:text-red-600 transition-colors"
                                  title={tt('Remove hike from this date')}
                                >
                                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <SwapConfirmationModal
            pendingSwap={pendingSwap}
            onConfirm={confirmSwap}
            onCancel={cancelSwap}
          />
          <ConfirmDialog
            open={confirmClear}
            title="Clear all schedule data?"
            message="This will remove all scheduled hikes. Your history will be preserved."
            confirmLabel="Clear"
            danger
            onConfirm={doClearSchedule}
            onCancel={() => setConfirmClear(false)}
          />
          <ConfirmDialog
            open={!!pendingRestore}
            title="Restore schedule?"
            message={pendingRestore ? `Restore schedule from ${new Date(pendingRestore).toLocaleString()}?\nThis will replace your current schedule.` : ''}
            confirmLabel="Restore"
            danger
            onConfirm={() => doRestore(pendingRestore)}
            onCancel={() => setPendingRestore(null)}
          />
          <ConfirmDialog
            open={confirmClearCurrent}
            title="Clear the current schedule?"
            message="Your history will be preserved."
            confirmLabel="Clear"
            danger
            onConfirm={doClearCurrentSchedule}
            onCancel={() => setConfirmClearCurrent(false)}
          />
          <ConfirmDialog
            open={!!pendingTsvImport}
            title="Import warning"
            message={pendingTsvImport?.warnMsg || ''}
            confirmLabel="Proceed"
            onConfirm={async () => {
              const { lines, headerIdx, columnGroups } = pendingTsvImport;
              setPendingTsvImport(null);
              await doTsvImportSchedule(lines, headerIdx, columnGroups);
            }}
            onCancel={() => setPendingTsvImport(null)}
          />
      </>
  );
}
