/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useTrails } from '../hooks/useTrails';
import { useMonthContext } from './MonthContext';
import { useYearContext } from './YearContext';
import { useApiKey } from '../hooks/useApiKey';
import { useToast } from '../hooks/useToast';
import { useTooltips } from '../hooks/useTooltips';
import { useScheduleData } from '../hooks/useScheduleData';
import { useSchedulePolling } from '../hooks/useSchedulePolling';
import { setSchedule } from '../hooks/useTrailStore';
import ConfirmDialog from '../components/ConfirmDialog';
import { getTrailName } from '../utils/data';
import { MONTH_NAMES, DAY_NAMES, MONTH_ABBR_TO_FULL, MONTH_FULL_TO_ABBR } from '../utils/constants';
import { getHikeDays, getDayName, getGroupName } from '../utils/config';
import { createDate, getDaysInMonth, getTodayHikeRef, getHikeDaysForMonth } from '../utils/dateUtils';
import { serverScheduleToStore, storeToServerSchedule, getDayEntries, normalizeServerMonthEntries } from '../utils/scheduleFormat';
import { generateReportHtml } from '../utils/report';
import { downloadBlob, createFileInput, fetchWeatherAndTide, openHtmlInNewTab } from '../utils/io';
import { importScheduleFromXls, updateSchedule, getScheduleHistory, restoreSchedule, getSchedule, getTrails, reloadSchedule } from '../api/client';

const ScheduleSettingsContext = createContext({});

async function loadSchedule() {
  const data = await getSchedule();
  setSchedule(data);
}

export function ScheduleSettingsProvider({ children }) {
  const { trails, schedule: scheduleData, trailDetails } = useTrails();
  const { selectedMonth, setSelectedMonth } = useMonthContext();
  const { selectedYear } = useYearContext();
  const hasApiKey = useApiKey();
  const showToast = useToast();
  const { title: tt } = useTooltips();
  const year = selectedYear;

  const [showSettings, setShowSettings] = useState(false);
  const [scheduleStore, setScheduleStore] = useState({});
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const [weatherMap, setWeatherMap] = useState({});
  const [fetchingWeather, setFetchingWeather] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyEntries, setHistoryEntries] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [pendingRestore, setPendingRestore] = useState(null);
  const [pendingTsvImport, setPendingTsvImport] = useState(null);

  const savedTimeoutRef = useRef(null);
  const saveTimeoutRef = useRef(null);
  const lastSavedStoreRef = useRef(null);
  const doTsvImportRef = useRef(null);

  const { assignedHikes, hikeDates, findTrailById, trailIndexToId } = useScheduleData({
    trails, scheduleStore, selectedMonth, year,
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

  // Close the settings dropdown when clicking outside (works on all pages)
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showSettings && !e.target.closest('.relative')) {
        setShowSettings(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showSettings, setShowSettings]);

  // Save schedule to server (debounced 1s)
  const saveScheduleToServer = useCallback(async () => {
    const currentStoreJson = JSON.stringify(scheduleStore);
    if (lastSavedStoreRef.current === currentStoreJson) {
      return;
    }
    lastSavedStoreRef.current = currentStoreJson;
    const serverData = storeToServerSchedule(scheduleStore);
    const entryCount = Object.values(serverData).reduce((sum, entries) => sum + normalizeServerMonthEntries(entries).length, 0);
    try {
      setSaveStatus('saving');
      if (debugMode) console.log('[Schedule] Saving schedule:', entryCount, 'entries');
      const result = await updateSchedule(serverData);
      if (debugMode) console.log('[Schedule] Save successful, ETag:', result?.etag);
      setSaveStatus('saved');
      showToast('Schedule saved', 'success');
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
      savedTimeoutRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
      return result;
    } catch (err) {
      console.error('[Schedule] Failed to save schedule:', err);
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

  const hikeTrailMap = useMemo(() => {
    return trails.map((t, idx) => ({
      hike: getTrailName(t),
      trail: t,
      hikeIndex: idx + 1,
      trailId: t.id,
    }));
  }, [trails]);

  const closeHistory = useCallback(() => {
    setShowHistory(false);
  }, []);

  const clearSchedule = useCallback(() => {
    setConfirmClear(true);
  }, []);

  const doClearSchedule = useCallback(async () => {
    setConfirmClear(false);
    setScheduleStore({});
    lastSavedStoreRef.current = JSON.stringify({});
    setShowSettings(false);
    closeHistory();
    try {
      await updateSchedule({});
      showToast('Schedule cleared.', 'success');
    } catch (err) {
      showToast('Clear failed: ' + err.message, 'error');
    }
  }, [closeHistory, showToast]);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const entries = await getScheduleHistory();
      setHistoryEntries(entries);
    } catch (err) {
      console.error('[Schedule] Failed to load history:', err);
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

  const handleRestore = useCallback((timestamp) => {
    setPendingRestore(timestamp);
  }, []);

  const doRestore = useCallback(async (timestamp) => {
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
  }, [closeHistory, showToast]);

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
        return normalizeServerMonthEntries(entries)
          .filter(e => e.trail_id)
          .map(e => `${abbr}:${e.day}:${e.trail_id}`);
      });
      const localEntries = Object.entries(local).flatMap(([m, entries]) =>
        normalizeServerMonthEntries(entries)
          .filter(e => e.trail_id)
          .map(e => `${m}:${e.day}:${e.trail_id}`)
      );

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
      const daysInMonth = getDaysInMonth(qYear, monthIndex);
      const monthKey = MONTH_NAMES[monthIndex];
      const monthData = scheduleStore[monthKey] || {};

      for (let day = 1; day <= daysInMonth; day++) {
        const date = createDate(qYear, monthIndex, day);
        const dayOfWeek = date.getDay();
        const entries = getDayEntries(monthData, day);
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
    const hikeDatesExport = getHikeDaysForMonth(year, selectedMonth, hikeDays);
    const hikesPerDowExport = {};
    hikeDays.forEach(d => { hikesPerDowExport[d] = (hikesPerDowExport[d] || 0) + 1; });
    const entries = hikeDatesExport.flatMap(day => {
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
        return { dateStr, trail, trailDetails, earlyStart };
      });
    });

    const html = generateReportHtml(entries, title);
    openHtmlInNewTab(html);
  }, [selectedMonth, year, assignedHikes, findTrailById, trailDetails]);

  const value = {
    showSettings, setShowSettings,
    scheduleStore, setScheduleStore,
    saveStatus,
    weatherMap, setWeatherMap,
    fetchingWeather,
    debugMode, setDebugMode,
    nextHikeDate,
    hikeTrailMap,
    assignedHikes, hikeDates, findTrailById, trailIndexToId,
    fetchWeatherForAll,
    handleExport, exportExcelSchedule,
    importFromExcel, importScheduleTsv,
    openHistory, closeHistory,
    verifyServerSchedule,
    handleReload, clearSchedule, doClearSchedule,
    showHistory, historyEntries, loadingHistory,
    confirmClear, setConfirmClear,
    pendingRestore, setPendingRestore,
    pendingTsvImport, setPendingTsvImport,
    doTsvImportSchedule,
    hasApiKey,
  };

  return (
    <ScheduleSettingsContext.Provider value={value}>
      {children}

      {/* Schedule History Panel */}
      {showHistory && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-4">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">
              Schedule History ({historyEntries.length})
            </h3>
            <div className="flex items-center gap-2">
              <button onClick={clearSchedule} disabled={!hasApiKey} className={`text-xs font-medium px-2 py-1 rounded transition-colors ${hasApiKey ? 'text-red-600 hover:bg-red-50' : 'text-gray-300 cursor-not-allowed'}`} title={tt('Clear all schedule data and preserve history')}>
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
    </ScheduleSettingsContext.Provider>
  );
}

export function useScheduleSettings() {
  return useContext(ScheduleSettingsContext);
}
