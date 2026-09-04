/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTrailStore } from '../hooks/useTrailStore';
import { useToast } from '../hooks/useToast';
import { createFileInput, createImportFileInput, downloadBlob, sanitizeFilename } from '../utils/io';
import { getGpx, getSchedule, updateSchedule, request, exportDataZip, importDataZip, resyncGpxCoords } from '../api/client';
import { getTrailName } from '../utils/data';
import { getGroupName } from '../utils/config';
import { formatDateToISO } from '../utils/dateUtils';
import { getStoredApiKey, storeApiKey, subscribeApiKeyChange } from '../utils/apiKey';
import { useApiKey } from '../hooks/useApiKey';
import ConfirmDialog from '../components/ConfirmDialog';

const TrailActionsContext = createContext(null);

export function TrailActionsProvider({ children }) {
  const { trails, trailDetails, saveTrail, saveTrailDetail, exportJSON, importJSON } = useTrailStore();
  const showToast = useToast();
  const navigate = useNavigate();

  const [apiKey, setApiKey] = useState(getStoredApiKey());
  const userEditedKeyRef = useRef(false);
  const [validating, setValidating] = useState(false);
  const [newTrailForm, setNewTrailForm] = useState(false);
  const [newTrailName, setNewTrailName] = useState('');
  const [pendingConfirm, setPendingConfirm] = useState(null);


  const hasApiKey = useApiKey();

  // Keep the apiKey field in sync with the stored key. ApiKeySync (in App) stores
  // a ?apikey= URL value in a post-render effect, which runs after this provider
  // mounts — so the initial useState snapshot is stale. Without this, the field
  // shows empty and clicking Save would clear the freshly-stored key. We skip the
  // sync while the user is actively editing the field.
  useEffect(() => {
    const sync = () => {
      if (!userEditedKeyRef.current) setApiKey(getStoredApiKey());
    };
    const unsubscribe = subscribeApiKeyChange(sync);
    sync();
    return unsubscribe;
  }, []);

  const requireKey = useCallback((msg) => {
    if (!hasApiKey) {
      showToast(msg, 'error');
      return true;
    }
    return false;
  }, [hasApiKey, showToast]);

  const askConfirm = useCallback((title, message, onConfirm, danger = false) => {
    setPendingConfirm({ title, message, onConfirm, danger });
  }, []);

  const saveApiKey = useCallback(() => {
    storeApiKey(apiKey);
    userEditedKeyRef.current = false;
    showToast('API key saved!', 'success');
  }, [apiKey, showToast]);

  // Marks the field as user-edited so the auto-sync above doesn't clobber input.
  const handleApiKeyChange = useCallback((value) => {
    userEditedKeyRef.current = true;
    setApiKey(value);
  }, []);

  const handleValidateDatabase = useCallback(async () => {
    setValidating(true);
    try {
      const res = await request('/api/validate');
      const issues = res.results.filter(r => !r.valid);
      if (issues.length > 0) {
        const msg = issues.map(i => `${i.file}: ${i.issues?.join('; ') || i.error}`).join('\n');
        showToast(`Validation found ${issues.length} issue(s):\n\n${msg}`, 'error');
      } else {
        showToast('All data files are valid.', 'success');
      }
    } catch (err) {
      showToast('Validation failed: ' + err.message, 'error');
    } finally {
      setValidating(false);
    }
  }, [showToast]);

  const checkGpxIntegrity = useCallback(async () => {
    setValidating(true);
    try {
      const res = await request('/api/validate');
      const allIssues = (res.results || []).filter(r => !r.valid).flatMap(r => r.issues || [r.error || 'unknown issue']);
      const gpxIssues = allIssues.filter(i => /gpx/i.test(i));
      if (gpxIssues.length > 0) {
        showToast(`GPX integrity: ${gpxIssues.length} issue(s)\n\n${gpxIssues.join('\n')}`, 'error');
      } else {
        showToast('GPX integrity: all files accounted for.', 'success');
      }
    } catch (err) {
      showToast('GPX check failed: ' + err.message, 'error');
    } finally {
      setValidating(false);
    }
  }, [showToast]);

  const startNewTrail = useCallback(() => {
    setNewTrailName('');
    setNewTrailForm(true);
  }, []);

  const submitNewTrail = useCallback(async () => {
    const name = newTrailName.trim();
    if (!name) return;
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (trails.find(t => t.id === id)) {
      showToast('A trail with this ID already exists.', 'error');
      return;
    }
    const newTrail = {
      id,
      name,
      fullName: name,
      distance: null,
      distanceExtended: null,
      elevationStart: null,
      elevationMax: null,
      difficulty: 'Unknown',
      notes: '',
      seasonal: { availableMonths: [], bestSeason: '' },
      difficultyOrder: 99,
    };
    try {
      await saveTrail(newTrail);
      setNewTrailForm(false);
      setNewTrailName('');
      navigate(`/trail/${id}`);
    } catch (err) {
      showToast('Create failed: ' + err.message, 'error');
    }
  }, [newTrailName, trails, saveTrail, navigate, showToast]);



  const exportMonthlyTsv = useCallback(() => {
    const header = ['Trail ID', 'Trail Name', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const rows = [header];
    for (const trail of trails) {
      const monthly = trailDetails?.[trail.id]?.popularity?.monthly || [];
      const row = [trail.id, getTrailName(trail)];
      for (let m = 0; m < 12; m++) {
        row.push(String(monthly[m] || 0));
      }
      rows.push(row);
    }
    const tsv = rows.map(r => r.join('\t')).join('\n');
    downloadBlob(tsv, 'trail_monthly_popularity.tsv', 'text/tab-separated-values');
  }, [trails, trailDetails]);

  const importMonthlyTsv = useCallback(() => {
    if (requireKey('API key required for monthly popularity import.')) return;
    createFileInput({
      accept: '.tsv,.txt,.csv',
      onFile: async (file) => {
        const text = await file.text();
        const lines = text.trim().split('\n');
        if (lines.length < 2) {
          showToast('TSV file is empty or has only a header.', 'error');
          return;
        }
        const headerCols = lines[0].split('\t');
        const isMonthly = headerCols.length >= 14 && headerCols[2]?.trim() === 'Jan';
        if (!isMonthly) {
          showToast('This is not a monthly popularity TSV.\n\nExpected 14 columns: Trail ID, Trail Name, Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec', 'error');
          return;
        }
        let updated = 0;
        let skipped = 0;
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split('\t');
          if (cols.length < 14) continue;
          const trailId = cols[0].trim();
          const trail = trails.find(t => t.id === trailId);
          if (!trail) { skipped++; continue; }
          const monthly = [];
          for (let m = 2; m < 14; m++) {
            const val = parseInt(cols[m].trim(), 10);
            monthly.push(isNaN(val) ? 0 : val);
          }
          const existing = trailDetails?.[trailId]?.popularity || {};
          await saveTrailDetail(trailId, {
            popularity: { ...existing, monthly, monthlyScore: null },
          });
          updated++;
        }
        let msg = `Updated monthly popularity for ${updated} trail(s).`;
        if (skipped > 0) msg += ` ${skipped} row(s) skipped (unknown trail ID).`;
        msg += ` Computed scores were reset.`;
        showToast(msg, 'success');
      },
    });
  }, [requireKey, trails, trailDetails, saveTrailDetail, showToast]);

  const exportScheduleJson = useCallback(async () => {
    try {
      const schedule = await getSchedule();
      const dateStr = formatDateToISO();
      const prefix = getGroupName() || 'export';
      const filename = `${prefix}-schedule-${dateStr}.json`;
      const json = JSON.stringify(schedule, null, 2);
      downloadBlob(json, filename, 'application/json');
    } catch (err) {
      showToast('Export failed: ' + err.message, 'error');
    }
  }, [showToast]);

  const importScheduleJson = useCallback(async () => {
    if (requireKey('API key required for schedule import.')) return;
    createFileInput({
      accept: '.json',
      onFile: async (file) => {
        const text = await file.text();
        try {
          const schedule = JSON.parse(text);
          askConfirm('Import schedule', 'Replace the entire schedule with this data? This will overwrite all current schedule entries.', async () => {
            try {
              await updateSchedule(schedule);
              showToast('Schedule imported successfully!', 'success');
              window.location.reload();
            } catch (err) {
              showToast('Import failed: ' + (err.message || 'Server rejected the schedule'), 'error');
            }
          }, true);
        } catch {
          showToast('Import failed: Invalid JSON format', 'error');
        }
      },
    });
  }, [requireKey, askConfirm, showToast]);

  const exportAllDataJson = useCallback(async () => {
    try {
      const data = await exportJSON();
      const prefix = getGroupName() || 'export';
      downloadBlob(JSON.stringify(data, null, 2), `${prefix}-trail-data.json`);
    } catch (err) {
      showToast('Export failed: ' + err.message, 'error');
    }
  }, [exportJSON, showToast]);

  const importAllDataJson = useCallback(() => {
    if (requireKey('API key required for data import.')) return;
    createImportFileInput(
      async (imported) => {
        askConfirm('Import trail data', 'Import trail data? This will upsert all trails and details from the file.', async () => {
          try {
            await importJSON(imported);
            showToast('Data imported successfully!', 'success');
            window.location.reload();
          } catch (err) {
            showToast('Import failed: ' + err.message, 'error');
          }
        }, true);
      },
      (msg) => showToast(msg, 'error')
    );
  }, [requireKey, importJSON, askConfirm, showToast]);

  const exportAllDataZip = useCallback(async () => {
    try {
      const blob = await exportDataZip();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const date = formatDateToISO();
      const prefix = getGroupName() || 'export';
      a.download = `${prefix}-data-${date}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      showToast('Export failed: ' + err.message, 'error');
    }
  }, [showToast]);

  const exportGpxZip = useCallback(async () => {
    const trailsWithGpx = trails.filter(t => t.hasGpx);
    if (trailsWithGpx.length === 0) {
      showToast('No trails have GPX files.', 'error');
      return;
    }
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    let downloaded = 0;
    let failed = 0;
    for (const trail of trailsWithGpx) {
      try {
        const gpx = await getGpx(trail.id);
        if (gpx) {
          const safeName = sanitizeFilename(getTrailName(trail), trail.id);
          zip.file(`${safeName}.gpx`, gpx);
          downloaded++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }
    if (downloaded === 0) {
      showToast('Failed to fetch any GPX files.', 'error');
      return;
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const date = formatDateToISO();
    a.download = `trails-gpx-${date}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${downloaded} GPX file(s).${failed > 0 ? ` (${failed} failed)` : ''}`, 'success');
  }, [trails, showToast]);

  const importAllDataZip = useCallback(() => {
    if (requireKey('API key required for data import.')) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip';
    input.style.display = 'none';
    input.onchange = async (e) => {
      document.body.removeChild(input);
      const file = e.target.files[0];
      if (!file) return;
      askConfirm('Import all data from ZIP', 'Import all data from ZIP? This will overwrite matching JSON and GPX files on the server.', async () => {
        try {
          const result = await importDataZip(file);
          let msg = `Data imported: ${result.imported} file(s) written.`;
          if (result.skippedSchedules?.length > 0) msg += ` Skipped schedule files: ${result.skippedSchedules.join(', ')} (wrong instance).`;
          if (result.reconciled > 0) msg += ` ${result.reconciled} GPX index entry/entries removed (trail IDs not on this instance).`;
          if (result.orphanedGpx?.length > 0) msg += ` ${result.orphanedGpx.length} orphaned GPX file(s) on disk: ${result.orphanedGpx.slice(0, 3).join(', ')}${result.orphanedGpx.length > 3 ? '…' : ''}`;
          if (result.errors?.length > 0) {
            msg += ` ${result.errors.length} file(s) failed: ${result.errors.join('; ')}`;
            showToast(msg, 'error');
          } else {
            showToast(msg, 'success');
          }
          setTimeout(() => window.location.reload(), 4000);
        } catch (err) {
          showToast('Import failed: ' + err.message, 'error');
        }
      }, true);
    };
    document.body.appendChild(input);
    input.click();
  }, [requireKey, askConfirm, showToast]);

  const cleanupOrphanedDetails = useCallback(async () => {
    if (requireKey('API key required.')) return;
    askConfirm('Cleanup orphaned details', 'Remove trail detail entries that no longer have a matching trail?', async () => {
      try {
        const res = await request('/api/cleanup/orphaned-details', { method: 'POST', apiKey: true });
        if (res.removed > 0) {
          showToast(`Removed ${res.removed} orphaned detail(s): ${res.orphaned.join(', ')}`, 'success');
          window.location.reload();
        } else {
          showToast('No orphaned details found.', 'info');
        }
      } catch (err) {
        showToast('Cleanup failed: ' + err.message, 'error');
      }
    }, true);
  }, [requireKey, askConfirm, showToast]);

  const validateData = useCallback(async () => {
    if (requireKey('API key required.')) return;
    await handleValidateDatabase();
  }, [requireKey, handleValidateDatabase]);

  const resyncCoords = useCallback(async () => {
    if (requireKey('API key required.')) return;
    try {
      const res = await resyncGpxCoords();
      let msg = `Re-synced ${res.updated} trail(s).`;
      if (res.errors?.length) msg += `\n\n${res.errors.length} issue(s):\n` + res.errors.join('\n');
      showToast(msg, res.errors?.length ? 'error' : 'success');
      if (res.updated > 0) window.location.reload();
    } catch (err) {
      showToast('Re-sync failed: ' + err.message, 'error');
    }
  }, [requireKey, showToast]);

  const adminActions = useMemo(() => ({
    importAllJson: importAllDataJson,
    importZip: importAllDataZip,
    importScheduleJson,
    importMonthlyTsv,
    cleanupOrphanedDetails,
    validateData,
    resyncCoords,
    checkGpxIntegrity,
  }), [importAllDataJson, importAllDataZip, importScheduleJson, importMonthlyTsv, cleanupOrphanedDetails, validateData, resyncCoords, checkGpxIntegrity]);

  const userActions = useMemo(() => ({
    newTrail: startNewTrail,
    exportJson: exportAllDataJson,
    exportZip: exportAllDataZip,
    exportGpxZip,
    exportSchedule: exportScheduleJson,
    exportMonthlyPop: exportMonthlyTsv,
    validateDb: handleValidateDatabase,
  }), [startNewTrail, exportAllDataJson, exportAllDataZip, exportGpxZip, exportScheduleJson, exportMonthlyTsv, handleValidateDatabase]);

  const value = {
    apiKey,
    setApiKey: handleApiKeyChange,
    saveApiKey,
    hasApiKey,
    requireKey,
    askConfirm,
    validating,
    handleValidateDatabase,
    newTrailForm,
    setNewTrailForm,
    newTrailName,
    setNewTrailName,
    submitNewTrail,
    startNewTrail,
    adminActions,
    userActions,
  };

  return (
    <TrailActionsContext.Provider value={value}>
      {children}
      <ConfirmDialog
        open={!!pendingConfirm}
        title={pendingConfirm?.title}
        message={pendingConfirm?.message}
        danger={pendingConfirm?.danger}
        onConfirm={async () => {
          const { onConfirm } = pendingConfirm;
          setPendingConfirm(null);
          await onConfirm();
        }}
        onCancel={() => setPendingConfirm(null)}
      />
    </TrailActionsContext.Provider>
  );
}

export function useTrailActions() {
  return useContext(TrailActionsContext);
}
