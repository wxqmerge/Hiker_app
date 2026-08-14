import { MONTH_ABBR } from './constants';
import { getSeasonalInfo, calculateMonthlyScore } from './score.js';
import { getTrailDetailsById, getTrailName } from './data';

function getTrailMonthlyScore(trail, trailDetails, idx) {
  const rawId = trail?.id || trail?.trail?.id;
  if (!rawId || !trailDetails) return null;
  const resolved = getTrailDetailsById(trailDetails, rawId);
  const details = resolved ? resolved[rawId] : null;
  if (details?.popularity?.monthlyScore) {
    return details.popularity.monthlyScore[idx];
  }
  if (trail.monthlyScore) {
    return trail.monthlyScore[idx];
  }
  return null;
}

// Core filter logic shared by browse and schedule modes
export function filterTrails(items, filters, trailDetails) {
  const searchLower = filters.search?.trim()
    ? filters.search.toLowerCase().replace(/[^a-z0-9]/g, '')
    : null;
  return items.filter(item => {
    const t = item.trail || item;

    if (searchLower) {
      const searchText = [
        t.name,
        t.fullName,
        t.notes,
        t.difficulty,
        ...Object.entries(t.seasonal || [])
          .filter(([, v]) => typeof v === 'number' && v > 0)
          .map(([k]) => k.toLowerCase())
      ].filter(Boolean).join(' ').toLowerCase().replace(/[^a-z0-9]/g, '');

      if (!searchText.includes(searchLower)) return false;
    }

    if (t.distance != null) {
      if (t.distance < filters.distance.min || t.distance > filters.distance.max) return false;
    }

    if (t.elevationStart != null) {
      if (t.elevationStart < filters.elevation.min || t.elevationStart > filters.elevation.max) return false;
    }

    if (filters.difficulties.length > 0 && !filters.difficulties.includes(t.difficulty)) return false;

    if (filters.months.length > 0) {
      const seasonal = t.seasonal || {};
      const matchesMonth = filters.months.some(monthIdx => {
        const monthName = MONTH_ABBR[monthIdx];
        if (monthName && seasonal[monthName] > 0) return true;
        // Handle { availableMonths: [1, 2, 3] } format (1=Jan, 2=Feb, ...)
        if (Array.isArray(seasonal.availableMonths)) {
          return seasonal.availableMonths.includes(monthIdx + 1);
        }
        // Handle monthlyScore format (12-element array)
        const score = getTrailMonthlyScore(item, trailDetails, monthIdx);
        if (score != null && score > 0) return true;
        return false;
      });
      if (!matchesMonth) return false;
    }

    if (filters.wilderness) {
      const name = getTrailName(t);
      if (!name.includes('\u25C6')) return false;
    }

    if (filters.gpx && filters.gpx !== 'all') {
      const hasGpx = !!t.hasGpx;
      if ((filters.gpx === 'gpx' && !hasGpx) || (filters.gpx === 'noGpx' && hasGpx)) return false;
    }

    if (filters.tide && filters.tide !== 'all') {
      const hasTide = !!t.tideStationId;
      if ((filters.tide === 'tide' && !hasTide) || (filters.tide === 'noTide' && hasTide)) return false;
    }

    return true;
  });
}

// Sort logic shared by browse and schedule modes
export function sortTrails(items, filters, trailDetails) {
  const sorted = [...items];
  
  if (filters.sortBy === 'name') {
    sorted.sort((a, b) => {
      const ta = a.trail || a;
      const tb = b.trail || b;
      return getTrailName(ta).localeCompare(getTrailName(tb));
    });
  } else if (filters.sortBy === 'popularity') {
    const selectedMonthNames = filters.months.length > 0
      ? filters.months.map(i => MONTH_ABBR[i])
      : MONTH_ABBR;
    const getPopularityScore = (item) => {
      const t = item.trail || item;
      const seasonal = t.seasonal || {};
      const rawId = t.id || t.trail?.id;
      const resolved = rawId && trailDetails ? getTrailDetailsById(trailDetails, rawId) : null;
      const details = resolved ? resolved[rawId] : null;
      const monthly = details?.popularity?.monthly || t.monthly || null;
      if (monthly) {
        const { hasQuarterData } = getSeasonalInfo(seasonal);
        const scoredMonths = filters.months.length === 0
          ? monthly.map((hikeCount, i) => ({ hikeCount, i }))
          : monthly.map((hikeCount, i) => ({ hikeCount, i })).filter(({ i }) => filters.months.includes(i));
        return scoredMonths.reduce((sum, { hikeCount, i }) => {
          return sum + calculateMonthlyScore(hikeCount, i, MONTH_ABBR.map((_, j) => j + 1), hasQuarterData);
        }, 0);
      }
      const keyed = filters.months.length === 0
        ? MONTH_ABBR.reduce((sum, m) => sum + (seasonal[m] || 0), 0)
        : selectedMonthNames.reduce((sum, m) => sum + (seasonal[m] || 0), 0);
      if (keyed > 0) return keyed;
      if (Array.isArray(seasonal.availableMonths)) {
        return filters.months.length === 0
          ? MONTH_ABBR.reduce((sum, _, i) => sum + (seasonal.availableMonths.includes(i + 1) ? 1 : 0), 0)
          : selectedMonthNames.reduce((sum, _, i) => sum + (seasonal.availableMonths.includes(i + 1) ? 1 : 0), 0);
      }
      return 0;
    };
    const scored = sorted.map(item => ({ item, score: getPopularityScore(item) }));
    scored.sort((a, b) => b.score - a.score);
    sorted.length = 0;
    scored.forEach(s => sorted.push(s.item));
  } else if (filters.sortBy === 'elevation-up') {
    sorted.sort((a, b) => ((a.trail || a).elevationStart || 0) - ((b.trail || b).elevationStart || 0));
  } else if (filters.sortBy === 'elevation-down') {
    sorted.sort((a, b) => ((b.trail || b).elevationStart || 0) - ((a.trail || a).elevationStart || 0));
  } else if (filters.sortBy === 'distance-up') {
    sorted.sort((a, b) => ((a.trail || a).distance || 0) - ((b.trail || b).distance || 0));
  } else if (filters.sortBy === 'distance-down') {
    sorted.sort((a, b) => ((b.trail || b).distance || 0) - ((a.trail || a).distance || 0));
  } else if (filters.sortBy === 'not-wilderness') {
    sorted.sort((a, b) => {
      const ta = a.trail || a;
      const tb = b.trail || b;
      const aWild = getTrailName(ta).includes('\u25C6') ? 1 : 0;
      const bWild = getTrailName(tb).includes('\u25C6') ? 1 : 0;
      if (aWild !== bWild) return aWild - bWild;
      return getTrailName(ta).localeCompare(getTrailName(tb));
    });
  }
  
  return sorted;
}
