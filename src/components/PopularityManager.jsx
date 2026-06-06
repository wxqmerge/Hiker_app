import { useState, useCallback } from 'react';
import { useTrailStore } from '../hooks/useTrailStore';
import { useTooltips } from '../hooks/useTooltips';
import { createFileInput, downloadBlob } from '../utils/io';

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function PopularityManager({ trails, trailDetails }) {
  const { title: tt } = useTooltips();
  const { saveTrailDetail } = useTrailStore();
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

  const exportTsv = useCallback(() => {
    const rows = [['Trail ID', 'Trail Name', 'Schedule Count']];
    for (const trail of trails) {
      const count = localCounts[trail.id] ?? trailDetails?.[trail.id]?.popularity?.scheduleCount ?? 0;
      rows.push([trail.id, trail.fullName || trail.name, String(count)]);
    }
    const tsv = rows.map(r => r.join('\t')).join('\n');
    downloadBlob(tsv, 'trail_schedule_count.tsv', 'text/tab-separated-values');
  }, [trails, localCounts, trailDetails]);

  const importTsv = useCallback(() => {
    createFileInput({
      accept: '.tsv,.txt,.csv',
      onFile: async (file) => {
        const text = await file.text();
        const lines = text.trim().split('\n');
        if (lines.length < 2) {
          alert('TSV file is empty or has only a header.');
          return;
        }
        let updated = 0;
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split('\t');
          if (cols.length < 3) continue;
          const trailId = cols[0].trim();
          const count = parseInt(cols[2].trim(), 10);
          if (isNaN(count)) continue;
          const trail = trails.find(t => t.id === trailId);
          if (!trail) continue;
          const existing = trailDetails?.[trailId]?.popularity || {};
          await saveTrailDetail(trailId, {
            ...existing,
            popularity: { ...existing, scheduleCount: count },
          });
          setLocalCounts(prev => ({ ...prev, [trailId]: count }));
          updated++;
        }
        alert(`Updated schedule count for ${updated} trail(s).`);
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
          Schedule Count Manager
        </h3>
        <div className="flex gap-2">
          <button
            onClick={exportTsv}
            className="text-xs px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
            title={tt('Export schedule counts as TSV file')}
          >
            Export TSV
          </button>
          <button
            onClick={importTsv}
            className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
            title={tt('Import schedule counts from TSV file')}
          >
            Import TSV
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
