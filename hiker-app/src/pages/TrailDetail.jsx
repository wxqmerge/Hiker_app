import { useParams, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useTrails } from '../hooks/useTrails';
import { generateReportText as genReport, copyToClipboard, getRideCost } from '../utils/report';
import { getTrailDetailsById } from '../utils/data';

export default function TrailDetail() {
  const { id } = useParams();
  const { trails, loading } = useTrails();
  const [trailDetails, setTrailDetails] = useState(null);
  const [copied, setCopied] = useState(false);

  const trail = trails.find(t => t.id === id);
  const currentIndex = trails.findIndex(t => t.id === id);

  useEffect(() => {
    fetch('/data/trail_details.json')
      .then(res => res.json())
      .then(data => setTrailDetails(data))
      .catch(err => console.error('Error loading trail details:', err));
  }, []);

  // Get trail details with fallback for ID mismatch
  const getTrailDetails = () => getTrailDetailsById(trailDetails, id);

  const copyReport = async () => {
    await copyToClipboard(genReport(trail, getTrailDetails()), (status) => {
      setCopied(status);
      if (status) setTimeout(() => setCopied(false), 2000);
    });
  };

  const goToPrevious = () => {
    if (currentIndex > 0) {
      window.location.href = `/trail/${trails[currentIndex - 1].id}`;
    }
  };

  const goToNext = () => {
    if (currentIndex < trails.length - 1) {
      window.location.href = `/trail/${trails[currentIndex + 1].id}`;
    }
  };

  const difficultyColors = {
    'Easy': 'bg-green-200 text-green-900',
    'Easy to Mod': 'bg-lime-200 text-lime-900',
    'Moderate': 'bg-yellow-200 text-yellow-900',
    'Mod to Diff': 'bg-orange-200 text-orange-900',
    'Difficult': 'bg-red-200 text-red-900'
  };

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const rideCost = trail?.range ? getRideCost(parseInt(trail.range)) : null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (!trail) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl text-gray-800 mb-2">Trail not found</h2>
          <Link to="/" className="text-green-600 hover:underline">Back to browse</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="container mx-auto px-4 py-3 max-w-3xl">
        {/* Top Navigation Bar */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 mb-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            {/* Left side: Back + Trail position */}
            <div className="flex items-center gap-4">
              <Link to="/" className="text-green-700 hover:text-green-900 font-medium flex items-center gap-1">
                ← Browse
              </Link>
              <span className="text-gray-300">|</span>
              <div className="text-sm text-gray-600">
                Trail {currentIndex + 1} of {trails.length}
              </div>
            </div>

            {/* Center: Trail name */}
            <div className="text-center flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{trail.fullName || trail.name}</p>
            </div>

            {/* Right side: Navigation + Copy Report */}
            <div className="flex items-center gap-2">
              <button
                onClick={goToPrevious}
                disabled={currentIndex === 0}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  currentIndex === 0
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Previous
              </button>

              <button
                onClick={goToNext}
                disabled={currentIndex === trails.length - 1}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  currentIndex === trails.length - 1
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                Next
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              <span className="text-gray-300">|</span>

              <button
                onClick={copyReport}
                className={`flex items-center gap-1 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
                  copied ? 'text-green-800' : 'text-green-700 hover:text-green-900'
                }`}
              >
                {copied ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    Copy Report
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="bg-green-800 text-white p-6">
            <h1 className="text-3xl font-bold mb-1">{trail.fullName || trail.name}</h1>
            <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${difficultyColors[trail.difficulty] || 'bg-gray-100 text-gray-800'}`}>
              {trail.difficulty}
            </span>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Stats Grid - All on one line */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              {/* Distance */}
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <svg className="w-6 h-6 mx-auto text-green-600 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                <p className="text-2xl font-bold text-gray-800">
                  {trail.distance?.toFixed(1) || 'N/A'}
                  {trail.distanceExtended && ` / ${trail.distanceExtended.toFixed(1)}`}
                </p>
                <p className="text-sm text-gray-500">miles</p>
              </div>
              
              {/* Elevation Gain */}
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <svg className="w-6 h-6 mx-auto text-green-600 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
                <p className="text-xl font-bold text-gray-800">
                  {trail.elevationStart?.toLocaleString() || 'N/A'} ft - {trail.elevationMax?.toLocaleString() || 'N/A'} ft
                </p>
                <p className="text-sm text-gray-500">elevation gain</p>
              </div>

              {/* Parking */}
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <svg className="w-6 h-6 mx-auto text-green-600 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <p className="text-sm font-bold text-gray-800">{trail.parking || 'N/A'}</p>
                <p className="text-sm text-gray-500">parking</p>
              </div>

              {/* Ride - Combined Range and Cost */}
              {(trail.range || rideCost) && (
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <svg className="w-6 h-6 mx-auto text-green-600 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                  <p className="text-xl font-bold text-gray-800">
                    {rideCost || `Range: ${trail.range}`}
                  </p>
                  <p className="text-sm text-gray-500">ride</p>
                </div>
              )}
            </div>

            {/* Full Description */}
            {getTrailDetails()?.[id]?.fullDescription && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Description</h3>
                <p className="text-gray-600 whitespace-pre-line">{getTrailDetails()[id].fullDescription}</p>
              </div>
            )}

            {/* Notes */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Notes</h3>
              <p className="text-gray-600">{trail.notes}</p>
            </div>

            {/* Seasonal Availability */}
            {trail.seasonal?.availableMonths?.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Available Months</h3>
                <div className="flex flex-wrap gap-2">
                  {trail.seasonal.availableMonths.map(monthIdx => (
                    <span 
                      key={monthIdx}
                      className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm"
                    >
                      {monthNames[monthIdx]}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Best Season */}
            {trail.seasonal?.bestSeason && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Best Season</h3>
                <p className="text-gray-600">{trail.seasonal.bestSeason}</p>
              </div>
            )}

            {/* Pros */}
            {getTrailDetails()?.[id]?.pros && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-2 cursor-help" title="Field: pros">Pros</h3>
                <p className="text-gray-600">{getTrailDetails()[id].pros}</p>
              </div>
            )}

            {/* Others */}
            {getTrailDetails()?.[id]?.others && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-2 cursor-help" title="Field: others">Others</h3>
                <p className="text-gray-600">{getTrailDetails()[id].others}</p>
              </div>
            )}

            {/* Leaders */}
            {getTrailDetails()?.[id]?.leaders && getTrailDetails()[id].leaders.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Trail Leaders</h3>
                <div className="flex flex-wrap gap-2">
                  {getTrailDetails()[id].leaders.map((leader, idx) => (
                    <span 
                      key={idx}
                      className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                    >
                      {leader}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
