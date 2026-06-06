import { useState, useCallback } from 'react';
import { useTrailStore } from '../hooks/useTrailStore';
import { useTooltips } from '../hooks/useTooltips';
import { createFileInput, downloadBlob } from '../utils/io';

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function PopularityManager({ trails, trailDetails }) {
  const { title: tt } = useTooltips();
  const { saveTrailDetail } = useTrailStore();
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
        // Schedule count TSV from generate_schedule_count.py: Trail ID, Trail Name, Schedule Count, Jan, Feb, ..., Dec
        const isScheduleCountMonthly = headerCols.length >= 14 && headerCols[2]?.trim() === 'Schedule Count' && headerCols[3]?.trim() === 'Jan';
        // Monthly TSV from match_schedule.py: Trail ID, Trail Name, Jan, Feb, ..., Dec
        const isMonthlyOnly = headerCols.length >= 14 && headerCols[2]?.trim() === 'Jan';
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
        // Detect if this is monthly TSV (has 14 columns: Trail ID, Trail Name, Jan, Feb, ..., Dec)
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

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">
          Popularity Manager
        </h3>
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
      <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
            <tr>
              <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600">Trail</th>
              <th className="text-right px-4 py-2 text-xs font-semibold text-gray-600 w-32">Schedule Count</th>
            </tr>
          </thead>
          <tbody>
            {trails.map(trail => (
              <tr key={trail.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-2 text-sm text-gray-800">
                  {trail.fullName || trail.name}
                  <span className="ml-1 text-xs text-gray-400">({trail.id})</span>
                </td>
                <td className="px-4 py-2 text-right">
                  <input
                    type="number"
                    min="0"
                    value={localCounts[trail.id] ?? trailDetails?.[trail.id]?.popularity?.scheduleCount ?? 0}
                    onChange={(e) => updateCount(trail.id, e.target.value)}
                    className="w-24 text-right px-2 py-1 border border-gray-300 rounded text-sm focus:ring-green-500 focus:border-green-500"
                    title={tt(`Schedule count for ${trail.fullName || trail.name}`)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
