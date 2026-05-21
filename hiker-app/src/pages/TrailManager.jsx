import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTrailStore } from '../hooks/useTrailStore';
import { downloadBlob, createImportFileInput } from '../utils/io';

export default function TrailManager() {
  const { trails, loading, saveTrail, deleteTrail, exportJSON, importJSON } = useTrailStore();
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

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
      await deleteTrail(trail.id);
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
    await saveTrail(newTrail);
    navigate(`/trail/${id}`);
  };

  const handleExport = async () => {
    const data = await exportJSON();
    downloadBlob(JSON.stringify(data, null, 2), 'trail-data-export.json');
  };

  const handleImport = () => {
    createImportFileInput(
      async (imported) => {
        await importJSON(imported);
        alert('Data imported successfully!');
      },
      (msg) => alert(msg)
    );
  };

  const handleExportForExcel = async () => {
    const data = await exportJSON();
    downloadBlob(JSON.stringify({ trails: data.trails.trails }, null, 2), 'trails.json');
    setTimeout(() => {
      downloadBlob(JSON.stringify(data.trailDetails, null, 2), 'trail_details.json');
    }, 500);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="container mx-auto px-4 py-3 max-w-4xl">
        <div className="mb-6 flex items-baseline gap-3">
          <h2 className="text-2xl font-bold text-gray-900">Trail Manager</h2>
          <span className="text-gray-300">|</span>
          <Link to="/" className="text-green-700 hover:text-green-900 font-medium text-sm">
            Browse Trails
          </Link>
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
          <button onClick={handleNewTrail} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Trail
          </button>
          <button onClick={handleExport} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm">
            Export JSON
          </button>
          <button onClick={handleImport} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm">
            Import JSON
          </button>
          <button onClick={handleExportForExcel} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm">
            Export for Excel
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Name</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Distance</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Difficulty</th>
                  <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTrails.map(trail => (
                  <tr key={trail.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link to={`/trail/${trail.id}`} className="text-green-700 hover:text-green-900 font-medium">
                        {trail.name}
                      </Link>
                      <span className="ml-2 text-xs text-gray-400">{trail.id}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {trail.distance != null ? `${trail.distance} mi` : 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{trail.difficulty}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/trail/${trail.id}`}
                          className="text-green-600 hover:text-green-800"
                          title="Edit"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </Link>
                        <button
                          onClick={() => handleDelete(trail)}
                          className="text-red-400 hover:text-red-600"
                          title="Delete"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
