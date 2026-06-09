import { useState, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PageNav from '../components/PageNav';
import { useTrailStore } from '../hooks/useTrailStore';
import { useTooltips } from '../hooks/useTooltips';
import { createFileInput, createImportFileInput, downloadBlob, exportTrailTsv, parseTrailTsv } from '../utils/io';
import { MONTH_ABBR } from '../utils/constants';
import { importTrailsFromXls, getSchedule, updateSchedule } from '../api/client';

export default function TrailManager() {
  const { title: tt } = useTooltips();
  const { trails, loading, trailDetails, saveTrail, deleteTrail, saveTrailDetail, exportJSON, importJSON } = useTrailStore();
  const [search, setSearch] = useState('');
  const [apiKey, setApiKey] = useState(localStorage.getItem('hiker-api-key') || '');
  const getScheduleCount = (trailId) => {
    const trail = trails.find(t => t.id === trailId);
    if (!trail) return 0;
    const monthly = trailDetails?.[trailId]?.popularity?.monthly;
    if (!monthly || !Array.isArray(monthly)) return 0;
    const seasonalKeys = Object.keys(trail.seasonal || {}).filter(k => MONTH_ABBR.includes(k));
    const hasQuarterData = seasonalKeys.length > 0;
    return monthly.reduce((sum, v, idx) => {
      const quarterBase = hasQuarterData ? 1 : 0;
      const monthBase = seasonalKeys.includes(MONTH_ABBR[idx]) ? 1 : 0;
      const hikeCount = v || 0;
      const scheduleBase = Math.min(9, hikeCount * 2);
      return sum + Math.min(9, quarterBase + monthBase + scheduleBase);
    }, 0);
  };
  const navigate = useNavigate();
  const hasApiKey = apiKey.trim().length > 0;

  const handleSaveApiKey = () => {
    localStorage.setItem('hiker-api-key', apiKey);
    alert('API key saved!');
  };

  const filteredTrails = useMemo(() => {
    if (!search) return trails;
    const q = search.toLowerCase();
    return trails.filter(t =>
      t.name?.toLowerCase().includes(q) ||
      t.fullName?.toLowerCase().includes(q) ||
      t.id?.toLowerCase().includes(q)
    );
  }, [trails, search]);

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
          const saved = targetTrail
            ? await saveTrail({ ...parsedTrail, id: targetTrail.id })
            : await saveTrail(parsedTrail);
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
          navigate(`/trail/${savedId}`);
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
            ...existing,
            popularity: { ...existing, monthly },
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
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const filename = `schedule_${dateStr}.json`;
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
      downloadBlob(JSON.stringify(data, null, 2), 'trail-data.json');
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="container mx-auto px-4 py-3 max-w-5xl">
        <div className="flex items-baseline justify-between mb-4">
          <PageNav />
          <p className="text-gray-600 text-sm ml-auto">
            {filteredTrails.length} of {trails.length} trails
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <input
            type="text"
            placeholder="Search trails..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
          />
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
                            const safeName = (trail.name || 'trail').replace(/[^a-zA-Z0-9]/g, '_');
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
