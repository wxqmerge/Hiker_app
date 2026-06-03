import { useParams, Link, useNavigate } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import { useTrails } from '../hooks/useTrails';
import { useTrailStore } from '../hooks/useTrailStore';
import { generateReportText as genReport, copyToClipboard, getRideCost } from '../utils/report';
import { getTrailDetailsById } from '../utils/data';
import { downloadBlob, createImportFileInput } from '../utils/io';
import { MONTH_ABBR, DIFFICULTY_COLORS } from '../utils/constants';

const SEASON_MAP = {
  'All': 'All',
  'Any': 'Any',
  'Any except Jan.': 'Any except Jan.',
  'any': 'Any',
  'Low Tide': 'Low Tide',
  'May': 'Spring',
  'Jun': 'Spring',
  'Jul': 'Summer',
  'Aug': 'Summer',
  'Sep': 'Fall',
  'Nov Jul': 'Summer',
  'June/July': 'Spring',
  'July/Aug': 'Summer',
  'July/August': 'Summer',
  'July/Sept.': 'Summer',
  'May - July': 'Spring',
  'Spring Summer': 'Spring / Summer',
  'Spring/Summer': 'Spring / Summer',
  'Spring, Summer, Fall': 'Spring / Summer / Fall',
  'Spring/Summer/Fall': 'Spring / Summer / Fall',
  'Spring/Summer/Winter': 'Spring / Winter / Summer',
  'Spring Summer Fall Winter': 'Fall / Spring / Summer / Winter',
  'Summer': 'Summer',
  'Summer / Fall': 'Summer / Fall',
  'Summer Fall': 'Summer / Fall',
  'Summer,fall': 'Summer / Fall',
  'Summer-Fall': 'Summer / Fall',
  'Summer/Fall': 'Summer / Fall',
  'Summer Fall Winter': 'Fall / Summer / Winter',
  'Winter': 'Winter',
  'Winter/Spring': 'Spring / Winter',
  'Winter/Spring/Fall': 'Fall / Spring / Winter',
  'Winter/Spring/Summer': 'Spring / Summer / Winter',
  'Fall Winter Spring': 'Fall / Spring / Winter',
  'Fall': 'Fall',
  'fall': 'Fall',
  'Fall is best!': 'Fall',
  'Fall,Spring': 'Fall / Spring',
  'Fall/Spring/Summer': 'Fall / Spring / Summer',
  'Fall/Winter/Spring': 'Fall / Spring / Winter',
};

export default function TrailDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { trails, loading } = useTrails();
  const { trailDetails, saveTrail, saveTrailDetail, exportJSON, importJSON: importTrailData } = useTrailStore();
  const [copied, setCopied] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedFields, setEditedFields] = useState({});
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);

  const trail = useMemo(() => {
    if (!id) return null;
    const exact = trails.find(t => t.id === id);
    if (exact) return exact;
    const lower = id.toLowerCase();
    return trails.find(t => t.id.toLowerCase() === lower) || null;
  }, [trails, id]);
  const currentIndex = useMemo(() => {
    if (!id) return -1;
    const exact = trails.findIndex(t => t.id === id);
    if (exact >= 0) return exact;
    const lower = id.toLowerCase();
    const idx = trails.findIndex(t => t.id.toLowerCase() === lower);
    return idx;
  }, [trails, id]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showSettingsMenu && !e.target.closest('.fixed.bottom-6')) {
        setShowSettingsMenu(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showSettingsMenu]);

  const trailDetailsResult = useMemo(() => getTrailDetailsById(trailDetails, id), [trailDetails, id]);

  const availableMonthsFromSeasonal = useMemo(() => {
    const seasonal = trail?.seasonal;
    if (!seasonal) return [];
    return Object.entries(seasonal)
      .filter(([k, v]) => typeof v === 'number' && v > 0 && MONTH_ABBR.indexOf(k) !== -1)
      .map(([k]) => MONTH_ABBR.indexOf(k) + 1);
  }, [trail]);

  const normalizeSeason = (season) => {
    if (!season) return '';
    if (SEASON_MAP[season]) return SEASON_MAP[season];
    const s = season.toLowerCase();
    for (const [key, val] of Object.entries(SEASON_MAP)) {
      if (key.toLowerCase() === s) return val;
    }
    return season;
  };

  const getEditedValue = (field) => {
    const details = trailDetailsResult?.[id];

    if (field === 'description') return editedFields.description ?? details?.fullDescription;
    if (field === 'pros') return editedFields.pros ?? details?.pros;
    if (field === 'others') return editedFields.others ?? details?.others;
    if (field === 'leaders') return editedFields.leaders ?? details?.leaders;

    if (field === 'notes') return editedFields.notes ?? trail.notes;
    if (field === 'fullName') return editedFields.fullName ?? trail.fullName ?? trail.name;
    if (field === 'distance') return editedFields.distance ?? trail.distance;
    if (field === 'distanceExtended') return editedFields.distanceExtended ?? trail.distanceExtended;
    if (field === 'elevationStart') return editedFields.elevationStart ?? trail.elevationStart;
    if (field === 'elevationMax') return editedFields.elevationMax ?? trail.elevationMax;
    if (field === 'difficulty') return editedFields.difficulty ?? trail.difficulty;
    if (field === 'parking') return editedFields.parking ?? trail.parking;
    if (field === 'range') return editedFields.range ?? trail.range;
    if (field === 'bestSeason') return normalizeSeason(editedFields.bestSeason ?? trail.seasonal?.bestSeason);
    if (field === 'availableMonths') return editedFields.availableMonths ?? availableMonthsFromSeasonal;

    return null;
  };

  const startEditMode = () => {
    setEditedFields({});
    setIsEditMode(true);
  };

  const saveEdits = async () => {
    const updatedTrail = { ...trail };
    if (editedFields.fullName !== undefined) updatedTrail.fullName = editedFields.fullName;
    if (editedFields.distance !== undefined) updatedTrail.distance = editedFields.distance;
    if (editedFields.distanceExtended !== undefined) updatedTrail.distanceExtended = editedFields.distanceExtended;
    if (editedFields.elevationStart !== undefined) updatedTrail.elevationStart = editedFields.elevationStart;
    if (editedFields.elevationMax !== undefined) updatedTrail.elevationMax = editedFields.elevationMax;
    if (editedFields.difficulty !== undefined) updatedTrail.difficulty = editedFields.difficulty;
    if (editedFields.parking !== undefined) updatedTrail.parking = editedFields.parking;
    if (editedFields.range !== undefined) updatedTrail.range = editedFields.range;
    if (editedFields.notes !== undefined) updatedTrail.notes = editedFields.notes;

    if (editedFields.bestSeason !== undefined || editedFields.availableMonths !== undefined) {
      if (!updatedTrail.seasonal) updatedTrail.seasonal = {};
      if (editedFields.bestSeason !== undefined) updatedTrail.seasonal.bestSeason = normalizeSeason(editedFields.bestSeason);
      if (editedFields.availableMonths !== undefined) updatedTrail.seasonal.availableMonths = editedFields.availableMonths;
    }

    await saveTrail(updatedTrail);

    const updatedDetail = {};
    if (editedFields.description !== undefined) updatedDetail.fullDescription = editedFields.description;
    if (editedFields.pros !== undefined) updatedDetail.pros = editedFields.pros;
    if (editedFields.others !== undefined) updatedDetail.others = editedFields.others;
    if (editedFields.leaders !== undefined) updatedDetail.leaders = editedFields.leaders;

    if (Object.keys(updatedDetail).length > 0) {
      await saveTrailDetail(trail.id, updatedDetail);
    }

    setIsEditMode(false);
  };

  const cancelEdits = () => {
    setEditedFields({});
    setIsEditMode(false);
  };

  const exportEdits = async () => {
    const data = await exportJSON();
    downloadBlob(JSON.stringify(data, null, 2), 'trail-data.json');
  };

  const importEdits = () => {
    createImportFileInput(
      async (imported) => {
        await importTrailData(imported);
        alert('Data imported successfully!');
        window.location.reload();
      },
      (msg) => alert(msg)
    );
  };

  const exportTrailEdits = () => {
    let text = `Trail: ${trail.name}\n\n`;

    const desc = getEditedValue('description');
    if (desc) text += `Description: ${desc}\n\n`;

    const notes = getEditedValue('notes');
    if (notes) text += `Notes: ${notes}\n\n`;

    const pros = getEditedValue('pros');
    if (pros) text += `Pros: ${pros}\n\n`;

    const others = getEditedValue('others');
    if (others) text += `Others: ${others}\n\n`;

    const leaders = getEditedValue('leaders');
    if (leaders) {
      const leaderArr = Array.isArray(leaders) ? leaders : [leaders];
      text += `Leaders: ${leaderArr.join(', ')}\n`;
    }

    navigator.clipboard.writeText(text);
    alert('Trail edits copied to clipboard!');
  };

  const updateField = (field, value) => {
    setEditedFields(prev => ({ ...prev, [field]: value }));
  };

  const copyReport = async () => {
    await copyToClipboard(genReport(trail, trailDetailsResult?.[id]), (status) => {
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
          <Link to="/" className="text-green-600 hover:underline">Back to Browse</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="container mx-auto px-4 py-3 max-w-3xl">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 mb-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4">
              <Link to="/" className="text-green-700 hover:text-green-900 font-medium flex items-center gap-1">
                ← Browse
              </Link>
              <span className="text-gray-300">|</span>
              <div className="text-sm text-gray-600">
                Trail {currentIndex + 1} of {trails.length}
              </div>
            </div>

            <div className="text-center flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{trail.fullName || trail.name}</p>
            </div>

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
          <div className="bg-green-800 text-white p-6">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-bold">{getEditedValue('fullName') || trail.fullName || trail.name}</h1>
              {hasEdits && (
                <span className="px-2 py-0.5 bg-yellow-400 text-yellow-900 text-xs font-bold rounded">
                  EDITED
                </span>
              )}
            </div>
            <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${DIFFICULTY_COLORS[getEditedValue('difficulty')] || 'bg-gray-100 text-gray-800'}`}>
              {getEditedValue('difficulty')}
            </span>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-4 gap-4 mb-6">
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

              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <svg className="w-6 h-6 mx-auto text-green-600 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
                <p className="text-xl font-bold text-gray-800">
                  {getEditedValue('elevationStart') != null ? getEditedValue('elevationStart').toLocaleString() : 'N/A'} ft - {getEditedValue('elevationMax') != null ? getEditedValue('elevationMax').toLocaleString() : 'N/A'} ft
                </p>
                <p className="text-sm text-gray-500">elevation gain</p>
              </div>

              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <svg className="w-6 h-6 mx-auto text-green-600 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <p className="text-sm font-bold text-gray-800">{getEditedValue('parking') || 'N/A'}</p>
                <p className="text-sm text-gray-500">parking</p>
              </div>

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

            {getEditedValue('description') && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Description</h3>
                <p className="text-gray-600 whitespace-pre-line">{getEditedValue('description')}</p>
              </div>
            )}

            {getEditedValue('notes') && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Notes</h3>
                <p className="text-gray-600">{getEditedValue('notes')}</p>
              </div>
            )}

            {getEditedValue('availableMonths').length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Available Months</h3>
                <div className="flex flex-wrap gap-2">
                  {getEditedValue('availableMonths').map(monthIdx => (
                    <span
                      key={monthIdx}
                      className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm"
                    >
                      {MONTH_ABBR[monthIdx - 1]}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {getEditedValue('bestSeason') && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Best Season</h3>
                <p className="text-gray-600">{getEditedValue('bestSeason')}</p>
              </div>
            )}

            {getEditedValue('pros') && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-2 cursor-help" title="Field: pros">Pros</h3>
                <p className="text-gray-600">{getEditedValue('pros')}</p>
              </div>
            )}

            {getEditedValue('others') && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-2 cursor-help" title="Field: others">Others</h3>
                <p className="text-gray-600">{getEditedValue('others')}</p>
              </div>
            )}

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

        <div className="fixed bottom-6 right-6 flex gap-3">
          <div className="relative">
            <button
              onClick={() => setShowSettingsMenu(!showSettingsMenu)}
              className="p-4 bg-gray-700 hover:bg-gray-800 text-white rounded-full shadow-lg transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-gray-400"
              title="Export/Import data"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </button>

            {showSettingsMenu && (
              <div className="absolute bottom-full right-0 mb-3 bg-white rounded-lg shadow-xl border border-gray-200 p-2 min-w-[180px] z-50">
                <button
                  onClick={() => { exportEdits(); setShowSettingsMenu(false); }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export All Data
                </button>
                <button onClick={() => { importEdits(); setShowSettingsMenu(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Import Data
                </button>
                <button
                  onClick={() => { exportTrailEdits(); setShowSettingsMenu(false); }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                  Copy This Trail's Info
                </button>
              </div>
            )}
          </div>

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

      {isEditMode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Edit {trail.name}</h2>

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
                    <select
                      value={getEditedValue('parking') || ''}
                      onChange={(e) => updateField('parking', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                    >
                      <option value="">Select parking</option>
                      <option value="Nat'l Park/Golden">Nat'l Park/Golden</option>
                      <option value="NW Forest/Golden">NW Forest/Golden</option>
                      <option value="Discover">Discover</option>
                      <option value="Am Beau/Golden">Am Beau/Golden</option>
                      <option value="N/A">N/A</option>
                    </select>
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Distance Max (miles)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={getEditedValue('distanceExtended') != null ? getEditedValue('distanceExtended') : ''}
                      onChange={(e) => updateField('distanceExtended', e.target.value ? parseFloat(e.target.value) : '')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Elevation Gain min (ft)</label>
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

              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3 border-b pb-2">Seasonal Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Best Season</label>
                    <select
                      value={getEditedValue('bestSeason') || ''}
                      onChange={(e) => updateField('bestSeason', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                    >
                      <option value="">Select season</option>
                      <option value="All">All</option>
                      <option value="Any">Any</option>
                      <option value="Any except Jan.">Any except Jan.</option>
                      <option value="Low Tide">Low Tide</option>
                      <option value="Spring">Spring</option>
                      <option value="Summer">Summer</option>
                      <option value="Fall">Fall</option>
                      <option value="Winter">Winter</option>
                      <option value="Spring / Summer">Spring / Summer</option>
                      <option value="Summer / Fall">Summer / Fall</option>
                      <option value="Fall / Spring">Fall / Spring</option>
                      <option value="Spring / Winter">Spring / Winter</option>
                      <option value="Fall / Spring / Summer">Fall / Spring / Summer</option>
                      <option value="Fall / Spring / Winter">Fall / Spring / Winter</option>
                      <option value="Spring / Summer / Fall">Spring / Summer / Fall</option>
                      <option value="Spring / Summer / Winter">Spring / Summer / Winter</option>
                      <option value="Fall / Summer / Winter">Fall / Summer / Winter</option>
                      <option value="Fall / Spring / Summer / Winter">Fall / Spring / Summer / Winter</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Available Months</label>
                  <div className="flex flex-wrap gap-2">
                    {MONTH_ABBR.map((month, idx) => (
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
