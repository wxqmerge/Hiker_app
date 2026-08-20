/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTrailStore } from '../hooks/useTrailStore';
import { useToast } from '../hooks/useToast';
import { createFileInput, createImportFileInput, downloadBlob, parseTrailTsv, sanitizeFilename } from '../utils/io';
import { getGpx, importTrailsFromXls, getSchedule, updateSchedule, request, exportDataZip, importDataZip, resyncGpxCoords } from '../api/client';
import { getTrailName } from '../utils/data';
import { getGroupName } from '../utils/config';
import { formatDateToISO } from '../utils/dateUtils';
import { getStoredApiKey, storeApiKey } from '../utils/apiKey';
import ConfirmDialog from '../components/ConfirmDialog';

const TrailActionsContext = createContext(null);

export function TrailActionsProvider({ children }) {
  const { trails, trailDetails, saveTrail, saveTrailDetail, exportJSON, importJSON } = useTrailStore();
  const showToast = useToast();
  const navigate = useNavigate();

  const [apiKey, setApiKey] = useState(getStoredApiKey());
  const [validating, setValidating] = useState(false);
  const [newTrailForm, setNewTrailForm] = useState(false);
  const [newTrailName, setNewTrailName] = useState('');
  const [pendingConfirm, setPendingConfirm] = useState(null);
  const [pendingTsvChoice, setPendingTsvChoice] = useState(null);

  const hasApiKey = apiKey.trim().length > 0;
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
    showToast('API key saved!', 'success');
  }, [apiKey, showToast]);

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

  const handleImportDatabase = useCallback(() => {
    createFileInput({
      accept: '.xls',
      onFile: async (file) => {
        if (file.name !== 'Hike Data BaseM.xls') {
          showToast('Invalid file: "' + file.name + '". Only "Hike Data BaseM.xls" is accepted.', 'error');
          return;
        }
        try {
          const result = await importTrailsFromXls(file);
          if (!result.success) {
            showToast('Import failed: ' + (result.error?.message || 'Unknown error'), 'error');
            return;
          }
          showToast(result.message || 'Trail database imported successfully!', 'success');
          window.location.reload();
        } catch (err) {
          showToast('Import error: ' + err.message, 'error');
        }
      },
    });
  }, [showToast]);

  const doImportHikeTsv = useCallback(async (parsedTrail, parsedDetail, targetTrail) => {
    const generateId = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'new-trail';
    let newId = targetTrail?.id || generateId(parsedTrail.fullName);
    let counter = 1;
    while (trails.find(t => t.id === newId) && !targetTrail) {
      newId = generateId(parsedTrail.fullName) + '-' + counter++;
    }
    const saved = targetTrail
      ? await saveTrail({ ...parsedTrail, id: targetTrail.id })
      : await saveTrail({
          ...parsedTrail,
          id: newId,
        });
    const savedId = saved.id || targetTrail?.id;
    const detailToSave = {};
    if (parsedDetail.fullDescription) detailToSave.fullDescription = parsedDetail.fullDescription;
    if (parsedDetail.pros != null) detailToSave.pros = parsedDetail.pros;
    if (parsedDetail.others != null) detailToSave.others = parsedDetail.others;
    if (parsedDetail.leaders?.length) detailToSave.leaders = parsedDetail.leaders;
    if (Object.keys(detailToSave).length > 0) {
      await saveTrailDetail(savedId, detailToSave);
    }
    showToast(`Trail "${saved.fullName}" imported successfully!`, 'success');
    navigate(`/trail/${savedId}?edit=true`);
  }, [trails, saveTrail, saveTrailDetail, navigate, showToast]);

  const handleImportHikeTsv = useCallback(() => {
    createFileInput({
      accept: '.tsv,.txt',
      onFile: async (file) => {
        const text = await file.text();
        try {
          const { trail: parsedTrail, detail: parsedDetail } = parseTrailTsv(text);
          if (!parsedTrail.fullName) {
            showToast('Import failed: Trail Name is required.', 'error');
            return;
          }
          const existingByName = trails.find(t => t.fullName === parsedTrail.fullName);
          if (existingByName) {
            setPendingTsvChoice({ parsedTrail, parsedDetail, existingByName });
            return;
          }
          await doImportHikeTsv(parsedTrail, parsedDetail, null);
        } catch (err) {
          showToast('Import failed: ' + (err.message || 'Invalid TSV format'), 'error');
        }
      },
    });
  }, [trails, doImportHikeTsv, showToast]);

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
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split('\t');
          if (cols.length < 14) continue;
          const trailId = cols[0].trim();
          const trail = trails.find(t => t.id === trailId);
          if (!trail) continue;
          const monthly = [];
          for (let m = 2; m < 14; m++) {
            const val = parseInt(cols[m].trim(), 10);
            monthly.push(isNaN(val) ? 0 : val);
          }
          const existing = trailDetails?.[trailId]?.popularity || {};
          await saveTrailDetail(trailId, {
            popularity: { ...existing, monthly, monthlyScore: undefined },
          });
          updated++;
        }
        showToast(`Updated monthly popularity for ${updated} trail(s).`, 'success');
      },
    });
  }, [requireKey, trails, trailDetails, saveTrailDetail, showToast]);

  const exportScheduleJson = useCallback(async () => {
    try {
      const schedule = await getSchedule();
      const dateStr = formatDateToISO();
      const prefix = getGroupName() || 'hiker';
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
            } catch {
              showToast('Import failed: Invalid JSON format', 'error');
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
      const prefix = getGroupName() || 'hiker';
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
      const prefix = getGroupName() || 'hiker';
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
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      askConfirm('Import all data from ZIP', 'Import all data from ZIP? This will overwrite matching JSON files on the server. 5 files will be checked.', async () => {
        try {
          const result = await importDataZip(file);
          let msg = `Data imported successfully! ${result.imported} file(s) written.`;
          if (result.skippedSchedules?.length > 0) msg += ` Skipped schedule files: ${result.skippedSchedules.join(', ')} (wrong instance).`;
          if (result.reconciled > 0) msg += ` ${result.reconciled} GPX index entry/entries removed (trail IDs not on this instance).`;
          showToast(msg, 'success');
          window.location.reload();
        } catch (err) {
          showToast('Import failed: ' + err.message, 'error');
        }
      }, true);
    };
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
    importDatabase: handleImportDatabase,
    importHikeTsv: handleImportHikeTsv,
    importAllJson: importAllDataJson,
    importZip: importAllDataZip,
    importScheduleJson,
    importMonthlyTsv,
    cleanupOrphanedDetails,
    validateData,
    resyncCoords,
  }), [handleImportDatabase, handleImportHikeTsv, importAllDataJson, importAllDataZip, importScheduleJson, importMonthlyTsv, cleanupOrphanedDetails, validateData, resyncCoords]);

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
    setApiKey,
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
      <ConfirmDialog
        open={!!pendingTsvChoice}
        title="Trail already exists"
        message={pendingTsvChoice ? `Trail "${pendingTsvChoice.parsedTrail.fullName}" already exists.` : ''}
        actions={pendingTsvChoice ? [
          {
            label: 'Update',
            onClick: async () => {
              const { parsedTrail, parsedDetail, existingByName } = pendingTsvChoice;
              setPendingTsvChoice(null);
              await doImportHikeTsv(parsedTrail, parsedDetail, existingByName);
            },
          },
          {
            label: 'Create copy',
            variant: 'secondary',
            onClick: async () => {
              const { parsedTrail, parsedDetail } = pendingTsvChoice;
              parsedTrail.fullName = `${parsedTrail.fullName} (copy)`;
              parsedTrail.name = `${parsedTrail.name || parsedTrail.fullName} (copy)`;
              setPendingTsvChoice(null);
              await doImportHikeTsv(parsedTrail, parsedDetail, null);
            },
          },
          {
            label: 'Cancel',
            variant: 'secondary',
            onClick: () => setPendingTsvChoice(null),
          },
        ] : undefined}
        onCancel={() => setPendingTsvChoice(null)}
      />
    </TrailActionsContext.Provider>
  );
}

export function useTrailActions() {
  return useContext(TrailActionsContext);
}
