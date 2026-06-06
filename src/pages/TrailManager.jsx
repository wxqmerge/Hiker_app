import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PageNav from '../components/PageNav';
import { useTrailStore } from '../hooks/useTrailStore';
import { useTooltips } from '../hooks/useTooltips';
import { createFileInput } from '../utils/io';
import { importTrailsFromXls } from '../api/client';
import PopularityManager from '../components/PopularityManager';

export default function TrailManager() {
  const { title: tt } = useTooltips();
  const { trails, loading, trailDetails, saveTrail, deleteTrail } = useTrailStore();
  const [search, setSearch] = useState('');
  const [apiKey, setApiKey] = useState(localStorage.getItem('hiker-api-key') || '');
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
        <div className="flex items-baseline justify-between mb-6">
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
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-right px-2 py-3 text-sm font-semibold text-gray-700 w-12">#</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Name</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Distance</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Difficulty</th>
                  <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">Actions</th>
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
                    <td className="px-4 py-3 text-sm text-gray-600">{trail.difficulty}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/trail/${trail.id}`}
                          className="text-green-600 hover:text-green-800"
                          title={tt('View and edit trail details')}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </Link>
                        <button
                          onClick={() => handleDelete(trail)}
                          className="text-red-400 hover:text-red-600"
                          title={tt('Delete this trail')}
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

        <div className="mt-6">
          <PopularityManager trails={trails} trailDetails={trailDetails || {}} />
        </div>
      </main>
    </div>
  );
}
