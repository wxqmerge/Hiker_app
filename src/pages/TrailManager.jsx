import { useState, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PageNav from '../components/PageNav';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatDateToISO } from '../utils/dateUtils';
import { getGroupName } from '../utils/config';

const APP_VERSION = __APP_VERSION;
import { useTrailStore } from '../hooks/useTrailStore';
import { useTooltips } from '../hooks/useTooltips';
import { createFileInput, createImportFileInput, downloadBlob, exportTrailTsv, parseTrailTsv, sanitizeFilename } from '../utils/io';
import JSZip from 'jszip';
import { getGpx } from '../api/client';
import { importTrailsFromXls, getSchedule, updateSchedule, request, exportDataZip, importDataZip } from '../api/client';
import { getSeasonalInfo, calculateMonthlyScore } from '../utils/score.js';

export default function TrailManager() {
  const { title: tt } = useTooltips();
  const { trails, loading, trailDetails, saveTrail, deleteTrail, saveTrailDetail, exportJSON, importJSON } = useTrailStore();
  const [search, setSearch] = useState('');
  const [gpxFilter, setGpxFilter] = useState('all');
  const [apiKey, setApiKey] = useState(localStorage.getItem('hiker-api-key') || '');
  const [validationResults, setValidationResults] = useState(null);
  const [validating, setValidating] = useState(false);
  const getScheduleCount = (trailId) => {
    const trail = trails.find(t => t.id === trailId);
    if (!trail) return 0;
    const monthly = trailDetails?.[trailId]?.popularity?.monthly;
    if (!monthly || !Array.isArray(monthly)) return 0;
    const { hasQuarterData } = getSeasonalInfo(trail.seasonal || {});
    return monthly.reduce((sum, v, idx) => {
      const hikeCount = v || 0;
      return sum + calculateMonthlyScore(hikeCount, idx, [], hasQuarterData);
    }, 0);
  };
  const navigate = useNavigate();
  const hasApiKey = apiKey.trim().length > 0;

  const handleValidateDatabase = async () => {
    if (!hasApiKey) {
      alert('API key required for database validation.');
      return;
    }
    setValidating(true);
    try {
      const res = await request('/api/validate', { apiKey: true });
      setValidationResults(res);
    } catch (err) {
      setValidationResults({ valid: false, results: [{ file: '(request)', valid: false, error: err.message }] });
    } finally {
      setValidating(false);
    }
  };

  const handleSaveApiKey = () => {
    localStorage.setItem('hiker-api-key', apiKey);
    alert('API key saved!');
  };

  const filteredTrails = useMemo(() => {
    const q = search.toLowerCase();
    return trails.filter(t => {
      const matchesSearch = !q || t.name?.toLowerCase().includes(q) || t.fullName?.toLowerCase().includes(q) || t.id?.toLowerCase().includes(q);
      const matchesGpx = gpxFilter === 'all' || (gpxFilter === 'gpx' ? t.hasGpx : !t.hasGpx);
      return matchesSearch && matchesGpx;
    });
  }, [trails, search, gpxFilter]);

  const handleDelete = async (trail) => {
    if (confirm(`Delete trail "${trail.name}"?`)) {
      try {
        await deleteTrail(trail.id);
      } catch (err) {
        alert('Delete failed: ' + err.message);
      }
    }
  };

  const handleNewTrail = async () => {
    const name = prompt('Trail name:');
    if (!name) return;
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (trails.find(t => t.id === id)) {
      alert('A trail with this ID already exists.');
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
      navigate(`/trail/${id}`);
    } catch (err) {
      alert('Create failed: ' + err.message);
    }
  };

  const handleImportDatabase = () => {
    createFileInput({
      accept: '.xls',
      onFile: async (file) => {
        if (file.name !== 'Hike Data BaseM.xls') {
          alert('Invalid file: "' + file.name + '". Only "Hike Data BaseM.xls" is accepted.');
          return;
        }
        try {
          const result = await importTrailsFromXls(file);
          if (!result.success) {
            alert('Import failed: ' + (result.error?.message || 'Unknown error'));
            return;
          }
          alert(result.message || 'Trail database imported successfully!');
          window.location.reload();
        } catch (err) {
          alert('Import error: ' + err.message);
        }
      },
    });
  };

  const handleImportHikeTsv = () => {
    createFileInput({
      accept: '.tsv,.txt',
      onFile: async (file) => {
        const text = await file.text();
        try {
          const { trail: parsedTrail, detail: parsedDetail } = parseTrailTsv(text);
          if (!parsedTrail.fullName) {
            alert('Import failed: Trail Name is required.');
            return;
          }
          const existingByName = trails.find(t => t.fullName === parsedTrail.fullName);
          let targetTrail = existingByName;
          if (existingByName) {
            const action = prompt(
              `Trail "${parsedTrail.fullName}" already exists.\n\n` +
              `Type "update" to update it, "new" to create a duplicate, or anything else to cancel.`
            );
            if (action === 'update') {
              targetTrail = existingByName;
            } else if (action === 'new') {
              parsedTrail.fullName = `${parsedTrail.fullName} (copy)`;
              parsedTrail.name = `${parsedTrail.name || parsedTrail.fullName} (copy)`;
              targetTrail = null;
            } else {
              return;
            }
          }
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
          alert(`Trail "${saved.fullName}" imported successfully!`);
          navigate(`/trail/${savedId}?edit=true`);
        } catch (err) {
          alert('Import failed: ' + (err.message || 'Invalid TSV format'));
        }
      },
    });
  };

  const exportMonthlyTsv = useCallback(() => {
    const header = ['Trail ID', 'Trail Name', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const rows = [header];
    for (const trail of trails) {
      const monthly = trailDetails?.[trail.id]?.popularity?.monthly || [];
      const row = [trail.id, trail.fullName || trail.name];
      for (let m = 0; m < 12; m++) {
        row.push(String(monthly[m] || 0));
      }
      rows.push(row);
    }
    const tsv = rows.map(r => r.join('\t')).join('\n');
    downloadBlob(tsv, 'trail_monthly_popularity.tsv', 'text/tab-separated-values');
  }, [trails, trailDetails]);

  const importMonthlyTsv = useCallback(() => {
    createFileInput({
      accept: '.tsv,.txt,.csv',
      onFile: async (file) => {
        const text = await file.text();
        const lines = text.trim().split('\n');
        if (lines.length < 2) {
          alert('TSV file is empty or has only a header.');
          return;
        }
        const headerCols = lines[0].split('\t');
        const isMonthly = headerCols.length >= 14 && headerCols[2]?.trim() === 'Jan';
        if (!isMonthly) {
          alert('This is not a monthly popularity TSV.\n\nExpected 14 columns: Trail ID, Trail Name, Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec');
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
        alert(`Updated monthly popularity for ${updated} trail(s).`);
      },
    });
  }, [trails, trailDetails, saveTrailDetail]);

  const exportScheduleJson = useCallback(async () => {
    try {
      const schedule = await getSchedule();
      const dateStr = formatDateToISO();
      const prefix = getGroupName() || 'hiker';
      const filename = `${prefix}-schedule-${dateStr}.json`;
      const json = JSON.stringify(schedule, null, 2);
      downloadBlob(json, filename, 'application/json');
    } catch (err) {
      alert('Export failed: ' + err.message);
    }
  }, []);

  const importScheduleJson = useCallback(async () => {
    if (!hasApiKey) {
      alert('API key required for schedule import.');
      return;
    }
    createFileInput({
      accept: '.json',
      onFile: async (file) => {
        const text = await file.text();
        try {
          const schedule = JSON.parse(text);
          if (!confirm('Replace the entire schedule with this data? This will overwrite all current schedule entries.')) return;
          await updateSchedule(schedule);
          alert('Schedule imported successfully!');
          window.location.reload();
        } catch {
          alert('Import failed: Invalid JSON format');
        }
      },
    });
  }, [hasApiKey]);

  const exportAllDataJson = useCallback(async () => {
    try {
      const data = await exportJSON();
      const prefix = getGroupName() || 'hiker';
      downloadBlob(JSON.stringify(data, null, 2), `${prefix}-trail-data.json`);
    } catch (err) {
      alert('Export failed: ' + err.message);
    }
  }, [exportJSON]);

  const importAllDataJson = useCallback(() => {
    if (!hasApiKey) {
      alert('API key required for data import.');
      return;
    }
    createImportFileInput(
      async (imported) => {
        if (!confirm('Import trail data? This will upsert all trails and details from the file.')) return;
        try {
          await importJSON(imported);
          alert('Data imported successfully!');
          window.location.reload();
        } catch (err) {
          alert('Import failed: ' + err.message);
        }
      },
      (msg) => alert(msg)
    );
  }, [hasApiKey, importJSON]);

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
      alert('Export failed: ' + err.message);
    }
  }, []);

  const exportGpxZip = useCallback(async () => {
    const trailsWithGpx = trails.filter(t => t.hasGpx);
    if (trailsWithGpx.length === 0) {
      alert('No trails have GPX files.');
      return;
    }
    const zip = new JSZip();
    let downloaded = 0;
    let failed = 0;
    for (const trail of trailsWithGpx) {
      try {
        const gpx = await getGpx(trail.id);
        if (gpx) {
          const safeName = sanitizeFilename(trail.fullName || trail.name, trail.id);
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
      alert('Failed to fetch any GPX files.');
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
    alert(`Exported ${downloaded} GPX file(s).${failed > 0 ? ` (${failed} failed)` : ''}`);
  }, [trails]);

  const importAllDataZip = useCallback(() => {
    if (!hasApiKey) {
      alert('API key required for data import.');
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (!confirm('Import all data from ZIP? This will overwrite matching JSON files on the server. ' + Object.keys(JSON.parse(JSON.stringify({ trails: 1, details: 2, schedule: 3, lookup: 4, gpx: 5 }))).length + ' files will be checked.')) return;
      try {
        const result = await importDataZip(file);
        alert(`Data imported successfully! ${result.imported} file(s) written.`);
        window.location.reload();
      } catch (err) {
        alert('Import failed: ' + err.message);
      }
    };
    input.click();
  }, [hasApiKey]);

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="container mx-auto px-4 py-3 max-w-5xl">
        <div className="flex items-baseline justify-between mb-4">
          <PageNav />
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">v{APP_VERSION}</span>
            <p className="text-gray-600 text-sm">
              {filteredTrails.length} of {trails.length} trails
            </p>
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              title={tt('Go back to previous page')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <input
            type="text"
            placeholder="Search trails..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
          />
          <div className="flex items-center gap-1 text-sm">
            <button onClick={() => setGpxFilter('all')} className={`px-2.5 py-1 rounded-md transition-colors ${gpxFilter === 'all' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>All</button>
            <button onClick={() => setGpxFilter('gpx')} className={`px-2.5 py-1 rounded-md transition-colors ${gpxFilter === 'gpx' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>GPX</button>
            <button onClick={() => setGpxFilter('noGpx')} className={`px-2.5 py-1 rounded-md transition-colors ${gpxFilter === 'noGpx' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>No GPX</button>
          </div>
          <button onClick={handleNewTrail} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2" title={tt('Add a new trail')}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Trail
          </button>
          <button onClick={handleImportDatabase} disabled={!hasApiKey} className={`px-3 py-2 rounded-lg transition-colors text-sm flex items-center gap-2 ${hasApiKey ? 'bg-gray-100 hover:bg-gray-200 text-gray-700' : 'bg-gray-50 text-gray-300 cursor-not-allowed'}`} title={tt('Import trails from Hike Data BaseM.xls')}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Import Database {!hasApiKey && '(need API key)'}
          </button>
          <button onClick={handleImportHikeTsv} disabled={!hasApiKey} className={`px-3 py-2 rounded-lg transition-colors text-sm flex items-center gap-2 ${hasApiKey ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-50 text-gray-300 cursor-not-allowed'}`} title={tt('Import a single hike from TSV file')}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Import Hike TSV {!hasApiKey && '(need API key)'}
          </button>
          <button onClick={exportAllDataJson} className="px-3 py-2 rounded-lg transition-colors text-sm flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white" title={tt('Export all trail data as JSON')}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export All JSON
          </button>
          <button onClick={importAllDataJson} disabled={!hasApiKey} className={`px-3 py-2 rounded-lg transition-colors text-sm flex items-center gap-2 ${hasApiKey ? 'bg-yellow-600 hover:bg-yellow-700 text-white' : 'bg-gray-50 text-gray-300 cursor-not-allowed'}`} title={tt('Import all trail data from JSON file')}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Import All JSON {!hasApiKey && '(need API key)'}
          </button>
          <button onClick={exportAllDataZip} className="px-3 py-2 rounded-lg transition-colors text-sm flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white" title={tt('Export all server data (trails, details, schedule, lookup, gpx) as ZIP')}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            Export ZIP
          </button>
          <button onClick={importAllDataZip} disabled={!hasApiKey} className={`px-3 py-2 rounded-lg transition-colors text-sm flex items-center gap-2 ${hasApiKey ? 'bg-orange-600 hover:bg-orange-700 text-white' : 'bg-gray-50 text-gray-300 cursor-not-allowed'}`} title={tt('Import all server data from ZIP file (overwrites matching JSON)')}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            Import ZIP {!hasApiKey && '(need API key)'}
          </button>
          <button onClick={exportGpxZip} className="px-3 py-2 rounded-lg transition-colors text-sm flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white" title={tt('Download all GPX files as a ZIP, renamed by trail name')}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            Export GPX ZIP
          </button>
          <div className="flex items-center gap-2 ml-auto">
            <input
              type="password"
              placeholder="API Key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-56 focus:ring-green-500 focus:border-green-500"
              title={tt('Enter your API key for write operations')}
            />
            <button onClick={handleSaveApiKey} className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm whitespace-nowrap" title={tt('Save API key to localStorage')}>
              Save Key
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">Trail Manager</h3>
            <div className="flex gap-2">
              <button
                onClick={handleValidateDatabase}
                disabled={validating || !hasApiKey}
                className={`text-xs px-3 py-1.5 rounded transition-colors flex items-center gap-1 ${
                  hasApiKey && !validating
                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
                title={tt('Verify all database files in exported_data are usable')}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {validating ? 'Validating...' : 'Validate Database'} {!hasApiKey && '(need API key)'}
              </button>
              <button
                onClick={exportMonthlyTsv}
                className="text-xs px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                title={tt('Export monthly popularity as TSV file')}
              >
                Export Month of Year Pop DB
              </button>
              <button
                onClick={importMonthlyTsv}
                className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                title={tt('Import monthly popularity from TSV file')}
              >
                Import Month of Year Pop DB
              </button>
              <button
                onClick={exportScheduleJson}
                className="text-xs px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                title={tt('Export the full schedule as a JSON file')}
              >
                Export Schedule JSON
              </button>
              <button
                onClick={importScheduleJson}
                disabled={!hasApiKey}
                className={`text-xs px-3 py-1.5 rounded transition-colors ${
                  hasApiKey
                    ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
                title={tt('Import a full schedule from a JSON file')}
              >
                Import Schedule JSON
              </button>
            </div>
           </div>
           {validationResults && (
             <div className={`px-4 py-2 border-b ${validationResults.valid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
               <div className="flex items-center gap-2">
                 <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   {validationResults.valid ? (
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                   ) : (
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                   )}
                 </svg>
                 <span className={`text-sm font-medium ${validationResults.valid ? 'text-green-800' : 'text-red-800'}`}>
                   {validationResults.valid ? 'All database files are valid' : `${validationResults.results.filter(r => !r.valid).length} file(s) with errors`}
                 </span>
               </div>
               <div className="mt-1 space-y-0.5">
                 {validationResults.results.map((r, i) => (
                   <div key={i} className={`text-xs ${r.valid ? 'text-green-700' : 'text-red-700'}`}>
                     {r.valid ? '✓' : '✗'} {r.file}
                     {r.recordCount != null && ` (${r.recordCount} ${r.recordCount === 1 ? 'entry' : 'entries'})`}
                     {r.issues && r.issues.length > 0 && ` — ${r.issues.join('; ')}`}
                     {!r.valid && !r.issues && r.error && ` — ${r.error}`}
                   </div>
                 ))}
               </div>
             </div>
           )}
           <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-right px-2 py-3 text-sm font-semibold text-gray-700 w-12">#</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Name</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 w-24">Distance</th>
                  <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700 w-16">Schedule Count</th>
                  <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700 w-20">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTrails.map((trail, index) => (
                  <tr key={`${trail.id}-${index}`} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-2 py-3 text-right text-sm text-gray-400">{index + 1}</td>
                    <td className="px-4 py-3">
                      <Link to={`/trail/${trail.id}`} className="text-green-700 hover:text-green-900 font-medium">
                        {trail.fullName || trail.name}
                      </Link>
                      <span className="ml-2 text-xs text-gray-400">{trail.id}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {trail.distance != null ? `${trail.distance} mi` : 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-gray-800">
                      {getScheduleCount(trail.id)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/trail/${trail.id}`}
                          className="text-green-600 hover:text-green-800"
                          title={tt('View and edit trail details')}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </Link>
                        <button
                          onClick={() => {
                            const tsvDetail = trailDetails?.[trail.id] || {};
                            const tsv = exportTrailTsv(trail, tsvDetail);
                            const safeName = sanitizeFilename(trail.name, 'trail');
                            downloadBlob(tsv, `${safeName}.tsv`, 'text/tab-separated-values');
                          }}
                          className="text-blue-600 hover:text-blue-800"
                          title={tt('Export this hike as TSV')}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(trail)}
                          className="text-red-400 hover:text-red-600"
                          title={tt('Delete this trail')}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredTrails.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              {search ? 'No trails match your search.' : 'No trails found. Import or create trails to get started.'}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
