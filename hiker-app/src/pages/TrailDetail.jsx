import { useParams, Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useTrails } from '../hooks/useTrails';
import { generateReportText as genReport, copyToClipboard, getRideCost } from '../utils/report';
import { getTrailDetailsById } from '../utils/data';

const EDIT_STORAGE_KEY = 'hiker-trail-edits';

export default function TrailDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { trails, loading } = useTrails();
  const [trailDetails, setTrailDetails] = useState(null);
  const [copied, setCopied] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedFields, setEditedFields] = useState({});
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);

  const trail = trails.find(t => t.id === id);
  const currentIndex = trails.findIndex(t => t.id === id);

  useEffect(() => {
    // Check for embedded data (single-file standalone mode)
    if (window.__EMBEDDED_DATA__?.trail_details) {
      setTrailDetails(window.__EMBEDDED_DATA__.trail_details);
    }
    // Only fetch if NOT running from file:// protocol
    else if (window.location.protocol !== 'file:') {
      fetch('/data/trail_details.json')
        .then(res => res.json())
        .then(data => setTrailDetails(data))
        .catch(err => console.error('Error loading trail details:', err));
    }
  }, []);

  useEffect(() => {
    if (trail) {
      const savedEdits = JSON.parse(localStorage.getItem(EDIT_STORAGE_KEY) || '{}');
      if (savedEdits[trail.id]) {
        setEditedFields(savedEdits[trail.id]);
      }
    }
  }, [trail]);

  // Close settings menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showSettingsMenu && !e.target.closest('.fixed.bottom-6')) {
        setShowSettingsMenu(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showSettingsMenu]);

  // Get trail details with fallback for ID mismatch
  const getTrailDetails = () => getTrailDetailsById(trailDetails, id);

  // Get edited value or fallback to original
  const getEditedValue = (field) => {
    const details = getTrailDetails()?.[id];
    
    // trail_details.json fields
    if (field === 'description') return editedFields.description ?? details?.fullDescription;
    if (field === 'pros') return editedFields.pros ?? details?.pros;
    if (field === 'others') return editedFields.others ?? details?.others;
    if (field === 'leaders') return editedFields.leaders ?? details?.leaders;
    
    // trails.json fields
    if (field === 'notes') return editedFields.notes ?? trail.notes;
    if (field === 'fullName') return editedFields.fullName ?? trail.fullName ?? trail.name;
    if (field === 'distance') return editedFields.distance ?? trail.distance;
    if (field === 'distanceExtended') return editedFields.distanceExtended ?? trail.distanceExtended;
    if (field === 'elevationStart') return editedFields.elevationStart ?? trail.elevationStart;
    if (field === 'elevationMax') return editedFields.elevationMax ?? trail.elevationMax;
    if (field === 'difficulty') return editedFields.difficulty ?? trail.difficulty;
    if (field === 'parking') return editedFields.parking ?? trail.parking;
    if (field === 'range') return editedFields.range ?? trail.range;
    if (field === 'bestSeason') return editedFields.bestSeason ?? trail.seasonal?.bestSeason;
    if (field === 'parkingInfo') return editedFields.parkingInfo ?? trail.seasonal?.parkingInfo;
    if (field === 'availableMonths') return editedFields.availableMonths ?? (trail.seasonal?.availableMonths || []);
    
    return null;
  };

  // Start edit mode
  const startEditMode = () => {
    setIsEditMode(true);
  };

  // Save edits to localStorage
  const saveEdits = () => {
    const allEdits = JSON.parse(localStorage.getItem(EDIT_STORAGE_KEY) || '{}');
    allEdits[trail.id] = { ...editedFields };
    localStorage.setItem(EDIT_STORAGE_KEY, JSON.stringify(allEdits));
    setIsEditMode(false);
  };

  // Cancel edits
  const cancelEdits = () => {
    setEditedFields({});
    setIsEditMode(false);
  };

  // Export all trail edits to JSON file
  const exportEdits = () => {
    const allEdits = JSON.parse(localStorage.getItem(EDIT_STORAGE_KEY) || '{}');
    const dataStr = JSON.stringify(allEdits, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'trail-edits.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import trail edits from JSON file
  const importEdits = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        localStorage.setItem(EDIT_STORAGE_KEY, JSON.stringify(imported));
        alert('Edits imported successfully!');
        window.location.reload();
      } catch (err) {
        alert('Error importing file: Invalid JSON format');
      }
    };
    reader.readAsText(file);
  };

  // Export current trail's edits as report text with source values
  const exportTrailEdits = () => {
    const allEdits = JSON.parse(localStorage.getItem(EDIT_STORAGE_KEY) || '{}');
    if (allEdits[trail.id]) {
      const edits = allEdits[trail.id];
      let text = `Trail: ${trail.name}\n\n`;
      if (edits.description) text += `Description: ${edits.description}\n\n`;
      if (edits.notes) text += `Notes: ${edits.notes}\n\n`;
      if (edits.pros) text += `Pros: ${edits.pros}\n\n`;
      if (edits.others) text += `Others: ${edits.others}\n\n`;
      if (edits.leaders) text += `Leaders: ${edits.leaders.join(', ')}\n`;

      navigator.clipboard.writeText(text);
      alert('Trail edits copied to clipboard!');
    }
  };

  // Update a field
  const updateField = (field, value) => {
    setEditedFields(prev => ({ ...prev, [field]: value }));
  };

  const copyReport = async () => {
    await copyToClipboard(genReport(trail, getTrailDetails()), (status) => {
      setCopied(status);
      if (status) setTimeout(() => setCopied(false), 2000);
    });
  };

  const goToPrevious = () => {
    if (currentIndex > 0) {
      navigate(`/trail/${trails[currentIndex - 1].id}`);
    }
  };

  const goToNext = () => {
    if (currentIndex < trails.length - 1) {
      navigate(`/trail/${trails[currentIndex + 1].id}`);
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

  const hasEdits = Object.keys(editedFields).length > 0;

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
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-bold">{getEditedValue('fullName') || trail.fullName || trail.name}</h1>
              {hasEdits && (
                <span className="px-2 py-0.5 bg-yellow-400 text-yellow-900 text-xs font-bold rounded">
                  EDITED
                </span>
              )}
            </div>
            <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${difficultyColors[getEditedValue('difficulty')] || 'bg-gray-100 text-gray-800'}`}>
              {getEditedValue('difficulty')}
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
                  {getEditedValue('distance') != null ? getEditedValue('distance').toFixed(1) : 'N/A'}
                  {getEditedValue('distanceExtended') != null && ` / ${getEditedValue('distanceExtended').toFixed(1)}`}
                </p>
                <p className="text-sm text-gray-500">miles</p>
              </div>
              
              {/* Elevation Gain */}
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <svg className="w-6 h-6 mx-auto text-green-600 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
                <p className="text-xl font-bold text-gray-800">
                  {getEditedValue('elevationStart') != null ? getEditedValue('elevationStart').toLocaleString() : 'N/A'} ft - {getEditedValue('elevationMax') != null ? getEditedValue('elevationMax').toLocaleString() : 'N/A'} ft
                </p>
                <p className="text-sm text-gray-500">elevation gain</p>
              </div>

              {/* Parking */}
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <svg className="w-6 h-6 mx-auto text-green-600 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <p className="text-sm font-bold text-gray-800">{getEditedValue('parking') || 'N/A'}</p>
                <p className="text-sm text-gray-500">parking</p>
              </div>

              {/* Ride - Combined Range and Cost */}
              {(getEditedValue('range') || rideCost) && (
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <svg className="w-6 h-6 mx-auto text-green-600 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                  <p className="text-xl font-bold text-gray-800">
                    {getEditedValue('range') ? getRideCost(parseInt(getEditedValue('range'))) || `Range: ${getEditedValue('range')}` : rideCost || 'N/A'}
                  </p>
                  <p className="text-sm text-gray-500">ride</p>
                </div>
              )}
            </div>

            {/* Full Description */}
            {getEditedValue('description') && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Description</h3>
                <p className="text-gray-600 whitespace-pre-line">{getEditedValue('description')}</p>
              </div>
            )}

            {/* Notes */}
            {getEditedValue('notes') && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Notes</h3>
                <p className="text-gray-600">{getEditedValue('notes')}</p>
              </div>
            )}

            {/* Seasonal Availability */}
            {getEditedValue('availableMonths').length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Available Months</h3>
                <div className="flex flex-wrap gap-2">
                  {getEditedValue('availableMonths').map(monthIdx => (
                    <span 
                      key={monthIdx}
                      className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm"
                    >
                      {monthNames[monthIdx - 1]}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Best Season */}
            {getEditedValue('bestSeason') && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Best Season</h3>
                <p className="text-gray-600">{getEditedValue('bestSeason')}</p>
              </div>
            )}

            {/* Pros */}
            {getEditedValue('pros') && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-2 cursor-help" title="Field: pros">Pros</h3>
                <p className="text-gray-600">{getEditedValue('pros')}</p>
              </div>
            )}

            {/* Others */}
            {getEditedValue('others') && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-2 cursor-help" title="Field: others">Others</h3>
                <p className="text-gray-600">{getEditedValue('others')}</p>
              </div>
            )}

            {/* Leaders */}
            {getEditedValue('leaders') && getEditedValue('leaders').length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Trail Leaders</h3>
                <div className="flex flex-wrap gap-2">
                  {getEditedValue('leaders').map((leader, idx) => (
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

        {/* Settings Menu - Lower Right Corner */}
        <div className="fixed bottom-6 right-6 flex gap-3">
          {/* Settings Icon */}
          <div className="relative">
            <button
              onClick={() => setShowSettingsMenu(!showSettingsMenu)}
              className="p-4 bg-gray-700 hover:bg-gray-800 text-white rounded-full shadow-lg transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-gray-400"
              title="Export/Import edits"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {showSettingsMenu && (
              <div className="absolute bottom-full right-0 mb-3 bg-white rounded-lg shadow-xl border border-gray-200 p-2 min-w-[180px] z-50">
                <button
                  onClick={() => { exportEdits(); setShowSettingsMenu(false); }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export All Edits
                </button>
                <label className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded flex items-center gap-2 cursor-pointer">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Import Edits
                  <input
                    type="file"
                    accept=".json"
                    onChange={importEdits}
                    className="hidden"
                  />
                </label>
                {hasEdits && (
                  <button
                    onClick={() => { exportTrailEdits(); setShowSettingsMenu(false); }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    Copy This Trail's Edits
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Edit Icon */}
          <button
            onClick={startEditMode}
            className="p-4 bg-green-600 hover:bg-green-700 text-white rounded-full shadow-lg transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-green-400"
            title="Edit trail details"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        </div>
      </main>

      {/* Edit Mode Overlay */}
      {isEditMode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Edit {trail.name}</h2>

              {/* Basic Information */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3 border-b pb-2">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                    <input
                      type="text"
                      value={getEditedValue('fullName') || ''}
                      onChange={(e) => updateField('fullName', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
                    <select
                      value={getEditedValue('difficulty') || ''}
                      onChange={(e) => updateField('difficulty', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                    >
                      <option value="">Select difficulty</option>
                      <option value="Easy">Easy</option>
                      <option value="Easy to Mod">Easy to Mod</option>
                      <option value="Moderate">Moderate</option>
                      <option value="Mod to Diff">Mod to Diff</option>
                      <option value="Difficult">Difficult</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Parking</label>
                    <input
                      type="text"
                      value={getEditedValue('parking') || ''}
                      onChange={(e) => updateField('parking', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Range</label>
                    <input
                      type="number"
                      value={getEditedValue('range') || ''}
                      onChange={(e) => updateField('range', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                </div>
              </div>

              {/* Distance & Elevation */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3 border-b pb-2">Distance & Elevation</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Distance (miles)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={getEditedValue('distance') != null ? getEditedValue('distance') : ''}
                      onChange={(e) => updateField('distance', e.target.value ? parseFloat(e.target.value) : '')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Extended Distance (miles)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={getEditedValue('distanceExtended') != null ? getEditedValue('distanceExtended') : ''}
                      onChange={(e) => updateField('distanceExtended', e.target.value ? parseFloat(e.target.value) : '')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Elevation Start (ft)</label>
                    <input
                      type="number"
                      value={getEditedValue('elevationStart') != null ? getEditedValue('elevationStart') : ''}
                      onChange={(e) => updateField('elevationStart', e.target.value ? parseInt(e.target.value) : '')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Elevation Max (ft)</label>
                    <input
                      type="number"
                      value={getEditedValue('elevationMax') != null ? getEditedValue('elevationMax') : ''}
                      onChange={(e) => updateField('elevationMax', e.target.value ? parseInt(e.target.value) : '')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                </div>
              </div>

              {/* Seasonal Information */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3 border-b pb-2">Seasonal Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Best Season</label>
                    <input
                      type="text"
                      value={getEditedValue('bestSeason') || ''}
                      onChange={(e) => updateField('bestSeason', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Parking Info</label>
                    <input
                      type="text"
                      value={getEditedValue('parkingInfo') || ''}
                      onChange={(e) => updateField('parkingInfo', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Available Months</label>
                  <div className="flex flex-wrap gap-2">
                    {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month, idx) => (
                      <label key={idx} className="flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-full cursor-pointer hover:bg-gray-200">
                        <input
                          type="checkbox"
                          checked={getEditedValue('availableMonths').includes(idx + 1)}
                          onChange={(e) => {
                            const months = [...getEditedValue('availableMonths')];
                            if (e.target.checked) {
                              months.push(idx + 1);
                            } else {
                              const i = months.indexOf(idx + 1);
                              if (i > -1) months.splice(i, 1);
                            }
                            updateField('availableMonths', months.sort((a, b) => a - b));
                          }}
                          className="rounded"
                        />
                        <span className="text-sm">{month}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Trail Content */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3 border-b pb-2">Trail Content</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      value={getEditedValue('description') || ''}
                      onChange={(e) => updateField('description', e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <textarea
                      value={getEditedValue('notes') || ''}
                      onChange={(e) => updateField('notes', e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pros</label>
                    <textarea
                      value={getEditedValue('pros') || ''}
                      onChange={(e) => updateField('pros', e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Others</label>
                    <textarea
                      value={getEditedValue('others') || ''}
                      onChange={(e) => updateField('others', e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Trail Leaders (comma-separated)</label>
                    <input
                      type="text"
                      value={getEditedValue('leaders')?.join(', ') || ''}
                      onChange={(e) => updateField('leaders', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                      placeholder="Leader 1, Leader 2, Leader 3"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  onClick={cancelEdits}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEdits}
                  className="px-4 py-2 text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
