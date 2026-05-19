import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTrails, useFilters } from '../hooks/useTrails';
import FilterPanel from '../components/FilterPanel';
import TrailList from '../components/TrailList';
import { useTrailDetails } from '../hooks/useTrailDetails';

const EDIT_STORAGE_KEY = 'hiker-trail-edits';

export default function Home() {
  const { trails, lookup, loading, error } = useTrails();
  const { filters, setFilters, sortedTrails, resetFilters } = useFilters(trails);
  const trailDetails = useTrailDetails();
  const [hasEdits, setHasEdits] = useState(false);

  useEffect(() => {
    const allEdits = JSON.parse(localStorage.getItem(EDIT_STORAGE_KEY) || '{}');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasEdits(Object.keys(allEdits).length > 0);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading trails...</p>
        </div>
      </div>
    );
  }

  // Merge edits with original data and download
  const exportMergedData = async () => {
    if (!trailDetails) {
      alert('Trail details not loaded yet. Please wait a moment.');
      return;
    }

    const allEdits = JSON.parse(localStorage.getItem(EDIT_STORAGE_KEY) || '{}');
    if (Object.keys(allEdits).length === 0) {
      alert('No edits to export.');
      return;
    }

    // Merge into trail_details.json
    const mergedDetails = { ...trailDetails };
    Object.entries(allEdits).forEach(([trailId, edits]) => {
      if (!mergedDetails[trailId]) {
        // Use fallback ID (first word of trail name)
        const trail = trails.find(t => t.id === trailId);
        if (trail) {
          const fallbackId = trail.name.toLowerCase().split('-')[0];
          if (!mergedDetails[fallbackId]) {
            mergedDetails[trailId] = {};
          } else {
            mergedDetails[fallbackId] = { ...mergedDetails[fallbackId], ...edits };
            return;
          }
        }
      }
      // Merge trail_details.json edits
      if (edits.description !== undefined) mergedDetails[trailId].fullDescription = edits.description;
      if (edits.pros !== undefined) mergedDetails[trailId].pros = edits.pros;
      if (edits.others !== undefined) mergedDetails[trailId].others = edits.others;
      if (edits.leaders !== undefined) mergedDetails[trailId].leaders = edits.leaders;
    });

    // Merge into trails.json
    const mergedTrails = trails.map(trail => {
      const trailEdits = allEdits[trail.id];
      if (!trailEdits) return trail;

      const updatedTrail = { ...trail };
      
      // Basic fields
      if (trailEdits.fullName !== undefined) updatedTrail.fullName = trailEdits.fullName;
      if (trailEdits.notes !== undefined) updatedTrail.notes = trailEdits.notes;
      if (trailEdits.distance !== undefined) updatedTrail.distance = trailEdits.distance;
      if (trailEdits.distanceExtended !== undefined) updatedTrail.distanceExtended = trailEdits.distanceExtended;
      if (trailEdits.elevationStart !== undefined) updatedTrail.elevationStart = trailEdits.elevationStart;
      if (trailEdits.elevationMax !== undefined) updatedTrail.elevationMax = trailEdits.elevationMax;
      if (trailEdits.difficulty !== undefined) updatedTrail.difficulty = trailEdits.difficulty;
      if (trailEdits.parking !== undefined) updatedTrail.parking = trailEdits.parking;
      if (trailEdits.range !== undefined) updatedTrail.range = trailEdits.range;
      
      // Seasonal fields
      if (trailEdits.bestSeason !== undefined || trailEdits.parkingInfo !== undefined || trailEdits.availableMonths !== undefined) {
        if (!updatedTrail.seasonal) updatedTrail.seasonal = {};
        if (trailEdits.bestSeason !== undefined) updatedTrail.seasonal.bestSeason = trailEdits.bestSeason;
        if (trailEdits.parkingInfo !== undefined) updatedTrail.seasonal.parkingInfo = trailEdits.parkingInfo;
        if (trailEdits.availableMonths !== undefined) updatedTrail.seasonal.availableMonths = trailEdits.availableMonths;
      }
      
      return updatedTrail;
    });

    // Download trail_details.json
    const detailsStr = JSON.stringify(mergedDetails, null, 2);
    const detailsBlob = new Blob([detailsStr], { type: 'application/json' });
    const detailsUrl = URL.createObjectURL(detailsBlob);
    const detailsA = document.createElement('a');
    detailsA.href = detailsUrl;
    detailsA.download = 'trail_details.json';
    detailsA.click();
    URL.revokeObjectURL(detailsUrl);

    // Wait a moment then download trails.json
    setTimeout(() => {
      const trailsStr = JSON.stringify(mergedTrails, null, 2);
      const trailsBlob = new Blob([trailsStr], { type: 'application/json' });
      const trailsUrl = URL.createObjectURL(trailsBlob);
      const trailsA = document.createElement('a');
      trailsA.href = trailsUrl;
      trailsA.download = 'trails.json';
      trailsA.click();
      URL.revokeObjectURL(trailsUrl);

      // Clear localStorage after successful export
      localStorage.removeItem(EDIT_STORAGE_KEY);
      setHasEdits(false);
      alert('Exported merged data! Please copy the downloaded files to hiker-app/public/data/');
    }, 500);
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center text-red-600">
          <p>Error loading data: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="container mx-auto px-4 py-3">
        <div className="mb-6 flex items-baseline gap-3">
          <h2 className="text-2xl font-bold text-gray-900">Browse Trails</h2>
          <span className="text-gray-300">|</span>
          <Link to="/schedule" className="text-green-700 hover:text-green-900 font-medium text-sm">
            Schedule Builder
          </Link>
          <p className="text-gray-600 text-sm ml-auto">
            Showing {sortedTrails.length} of {trails.length} trails
          </p>
        </div>

        <FilterPanel 
          filters={filters}
          setFilters={setFilters}
          lookup={lookup}
          resetFilters={resetFilters}
        />

        <TrailList trails={sortedTrails} />

        {/* Export Merged Data Button */}
        {hasEdits && (
          <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white rounded-lg shadow-xl border border-gray-200 p-4 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-gray-700 font-medium">Unsaved edits available</span>
            </div>
            <button
              onClick={exportMergedData}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0l-4 4m4-4v12" />
              </svg>
              Export Merged Data
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
