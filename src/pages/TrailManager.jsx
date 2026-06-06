import { useState, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PageNav from '../components/PageNav';
import { useTrailStore } from '../hooks/useTrailStore';
import { useTooltips } from '../hooks/useTooltips';
import { createFileInput, downloadBlob } from '../utils/io';
import { importTrailsFromXls } from '../api/client';

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function TrailManager() {
  const { title: tt } = useTooltips();
  const { trails, loading, trailDetails, saveTrail, deleteTrail, saveTrailDetail } = useTrailStore();
  const [search, setSearch] = useState('');
  const [apiKey, setApiKey] = useState(localStorage.getItem('hiker-api-key') || '');
  const [importMode, setImportMode] = useState('replace');
  const [localCounts, setLocalCounts] = useState(() => {
    const counts = {};
    for (const trail of trails) {
      const pop = trailDetails?.[trail.id]?.popularity;
      if (pop?.scheduleCount) {
        counts[trail.id] = pop.scheduleCount;
      }
    }
    return counts;
  });
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

  const exportScheduleTsv = useCallback(() => {
    const rows = [['Trail ID', 'Trail Name', 'Schedule Count']];
    for (const trail of trails) {
      const count = localCounts[trail.id] ?? trailDetails?.[trail.id]?.popularity?.scheduleCount ?? 0;
      rows.push([trail.id, trail.fullName || trail.name, String(count)]);
    }
    const tsv = rows.map(r => r.join('\t')).join('\n');
    downloadBlob(tsv, 'trail_schedule_count.tsv', 'text/tab-separated-values');
  }, [trails, localCounts, trailDetails]);

  const importScheduleTsv = useCallback(() => {
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
        const isScheduleCountMonthly = headerCols.length >= 14 && headerCols[2]?.trim() === 'Schedule Count' && headerCols[3]?.trim() === 'Jan';
        let updated = 0;
        let withMonthly = 0;
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split('\t');
          if (cols.length < 3) continue;
          const trailId = cols[0].trim();
          const count = parseInt(cols[2].trim(), 10);
          if (isNaN(count)) continue;
          const trail = trails.find(t => t.id === trailId);
          if (!trail) continue;
          const existing = trailDetails?.[trailId]?.popularity || {};
          const existingCount = existing.scheduleCount || 0;
          const newCount = importMode === 'add' ? existingCount + count : count;
          const update = {
            ...existing,
            popularity: { ...existing, scheduleCount: newCount },
          };
          if (isScheduleCountMonthly) {
            const monthly = [];
            for (let m = 3; m < 15; m++) {
              const val = parseInt(cols[m]?.trim(), 10);
              monthly.push(isNaN(val) ? 0 : val);
            }
            update.popularity = { ...update.popularity, monthly };
            withMonthly++;
          }
          await saveTrailDetail(trailId, update);
          setLocalCounts(prev => ({ ...prev, [trailId]: newCount }));
          updated++;
        }
        const monthlyMsg = isScheduleCountMonthly ? ` (${withMonthly} with monthly data)` : '';
        alert(`Updated schedule count for ${updated} trail(s)${monthlyMsg} (${importMode === 'add' ? 'added to existing' : 'replaced'}).`);
      },
    });
  }, [trails, trailDetails, saveTrailDetail, importMode]);

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
          alert('This appears to be a schedule count TSV, not a monthly popularity TSV.\n\nMonthly TSV should have 14 columns: Trail ID, Trail Name, Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec');
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

  const updateCount = useCallback(async (trailId, value) => {
    const count = parseInt(value, 10) || 0;
    setLocalCounts(prev => ({ ...prev, [trailId]: count }));
    const existing = trailDetails?.[trailId]?.popularity || {};
    await saveTrailDetail(trailId, {
      ...existing,
      popularity: { ...existing, scheduleCount: count },
    });
  }, [trailDetails, saveTrailDetail]);

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
                onClick={exportScheduleTsv}
                className="text-xs px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                title={tt('Export schedule counts as TSV file')}
              >
                Export Schedule Count
              </button>
              <select
                value={importMode}
                onChange={(e) => setImportMode(e.target.value)}
                className="text-xs px-2 py-1.5 border border-gray-300 rounded bg-white"
                title={tt('Replace: overwrite existing counts. Add: add imported counts to existing.')}
              >
                <option value="replace">Replace</option>
                <option value="add">Add</option>
              </select>
              <button
                onClick={importScheduleTsv}
                className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                title={tt('Import schedule counts from TSV file')}
              >
                Import Schedule Count
              </button>
              <button
                onClick={importMonthlyTsv}
                className="text-xs px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors"
                title={tt('Import monthly popularity from trail_monthly_popularity.tsv (generated by match_schedule.py)')}
              >
                Import Monthly
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
                  <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700 w-32">Schedule Count</th>
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
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <input
                          type="number"
                          min="0"
                          value={localCounts[trail.id] ?? trailDetails?.[trail.id]?.popularity?.scheduleCount ?? 0}
                          onChange={(e) => updateCount(trail.id, e.target.value)}
                          className="w-14 text-right px-2 py-1 border border-gray-300 rounded text-sm focus:ring-green-500 focus:border-green-500"
                          title={tt(`Schedule count for ${trail.fullName || trail.name}`)}
                        />
                      </div>
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
