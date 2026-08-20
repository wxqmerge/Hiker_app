import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useState, useMemo } from 'react';
import GPXHelp from '../components/GPXHelp';
import MonthGrid from '../components/MonthGrid';
import { useTrails } from '../hooks/useTrails';
import { useTrailStore } from '../hooks/useTrailStore';
import { useTooltips } from '../hooks/useTooltips';
import { generateTrailHtml, getRideCost } from '../utils/report';
import { useToast } from '../hooks/useToast';
import { getTrailDetailsById, findTrailById, findTrailIndexById, getAvailableMonthsFromSeasonal, getTrailName } from '../utils/data';
import { getSeasonalInfo, computeMonthlyScores } from '../utils/score.js';
import { downloadBlob, exportTrailTsv, createFileInput, sanitizeFilename, openHtmlInNewTab } from '../utils/io';
import { uploadGpxFile } from '../api/client';
import { useGpxActions } from '../hooks/useGpxActions';
import { MONTH_ABBR, DIFFICULTY_COLORS } from '../utils/constants';
import { getGoogleAllTrailsSearchUrl, getNoaaTideUrl } from '../utils/url.js';
import { hasStoredApiKey } from '../utils/apiKey';
import LoadingSpinner from '../components/LoadingSpinner';
import MonthlyScoreGrid, { ScoreBreakdownRow } from '../components/MonthlyScoreGrid.jsx';

const SEASON_MAP = {
  'All': 'All',
  'Any': 'Any',
  'Any except Jan.': 'Any except Jan.',
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
  'Fall is best!': 'Fall',
  'Fall,Spring': 'Fall / Spring',
  'Fall/Spring/Summer': 'Fall / Spring / Summer',
  'Fall/Winter/Spring': 'Fall / Spring / Winter',
};

const SEASON_MAP_LOWER = Object.fromEntries(
  Object.entries(SEASON_MAP).map(([k, v]) => [k.toLowerCase(), v])
);

export default function TrailDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const hikeDateParam = searchParams.get('date');
  const hikeDate = useMemo(() => {
    if (!hikeDateParam) return null;
    const m = hikeDateParam.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    const d = new Date(hikeDateParam);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [hikeDateParam]);
  const { trails, loading } = useTrails();
  const { trailDetails, saveTrail, saveTrailDetail, deleteTrail } = useTrailStore();
  const { title: tt } = useTooltips();
  const showToast = useToast();
  const [isEditMode, setIsEditMode] = useState(() => searchParams.get('edit') === 'true');
  const [editedFields, setEditedFields] = useState({});
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [duplicateId, setDuplicateId] = useState('');

  const trail = useMemo(() => findTrailById(trails, id), [trails, id]);
  const currentIndex = useMemo(() => findTrailIndexById(trails, id), [trails, id]);

  const trailDetailsResult = useMemo(() => getTrailDetailsById(trailDetails, id), [trailDetails, id]);
  const { handleGpxShare } = useGpxActions(trail);

  const availableMonthsFromSeasonal = useMemo(() => getAvailableMonthsFromSeasonal(trail?.seasonal), [trail]);

  const normalizeSeason = (season) => {
    if (!season) return '';
    const s = season.toLowerCase();
    const match = SEASON_MAP_LOWER[s];
    return match || season;
  };

  const trailSeasonal = trail?.seasonal || {};
  const { hasQuarterData } = getSeasonalInfo(trailSeasonal);

  const getEditedValue = (field) => {
    const details = trailDetailsResult?.[id];
    const pop = details?.popularity || {};

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
    if (field === 'altNames') return editedFields.altNames ?? trail.altNames;
    if (field === 'monthlyPopularity') return editedFields.monthlyPopularity ?? (pop.monthly || []);
    if (field === 'monthlyScore') {
      if (editedFields.monthlyScore !== undefined) return editedFields.monthlyScore;
      if (pop.monthlyScore && pop.monthlyScore.length > 0) return pop.monthlyScore;
      const monthly = pop.monthly || [];
      const availableMonths = getEditedValue('availableMonths') || [];
      return computeMonthlyScores(monthly, availableMonths, hasQuarterData);
    }
    if (field === 'gpxData') return (editedFields.gpxData ?? trail.gpxData) || '';
    if (field === 'tideStationId') return editedFields.tideStationId ?? trail.tideStationId;

    return null;
  };

  const startEditMode = () => {
    setEditedFields({});
    setIsEditMode(true);
  };

  const startDuplicate = () => {
    const baseId = trail.id.replace(/-\d+$/, '');
    let newId = `${baseId}-2`;
    let counter = 2;
    while (trails.find(t => t.id === newId)) {
      counter++;
      newId = `${baseId}-${counter}`;
    }
    setDuplicateId(newId);
    setEditedFields({
      id: newId,
      fullName: getTrailName(trail),
      name: trail.name,
      distance: trail.distance,
      distanceExtended: trail.distanceExtended,
      elevationStart: trail.elevationStart,
      elevationMax: trail.elevationMax,
      difficulty: trail.difficulty,
      parking: trail.parking,
      range: trail.range,
      notes: trail.notes || '',
      seasonal: trail.seasonal ? { ...trail.seasonal } : {},
      altNames: trail.altNames ? [...trail.altNames] : [],
      webLink: trail.webLink || '',
      gpxFile: '',
      hasGpx: false,
      bestSeason: trail.seasonal?.bestSeason || '',
      availableMonths: trail.seasonal?.availableMonths || [],
      description: trailDetailsResult?.[id]?.fullDescription || '',
      pros: trailDetailsResult?.[id]?.pros || '',
      others: trailDetailsResult?.[id]?.others || '',
      leaders: trailDetailsResult?.[id]?.leaders ? [...trailDetailsResult[id].leaders] : [],
      monthlyPopularity: trailDetailsResult?.[id]?.popularity?.monthly ? [...trailDetailsResult[id].popularity.monthly] : [],
      monthlyScore: trailDetailsResult?.[id]?.popularity?.monthlyScore ? [...trailDetailsResult[id].popularity.monthlyScore] : [],
    });
    setIsDuplicate(true);
    setIsEditMode(true);
  };

  const saveEdits = async () => {
    if (isDuplicate) {
      const newName = editedFields.fullName || '';
      const originalName = getTrailName(trail);
      const newId = editedFields.id || duplicateId;
      if (!newName || newName === originalName) {
        showToast('Please change the trail name before saving.', 'error');
        return;
      }
      if (trails.find(t => t.id === newId && t.id !== trail.id)) {
        showToast(`Trail ID "${newId}" already exists.`, 'error');
        return;
      }
      if (newId.length > 24) {
        showToast('Trail ID is too long (max 24 characters).', 'error');
        return;
      }
      const newTrail = {
        id: newId,
        name: newName.split('/')[0].trim(),
        fullName: newName,
        distance: editedFields.distance ?? trail.distance,
        distanceExtended: editedFields.distanceExtended ?? trail.distanceExtended,
        elevationStart: editedFields.elevationStart ?? trail.elevationStart,
        elevationMax: editedFields.elevationMax ?? trail.elevationMax,
        difficulty: editedFields.difficulty || 'Unknown',
        parking: editedFields.parking || '',
        range: editedFields.range || '',
        notes: editedFields.notes || '',
        seasonal: {
          bestSeason: normalizeSeason(editedFields.bestSeason || ''),
          availableMonths: editedFields.availableMonths || [],
        },
        altNames: editedFields.altNames || [],
        webLink: editedFields.webLink || '',
        tideStationId: String(editedFields.tideStationId || '').trim(),
        gpxFile: editedFields.gpxFile || '',
        hasGpx: !!editedFields.gpxFile,
        difficultyOrder: (trail.difficultyOrder ?? 99),
      };
      await saveTrail(newTrail);

      const newDetail = {};
      if (editedFields.description) newDetail.fullDescription = editedFields.description;
      if (editedFields.pros) newDetail.pros = editedFields.pros;
      if (editedFields.others) newDetail.others = editedFields.others;
      if (editedFields.leaders) newDetail.leaders = editedFields.leaders;

      const newMonthly = editedFields.monthlyPopularity || [];
      if (newMonthly.length > 0) {
        const scores = getEditedValue('monthlyScore') || [];
        newDetail.popularity = { monthly: newMonthly, monthlyScore: scores };
      }
      if (Object.keys(newDetail).length > 0) {
        await saveTrailDetail(newId, newDetail);
      }

      showToast('Trail duplicated successfully!');
      setEditedFields({});
      setIsDuplicate(false);
      setIsEditMode(false);
      navigate(`/trail/${newId}`);
      return;
    }

    const updatedTrail = { ...trail };
    if (editedFields.fullName !== undefined) {
      updatedTrail.fullName = editedFields.fullName;
      updatedTrail.name = editedFields.fullName.split('/')[0].trim();
    }
    if (editedFields.distance !== undefined) updatedTrail.distance = editedFields.distance;
    if (editedFields.distanceExtended !== undefined) updatedTrail.distanceExtended = editedFields.distanceExtended;
    if (editedFields.elevationStart !== undefined) updatedTrail.elevationStart = editedFields.elevationStart;
    if (editedFields.elevationMax !== undefined) updatedTrail.elevationMax = editedFields.elevationMax;
    if (editedFields.difficulty !== undefined) updatedTrail.difficulty = editedFields.difficulty;
    if (editedFields.parking !== undefined) updatedTrail.parking = editedFields.parking;
    if (editedFields.range !== undefined) updatedTrail.range = editedFields.range;
    if (editedFields.notes !== undefined) updatedTrail.notes = editedFields.notes;
   if (editedFields.altNames !== undefined) updatedTrail.altNames = editedFields.altNames;
    if (editedFields.webLink !== undefined) updatedTrail.webLink = editedFields.webLink;
    if (editedFields.tideStationId !== undefined) updatedTrail.tideStationId = String(editedFields.tideStationId).trim();
    if (editedFields.gpxData !== undefined) {
      if (editedFields.gpxData === '') delete updatedTrail.gpxData;
      else updatedTrail.gpxData = editedFields.gpxData;
    }
    if (editedFields.gpxFile !== undefined) updatedTrail.gpxFile = editedFields.gpxFile;
    if (editedFields.hasGpx !== undefined) updatedTrail.hasGpx = editedFields.hasGpx;
    if (editedFields.trailHeadLat !== undefined) updatedTrail.trailHeadLat = editedFields.trailHeadLat;
    if (editedFields.trailHeadLon !== undefined) updatedTrail.trailHeadLon = editedFields.trailHeadLon;

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

    const newMonthly = editedFields.monthlyPopularity !== undefined ? editedFields.monthlyPopularity : (trailDetailsResult?.[id]?.popularity?.monthly || []);
    if (newMonthly.length > 0) {
      const scores = getEditedValue('monthlyScore') || [];
      updatedDetail.popularity = { monthly: newMonthly, monthlyScore: scores };
    }

    if (Object.keys(updatedDetail).length > 0) {
      await saveTrailDetail(trail.id, updatedDetail);
    }

    setEditedFields({});
    setIsEditMode(false);
    searchParams.delete('edit');
    navigate(`/trail/${id}${searchParams.toString() ? '?' + searchParams.toString() : ''}`, { replace: true });
  };

  const cancelEdits = () => {
    setEditedFields({});
    setIsEditMode(false);
    setIsDuplicate(false);
    setDuplicateId('');
    searchParams.delete('edit');
    navigate(`/trail/${id}${searchParams.toString() ? '?' + searchParams.toString() : ''}`, { replace: true });
  };

  const handleDelete = async () => {
    const name = getTrailName(trail);
    if (!window.confirm(`Delete trail "${name}"? This cannot be undone.`)) return;
    if (!hasStoredApiKey()) {
      showToast('API key required to delete trails.', 'error');
      return;
    }
    const target = currentIndex < trails.length - 1
      ? trails[currentIndex + 1].id
      : currentIndex > 0
        ? trails[currentIndex - 1].id
        : null;
    try {
      await deleteTrail(id);
      showToast(`Deleted "${name}".`, 'success');
      navigate(target ? `/trail/${target}` : '/');
    } catch (err) {
      showToast('Delete failed: ' + err.message, 'error');
    }
  };

  const exportTrailAsTsv = () => {
    const tsvTrail = {
      id: trail.id,
      name: getEditedValue('fullName') || getTrailName(trail),
      fullName: getEditedValue('fullName') || getTrailName(trail),
      distance: getEditedValue('distance'),
      distanceExtended: getEditedValue('distanceExtended'),
      elevationStart: getEditedValue('elevationStart'),
      elevationMax: getEditedValue('elevationMax'),
      difficulty: getEditedValue('difficulty') || 'Unknown',
      parking: getEditedValue('parking') || '',
      range: getEditedValue('range') || '',
      notes: '',
      seasonal: {
        availableMonths: getEditedValue('availableMonths') || [],
        bestSeason: getEditedValue('bestSeason') || '',
      },
      altNames: getEditedValue('altNames'),
    };
    const tsvDetail = {
      fullDescription: getEditedValue('description') || '',
      pros: getEditedValue('pros'),
      others: getEditedValue('others'),
      leaders: getEditedValue('leaders') || [],
    };
    const tsv = exportTrailTsv(tsvTrail, tsvDetail);
    const safeName = sanitizeFilename(getTrailName(trail), 'trail');
    downloadBlob(tsv, `${safeName}.tsv`, 'text/tab-separated-values');
  };

  const updateField = (field, value) => {
    setEditedFields(prev => ({ ...prev, [field]: value }));
  };

  const copyReport = () => {
    const html = generateTrailHtml(trail, trailDetailsResult, hikeDate);
    openHtmlInNewTab(html);
  };

  const exportTrailAsHtml = () => {
    const htmlTrail = {
      id: trail.id,
      name: getEditedValue('fullName') || getTrailName(trail),
      fullName: getEditedValue('fullName') || getTrailName(trail),
      distance: getEditedValue('distance'),
      distanceExtended: getEditedValue('distanceExtended'),
      elevationStart: getEditedValue('elevationStart'),
      elevationMax: getEditedValue('elevationMax'),
      difficulty: getEditedValue('difficulty') || 'Unknown',
      parking: getEditedValue('parking') || '',
      range: getEditedValue('range') || '',
      notes: getEditedValue('notes') || '',
      seasonal: trail.seasonal || {},
      altNames: getEditedValue('altNames'),
      webLink: trail.webLink || '',
      hasGpx: !!trail.gpxFile,
    };
    const htmlDetail = {};
    const desc = getEditedValue('description');
    if (desc) htmlDetail.fullDescription = desc;
    const html = generateTrailHtml(htmlTrail, htmlDetail, hikeDate);
    openHtmlInNewTab(html);
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

  const rideCost = trail?.range ? getRideCost(parseInt(trail.range, 10)) : null;

  if (loading) {
    return <LoadingSpinner />;
  }

  const hasEdits = Object.keys(editedFields).length > 0;

  if (!trail) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <h2 className="text-xl text-gray-800 mb-2">Trail not found</h2>
          <Link to="/" className="text-green-600 hover:underline">Back to Browse</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="sticky top-14 z-30 bg-gray-50 border-b border-gray-200 py-2 mb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-green-700 hover:text-green-900 font-medium text-sm flex items-center gap-1">
              ← Browse
            </Link>
            <span className="text-gray-300">|</span>
            <div className="text-sm text-gray-600">
              Trail {currentIndex + 1} of {trails.length}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={goToPrevious}
              disabled={currentIndex === 0}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                currentIndex === 0
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
              title={tt('Go to previous trail')}
              aria-label="Go to previous trail"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Prev
            </button>

            <button
              onClick={goToNext}
              disabled={currentIndex === trails.length - 1}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                currentIndex === trails.length - 1
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
              title={tt('Go to next trail')}
              aria-label="Go to next trail"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <span className="text-gray-300">|</span>

            <button
              onClick={exportTrailAsTsv}
              className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded transition-colors text-blue-700 hover:text-blue-900"
              title={tt('Export this hike as TSV matching Excel format')}
              aria-label="Export this hike as TSV"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              TSV
            </button>

            <button
              onClick={exportTrailAsHtml}
              className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded transition-colors text-purple-700 hover:text-purple-900"
              title={tt('Export this trail as HTML')}
              aria-label="Export this trail as HTML"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 3h10l4 8v9a2 2 0 01-2 2H5a2 2 0 01-2-2V5l4-2z" />
              </svg>
              HTML
            </button>

            <button
              onClick={copyReport}
              className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded transition-colors text-green-700 hover:text-green-900"
              title={tt('Open trail report in new tab')}
              aria-label="Open trail report in new tab"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Report
            </button>

            <button
              onClick={startEditMode}
              className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded transition-colors text-green-700 hover:text-green-900"
              title={tt('Edit trail details')}
              aria-label="Edit trail details"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Edit
            </button>
            <button
              onClick={startDuplicate}
              className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded transition-colors text-blue-700 hover:text-blue-900"
              title="Duplicate this trail as a new entry"
              aria-label="Duplicate this trail as a new entry"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Dup
            </button>
            {!isDuplicate && (
              <button
                onClick={handleDelete}
                className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded transition-colors text-red-700 hover:text-red-900"
                title="Delete this trail"
                aria-label="Delete this trail"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Del
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-green-800 text-white p-6">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-bold">{getEditedValue('fullName') || getTrailName(trail)}</h1>
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
                  {getEditedValue('distance') != null ? Number(getEditedValue('distance')).toFixed(1) : 'N/A'}
                  {getEditedValue('distanceExtended') != null && ` / ${Number(getEditedValue('distanceExtended')).toFixed(1)}`}
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
                    {getEditedValue('range') ? getRideCost(parseInt(getEditedValue('range'), 10)) || `Range: ${getEditedValue('range')}` : rideCost || 'N/A'}
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

        {getEditedValue('altNames') && getEditedValue('altNames').length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Alternate Names</h3>
              <div className="flex flex-wrap gap-2">
                {getEditedValue('altNames').map((name, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm"
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {trail.webLink ? (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Web Link</h3>
              <a
                href={trail.webLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-blue-600 hover:text-blue-800 hover:underline"
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                <span className="truncate">{trail.webLink}</span>
              </a>
            </div>
          ) : (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Web Link</h3>
              <a
                href={getGoogleAllTrailsSearchUrl(getTrailName(trail))}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-blue-600 hover:text-blue-800 hover:underline"
                title={`Search for ${getTrailName(trail)} on AllTrails in Washington`}
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span>Search for this trail on AllTrails</span>
              </a>
            </div>
          )}

          {getEditedValue('tideStationId') && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Tide Station</h3>
              <a
                href={getNoaaTideUrl(getEditedValue('tideStationId'))}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-blue-600 hover:text-blue-800 hover:underline"
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15c2-1 4-1 6 0s4 1 6 0 4-1 6 0" />
                </svg>
                <span>NOAA Station {getEditedValue('tideStationId')}</span>
              </a>
            </div>
          )}

          {trail.gpxFile && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">GPX Track</h3>
               <div className="flex items-center gap-3">
                 <GPXHelp variant="light" />
                <button
                      onClick={handleGpxShare}
                    className="flex items-center gap-2 text-green-600 hover:text-green-800 hover:underline"
                    title="Share GPX to Organic Maps (mobile) or download (desktop)"
                    aria-label="Share GPX to Organic Maps or download"
                  >
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  <span>Share GPX (opens in Organic Maps or downloads)</span>
                </button>
                <span className="text-sm text-gray-500" title="Matched GPX file">
                  {trail.gpxFile}
                </span>
              </div>
            </div>
          )}

               {(() => {
                 const monthly = trailDetailsResult?.[id]?.popularity?.monthly || [];
                 const trailForPop = trails.find(t => t.id === id);
                 const popSeasonal = trailForPop?.seasonal || {};
                 if (monthly.length === 0) return null;
                 return (
                   <div className="mb-6">
                     <h3 className="text-lg font-semibold text-gray-800 mb-3">Popularity</h3>
                     <div className="grid grid-cols-1 gap-4">
                       <div className="bg-gray-50 rounded-lg p-4">
                         <p className="text-sm text-gray-500 mb-2">Monthly Popularity</p>
                         <MonthlyScoreGrid
                           monthly={monthly}
                              availableMonths={getAvailableMonthsFromSeasonal(popSeasonal)}
                           seasonal={popSeasonal}
                         />
                         <div className="flex gap-2 mt-2 pt-2 border-t border-gray-200">
                           <ScoreBreakdownRow
                             monthly={monthly}
                             availableMonths={getAvailableMonthsFromSeasonal(popSeasonal)}
                             seasonal={popSeasonal}
                           />
                         </div>
                       </div>
                     </div>
                   </div>
                 );
                })()}
           </div>
         </div>

       {isEditMode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" role="dialog" aria-modal="true" aria-label={isDuplicate ? 'Duplicate trail' : `Edit ${getTrailName(trail)}`}>
            <div className="p-6">
              {isDuplicate ? (
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">Duplicate Trail</h2>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                    <p className="text-sm text-yellow-700">
                      This is a copy of <strong>{getTrailName(trail)}</strong>. Change the name below before saving.
                    </p>
                    <div className="mt-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Trail ID</label>
                      <input
                        type="text"
                        value={editedFields.id || ''}
                        onChange={(e) => updateField('id', e.target.value.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase())}
                        maxLength={24}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500 font-mono text-sm"
                        placeholder="e.g. oat-horse-living-room"
                      />
                      <p className="text-xs text-gray-500 mt-1">Letters, numbers, hyphens, underscores only (max 24 chars)</p>
                    </div>
                  </div>
                </div>
              ) : (
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Edit {getTrailName(trail)}</h2>
              )}

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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Required Parking Pass</label>
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
                     <label className="block text-sm font-medium text-gray-700 mb-1">Distance from parking lot in minutes (Range) used to calculate carpool fees</label>
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
                      onChange={(e) => updateField('elevationStart', e.target.value ? parseInt(e.target.value, 10) : '')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Elevation Max (ft)</label>
                    <input
                      type="number"
                      value={getEditedValue('elevationMax') != null ? getEditedValue('elevationMax') : ''}
                      onChange={(e) => updateField('elevationMax', e.target.value ? parseInt(e.target.value, 10) : '')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3 border-b pb-2">Popularity</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Popularity <span className="text-xs text-gray-400 font-normal">How often the hike appears in each month's schedule</span></label>
                    <MonthGrid
                      months={MONTH_ABBR}
                      className="flex gap-2"
                      renderMonth={(month, idx) => (
                        <div key={idx} className="flex flex-col items-center min-w-[40px]">
                          <span className="text-[10px] text-gray-500 mb-0.5">{month.substring(0, 3)}</span>
                          <input
                            type="number"
                            min="0"
                            max="99"
                            value={getEditedValue('monthlyPopularity')[idx] || ''}
                            onChange={(e) => {
                              const monthly = [...getEditedValue('monthlyPopularity')];
                              monthly[idx] = e.target.value ? parseInt(e.target.value, 10) : 0;
                              updateField('monthlyPopularity', monthly);
                            }}
                            className="w-12 text-center px-1 py-1 border border-gray-300 rounded text-sm focus:ring-green-500 focus:border-green-500"
                            title={`${month} hike count`}
                            aria-label={`${month} hike count`}
                          />
                        </div>
                      )}
                    />
                    <div className="flex gap-2 mt-2 pt-2 border-t border-gray-200">
                        <ScoreBreakdownRow
                          monthly={getEditedValue('monthlyPopularity') || []}
                          availableMonths={getEditedValue('availableMonths') || []}
                          seasonal={{ ...trail.seasonal, bestSeason: getEditedValue('bestSeason') }}
                        />
                    </div>
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-sm font-medium text-gray-700 mb-2">Monthly Score</p>
                        <MonthlyScoreGrid
                          monthly={getEditedValue('monthlyPopularity') || []}
                          availableMonths={getEditedValue('availableMonths') || []}
                          seasonal={{ ...trail.seasonal, bestSeason: getEditedValue('bestSeason') }}
                        />
                        <p className="text-xs text-gray-400 mt-2">Per-month popularity score (0-9) for filtering</p>
                        <p className="text-xs text-gray-400 mt-2">QuarterBase(1 if quarter data exists) + MonthBase(1 if month in schedule) + ScheduleBase(hike_count × 2, max 9) = Score (max 9)</p>
                      </div>


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
                   <MonthGrid
                     months={MONTH_ABBR}
                     className="flex flex-wrap gap-2"
                     renderMonth={(month, idx) => (
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
                     )}
                   />
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Alternate Names (comma-separated)</label>
                    <input
                      type="text"
                      value={getEditedValue('altNames')?.join(', ') || ''}
                      onChange={(e) => updateField('altNames', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                      placeholder="Schedule name 1, Schedule name 2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Web Link</label>
                    <input
                      type="url"
                      value={editedFields.webLink ?? (trail.webLink || '')}
                      onChange={(e) => updateField('webLink', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                      placeholder="https://example.com/trail"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">NOAA Tide Station ID</label>
                    <input
                      type="text"
                      value={getEditedValue('tideStationId') || ''}
                      onChange={(e) => updateField('tideStationId', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                      placeholder="e.g. 9447130"
                    />
                    {(() => {
                      const val = String(getEditedValue('tideStationId') || '').trim();
                      if (val && !/^\d{7}$/.test(val)) return <p className="text-xs text-amber-600 mt-1">Expected 7 digits (e.g. 9447130)</p>;
                      return null;
                    })()}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">GPX Track</label>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        {(editedFields.gpxFile ?? trail.gpxFile) ? (
                          <>
                            <span className="text-gray-700">{editedFields.gpxFile ?? trail.gpxFile}</span>
                            <span className="text-gray-400">(uploaded)</span>
                          </>
                        ) : (
                          <span className="text-gray-400">No GPX file</span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            createFileInput({
                              accept: '.gpx',
                              onFile: async (file) => {
                                console.log('[TrailDetail] Uploading GPX:', file.name, 'for trail:', trail.id);
                                try {
                                  const result = await uploadGpxFile(trail.id, file);
                                  console.log('[TrailDetail] GPX upload result:', result);
                                  updateField('gpxFile', result.gpxFile);
                                  updateField('hasGpx', true);
                                  if (result.trailHeadLat != null) updateField('trailHeadLat', result.trailHeadLat);
                                  if (result.trailHeadLon != null) updateField('trailHeadLon', result.trailHeadLon);
                                  showToast('GPX uploaded successfully');
                                } catch (err) {
                                  console.error('[TrailDetail] GPX upload error:', err);
                                  showToast(err.message, 'error');
                                }
                              }
                            });
                          }}
                          className="px-3 py-2 text-sm bg-gray-200 text-gray-700 hover:bg-gray-300 rounded-lg transition-colors"
                        >
                          {(editedFields.gpxFile ?? trail.gpxFile) ? 'Replace GPX' : 'Upload GPX'}
                        </button>
                        {(editedFields.gpxFile ?? trail.gpxFile) && (
                          <button
                            onClick={() => updateField('gpxFile', '')}
                            className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
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
                  disabled={isDuplicate && ((editedFields.fullName || '') === getTrailName(trail))}
                  className={`px-4 py-2 text-white rounded-lg transition-colors ${
                    isDuplicate && (editedFields.fullName || '') === getTrailName(trail)
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {isDuplicate ? 'Save New Trail' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
