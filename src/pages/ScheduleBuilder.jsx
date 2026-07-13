import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTrails } from '../hooks/useTrails';
import { useFilters } from '../hooks/useFilters';
import { useSchedulePolling } from '../hooks/useSchedulePolling';
import { useTooltips } from '../hooks/useTooltips';
import PageNav from '../components/PageNav';
import FilterPanel from '../components/FilterPanel';
import TrailCard from '../components/TrailCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { MONTH_NAMES, DAY_NAMES, DEFAULT_FILTERS, MONTH_ABBR_TO_FULL, MONTH_FULL_TO_ABBR } from '../utils/constants';
import { filterTrails, sortTrails } from '../utils/filterTrails';
import { generateReportHtml } from '../utils/report';
import { downloadBlob, createFileInput, getFirstCoordinateFromGpx, openGoogleMapsTrailhead } from '../utils/io';
import { importScheduleFromXls, updateSchedule, getScheduleHistory, restoreSchedule, getSchedule, getTrails, reloadSchedule, getGpx } from '../api/client';
import { getHealthUrl } from '../utils/url.js';
import { useTrailDetails } from '../hooks/useTrailDetails';
import { useScheduleData } from '../hooks/useScheduleData';
import { useScheduleDragDrop } from '../hooks/useScheduleDragDrop';
import { serverScheduleToStore, storeToServerSchedule } from '../utils/scheduleFormat';
import { getDayName, getHikeDaysLabel, getHikeDays } from '../utils/config';
import { getDaysInMonth, createDate } from '../utils/dateUtils';

const APP_VERSION = __APP_VERSION;
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
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    const nextMonth = (now.getMonth() + 1) % 12;
    return nextMonth;
  });
  const [isSaving, setIsSaving] = useState(false); // eslint-disable-line no-unused-vars
  const hasApiKey = !!localStorage.getItem('hiker-api-key');
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
    fetch(getHealthUrl())
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

  const [pendingSwap, setPendingSwap] = useState(null);
  const year = 2026;

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

  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyEntries, setHistoryEntries] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [gpxDownloading, setGpxDownloading] = useState(null);

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

  const handleTrailhead = useCallback(async (trailId) => {
    const gpx = await getGpx(trailId);
    if (!gpx) return;
    const coord = getFirstCoordinateFromGpx(gpx);
    if (coord) {
      openGoogleMapsTrailhead(coord.lat, coord.lon);
    }
  }, []);

  const hikeTrailMap = useMemo(() => {
    const scheduleIds = Object.values(assignedHikes).flat().map(v => v?.trail_id).filter(Boolean);
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

  const monthSlotStats = useMemo(() => {
    const hikeDays = getHikeDays();
    const trailIdSet = new Set(trails.map(t => t.id));
    const stats = {};
    MONTH_NAMES.forEach((name, idx) => {
      const daysInMonth = getDaysInMonth(year, idx);
      let total = 0;
      for (let day = 1; day <= daysInMonth; day++) {
        const date = createDate(year, idx, day);
        const dayOfWeek = date.getDay();
        hikeDays.forEach(configDay => {
          if (configDay === dayOfWeek) total++;
        });
      }
      let filled = 0;
      const monthData = scheduleStore[name] || {};
      Object.values(monthData).forEach(val => {
        const entries = Array.isArray(val) ? val : (val ? [val] : []);
        filled += entries.filter(e => e?.trail_id && trailIdSet.has(e.trail_id)).length;
      });
      stats[idx] = { total, filled };
    });
    return stats;
  }, [scheduleStore, year, trails]);

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
    const sorted = sortTrails(filtered, filters, 'name', trailDetails);
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

  const handleReload = async () => {
    try {
      await reloadSchedule();
      alert('✓ Schedule and trail data reloaded from disk.');
      // Force a refresh of the local state by triggering a load
      await loadSchedule();
    } catch (err) {
      alert('Failed to reload: ' + err.message);
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
          alert(msg);
        } catch (err) {
          alert('Import error: ' + err.message);
        }
      },
      onCleanup: () => setShowSettings(false),
    });
  };

  const importScheduleTsv = () => {
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
              alert('Could not find quarterly schedule header in file.');
              return;
            }

            const schedule = {};
             let unmatchedCount = 0;
             let matchedCount = 0;
             let currentMonth = '';

            for (let i = headerIdx + 1; i < lines.length; i++) {
               const row = lines[i];
               console.log('[TSV Import] Row', i, 'length:', row.length, 'data:', row.slice(0, 10));
               if (row.length < 5) continue;

               const rawWedMonth = row[0]?.trim();
               const wedDay = parseInt(row[1], 10);
               const wedHike = row[2]?.trim();
               const wedLeader = row[3]?.trim();

              if (rawWedMonth) {
                  const wm = MONTH_ABBR_TO_FULL[rawWedMonth] || MONTH_NAMES.find(n => n.toLowerCase().startsWith(rawWedMonth.toLowerCase()));
                  if (wm) currentMonth = wm;
                }

              if (!isNaN(wedDay) && wedHike && currentMonth) {
                  if (!schedule[currentMonth]) schedule[currentMonth] = {};
                  const trail = findTrailByHikeName(wedHike, trails);
                  if (trail) {
                    const hasEarlyStart = /\(early start\)/i.test(wedHike);
                    schedule[currentMonth][wedDay] = { trail_id: trail.id, leader: wedLeader || '', early_start: hasEarlyStart };
                    matchedCount++;
                  } else {
                    console.log('[TSV Import] Unmatched Wed:', wedHike);
                    unmatchedCount++;
                  }
                }

               if (row.length >= 9) {
                 const rawFriMonth = row[5]?.trim();
                 const friDay = parseInt(row[6], 10);
                 const friHike = row[7]?.trim();
                 const friLeader = row[8]?.trim();

                 if (rawFriMonth) {
                    const fm = MONTH_ABBR_TO_FULL[rawFriMonth] || MONTH_NAMES.find(n => n.toLowerCase().startsWith(rawFriMonth.toLowerCase()));
                    if (fm) currentMonth = fm;
                  }

                if (!isNaN(friDay) && friHike && currentMonth) {
                    if (!schedule[currentMonth]) schedule[currentMonth] = {};
                    const trail = findTrailByHikeName(friHike, trails);
                    if (trail) {
                      const hasEarlyStart = /\(early start\)/i.test(friHike);
                      schedule[currentMonth][friDay] = { trail_id: trail.id, leader: friLeader || '', early_start: hasEarlyStart };
                      matchedCount++;
                    } else {
                      console.log('[TSV Import] Unmatched Fri:', friHike);
                      unmatchedCount++;
                    }
                  }
               }
            }

            console.log('[TSV Import] Matched:', matchedCount, 'Unmatched:', unmatchedCount, 'Schedule:', JSON.stringify(schedule).substring(0, 200));

            if (!Object.keys(schedule).length) {
              alert('No valid schedule data found in file.');
              return;
            }

            const result = await updateSchedule(schedule);
           if (!result.success) {
             alert('Import failed: ' + (result.error?.message || 'Unknown error'));
             return;
           }

           await loadSchedule();
           let msg = `Imported: ${matchedCount} hikes across ${Object.keys(schedule).length} month(s).`;
           if (unmatchedCount > 0) {
             msg += `\n${unmatchedCount} hike(s) could not be matched to a trail.`;
           }
           alert(msg);
         } catch (err) {
           alert('Import error: ' + err.message);
         }
       },
       onCleanup: () => setShowSettings(false),
     });
   };

const findTrailByHikeName = (hikeName, trailsList) => {
        if (!hikeName || !trailsList?.length) return null;
        const withoutEarlyStart = hikeName.replace(/\s*\(?Early Start\)?\s*/gi, '').trim();
        const normalized = withoutEarlyStart.toLowerCase().replace(/[^a-z0-9\s/]/g, '').replace(/\s*\([^)]*\)/g, '').trim();
        console.log('[TSV Import] Trying to match:', hikeName, '→ normalized:', normalized);
        for (const trail of trailsList) {
          const trailFullName = (trail.fullName || trail.name || '').toLowerCase().replace(/[^a-z0-9\s/]/g, '').replace(/\s*\([^)]*\)/g, '').trim();
          if (trailFullName === normalized) {
            console.log('[TSV Import] Exact match →', trail.fullName || trail.name);
            return trail;
          }
          const trailIdSlug = trail.id.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
          const hikeWords = normalized.split(/\s+/).filter(w => w.length > 2);
          if (hikeWords.length === 0) continue;
          const trailIdWords = trailIdSlug.split(/\s+/).filter(w => w.length > 2);
          if (trailIdWords.length === 0) continue;
          const matchCount = hikeWords.filter(hw => trailIdWords.some(tw => tw.includes(hw) || hw.includes(tw))).length;
          if (matchCount / hikeWords.length >= 0.8) {
            console.log('[TSV Import] ID match →', trail.fullName || trail.name);
            return trail;
          }
        }
        const stopWords = new Set(['to','from','via','the','of','and','at','on','in','up','down','off','by','for','with']);
        const hikeSignificant = normalized.replace(/\//g, ' ').split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
        if (hikeSignificant.length === 0) return null;
        let bestMatch = null;
        let bestScore = 0;
        for (const trail of trailsList) {
          const trailName = (trail.fullName || trail.name || '').toLowerCase().replace(/[^a-z0-9\s/]/g, '').replace(/\//g, ' ').split(/\s+/);
          const trailSignificant = trailName.filter(w => w.length > 2 && !stopWords.has(w));
          const matchCount = hikeSignificant.filter(hw => trailSignificant.some(tw => tw.includes(hw) || hw.includes(tw))).length;
          const score = matchCount / hikeSignificant.length;
          if (score > bestScore && score >= 0.6) {
            bestScore = score;
            bestMatch = trail;
          }
        }
        if (bestMatch) {
          console.log('[TSV Import] Partial match →', bestMatch.fullName || bestMatch.name, '(score:', bestScore.toFixed(2), ')');
        } else {
          console.log('[TSV Import] No match found for:', hikeName);
        }
        return bestMatch;
      };

  const getQuarterForMonth = (monthIndex) => {
    // Calendar quarters: Q1=Jan/Feb/Mar, Q2=Apr/May/Jun, Q3=Jul/Aug/Sep, Q4=Oct/Nov/Dec
    if (monthIndex >= 0 && monthIndex <= 2) return { q: '1', months: ['Jan', 'Feb', 'Mar'], label: '1st Quarter' };
    if (monthIndex >= 3 && monthIndex <= 5) return { q: '2', months: ['Apr', 'May', 'Jun'], label: '2nd Quarter' };
    if (monthIndex >= 6 && monthIndex <= 8) return { q: '3', months: ['Jul', 'Aug', 'Sep'], label: '3rd Quarter' };
    return { q: '4', months: ['Oct', 'Nov', 'Dec'], label: '4th Quarter' };
  };

  const exportExcelSchedule = () => {
    const quarter = getQuarterForMonth(selectedMonth);
    const qYear = year;

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
        let trailName = trail ? trail.fullName || trail.name : entry.trail_id;
        if (entry.early_start) trailName += ' (Early Start)';

        if (dayOfWeek === 3) {
          wedHikes.push({ month: monthAbbr, day, trailName, leader: entry.leader || '' });
        } else if (dayOfWeek === 5) {
          friHikes.push({ month: monthAbbr, day, trailName, leader: entry.leader || '' });
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
        row.push(w ? w.trailName : '');
        row.push(w ? (w.leader || '') : '');

        // Spacer
        row.push('');

        // Right side (Fri)
        if (i === 0) row.push(month);
        else row.push('');
        row.push(f ? String(f.day) : '');
        row.push(f ? f.trailName : '');
        row.push(f ? (f.leader || '') : '');

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
    const title = `Over-the-Hill Hike Descriptions -- ${month}, ${year}`;
    const daysInMonth = getDaysInMonth(year, selectedMonth);
    const hikeDays = getHikeDays();
    const hikeDates = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const date = createDate(year, selectedMonth, day);
      if (hikeDays.includes(date.getDay())) hikeDates.push(day);
    }
    const entries = hikeDates.map(day => {
      const { trail_id: trailId, early_start: earlyStart } = assignedHikes[day] || { trail_id: null, early_start: false };
      const dayOfWeek = DAY_NAMES[new Date(year, selectedMonth, day).getDay()];
      const dateStr = `${dayOfWeek}, ${month} ${day}`;

      if (!trailId) return { dateStr, trail: null, trailDetails: null, earlyStart: false };

      const trail = findTrailById(trailId);
      if (!trail) return { dateStr, trail: null, trailDetails: null, earlyStart: false };

      return { dateStr, trail, trailDetails: trailDetails, earlyStart };
    });

    const html = generateReportHtml(entries, title);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

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
            <TrailCard trail={trail} isActive={false} selectedMonths={filters.months} />
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
  }, [filteredHikes, handleDragStart, handleDragEnd, debugMode, filters.months, tt]);

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
    <div className="min-h-screen bg-gray-50">
      <main className="container mx-auto px-4 py-3">
        <div className="mb-6 flex items-baseline gap-3">
          <PageNav />
          <span className="text-xs text-gray-400">v{APP_VERSION}</span>
          <div className="relative">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
              title={tt('Import/Export schedule')}
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
                    title={tt('Export monthly hike descriptions as HTML in a new tab')}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0l-4 4m4-4v12" />
                    </svg>
                    Export Monthly HTML
                  </button>
               <button onClick={exportExcelSchedule} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded flex items-center gap-2" title={tt('Export quarterly schedule as TSV file')}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export Quarterly Schedule
                </button>
                <button onClick={importFromExcel} disabled={!hasApiKey} className={`w-full text-left px-3 py-2 text-sm rounded flex items-center gap-2 ${hasApiKey ? 'text-gray-700 hover:bg-gray-100' : 'text-gray-300 cursor-not-allowed'}`} title={tt('Import schedule from Excel file')}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Import SOTHH Schedule.xls {!hasApiKey && '(need API key)'}
                </button>
                <button onClick={importScheduleTsv} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded flex items-center gap-2" title={tt('Import quarterly schedule from TSV file')}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Import Quarterly Schedule TSV
                </button>
                <button onClick={openHistory} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded flex items-center gap-2" title={tt('View schedule history and restore previous versions')}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Schedule History
                </button>
                <button onClick={verifyServerSchedule} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded flex items-center gap-2" title={tt('Compare local schedule with server and report differences')}>
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
              title={tt('Show hike index numbers on cards for debugging')}
            >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  Debug Mode {debugMode ? 'ON' : 'OFF'}
                </button>
                <button
                  onClick={handleReload}
                  disabled={!hasApiKey}
                  className={`w-full text-left px-3 py-2 text-sm rounded flex items-center gap-2 ${
                    hasApiKey ? 'text-gray-700 hover:bg-gray-100' : 'text-gray-300 cursor-not-allowed'
                  }`}
                  title={tt('Force server to reload JSON data from disk')}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m0 0a8.003 8.003 0 0113.385-4.368l-.707.707" />
                  </svg>
                  Reload Server Data {!hasApiKey && '(need API key)'}
                </button>
                <button
                  onClick={clearSchedule}

              className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded flex items-center gap-2"
              title={tt('Remove all schedule data (cannot be undone)')}
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
             title={tt('Select month to view/edit')}
           >
              {MONTH_NAMES.map((name, idx) => {
                  const { total, filled } = monthSlotStats[idx] || { total: 0, filled: 0 };
                  const label = total > 0 ? `${filled}/${total}` : '0/0';
                  const color = filled === 0 ? '#9ca3af' : filled === total ? '#15803d' : '#a16207';
                  return (
                  <option key={idx} value={idx} style={{ color }}>
                    {name} ({label})
                  </option>
                );
             })}
           </select>
             <p className="text-gray-600 text-sm ml-auto">
               {monthSlotStats[selectedMonth]?.filled ?? assignedCount}/{monthSlotStats[selectedMonth]?.total ?? hikeDates.length} slots filled
             </p>

        </div>

        <FilterPanel 
          filters={filters}
          setFilters={setFilters}
          lookup={lookup}
          resetFilters={() => setFilters({ ...DEFAULT_FILTERS })}
        />

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
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
               <h3 className="text-sm font-semibold text-gray-800">
                 {MONTH_NAMES[selectedMonth]} {year} — {getHikeDaysLabel()}
               </h3>
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
                         const displayHikeName = trail ? trail.fullName || trail.name : trailId;
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
                                    <input
                                          type="text"
                                          placeholder="Leader / Shadow"
                                          value={leader || ''}
                                          onChange={(e) => {
                                            const value = e.target.value;
                                            setScheduleStore(prev => {
                                              const current = prev[MONTH_NAMES[selectedMonth]] || {};
                                              const next = { ...current };
                                              const entries = Array.isArray(current[day]) ? [...current[day]] : [current[day] || {}];
                                              entries[slotIdx] = { ...entries[slotIdx], leader: value };
                                              next[day] = entries;
                                              return { ...prev, [MONTH_NAMES[selectedMonth]]: next };
                                            });
                                          }}
                                         onBlur={(e) => {
                                           const value = e.target.value;
                                           const monthName = MONTH_NAMES[selectedMonth];
                                           updateMonthSchedule(monthName, prev => {
                                             const next = { ...prev };
                                             const currentEntries = Array.isArray(next[day]) ? [...next[day]] : [next[day] || {}];
                                             currentEntries[slotIdx] = { ...currentEntries[slotIdx], leader: value };
                                             next[day] = currentEntries;
                                             return next;
                                           });
                                         }}
                                        className="mt-1 w-full text-xs border border-gray-300 rounded px-1.5 py-0.5 focus:ring-green-500 focus:border-green-500 truncate"
                                        onClick={(e) => e.stopPropagation()}
                                      />
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
                                     onClick={() => handleGpxDownload(trailId, trail.fullName || trail.name)}
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
       {pendingSwap && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={cancelSwap}>
            <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm mx-auto" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Swap Hikes?</h3>
              <div className="space-y-3 text-sm text-gray-700">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">1</div>
                  <span><strong>{pendingSwap.sourceTrailName}</strong> moves to {pendingSwap.targetDayLabel}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">2</div>
                  <span><strong>{pendingSwap.targetTrailName}</strong> moves to {pendingSwap.sourceDayLabel}</span>
                </div>
              </div>
              <div className="flex gap-3 mt-6 justify-end">
                <button
                  onClick={cancelSwap}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmSwap}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                >
                  Swap
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
