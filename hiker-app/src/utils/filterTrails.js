import { MONTH_ABBR } from './constants';

// Core filter logic shared by browse and schedule modes
export function filterTrails(items, filters) {
  return items.filter(item => {
    const t = item.trail || item;

    if (filters.search?.trim()) {
      const searchLower = filters.search.toLowerCase();
      const searchText = [
        item.hikeName || item.hike,
        t.name,
        t.fullName,
        t.notes,
        t.difficulty,
        t.parking,
        t.seasonal?.parkingInfo,
        ...Object.entries(t.seasonal || [])
          .filter(([, v]) => typeof v === 'number' && v > 0)
          .map(([k]) => k.toLowerCase())
      ].filter(Boolean).join(' ').toLowerCase();
      
      if (!searchText.includes(searchLower)) return false;
    }

    if (t.distance != null) {
      if (t.distance < filters.distanceMin || t.distance > filters.distanceMax) return false;
    }

    if (t.elevationStart != null) {
      if (t.elevationStart < filters.elevationMin || t.elevationStart > filters.elevationMax) return false;
    }

    if (filters.difficulties.length > 0 && !filters.difficulties.includes(t.difficulty)) return false;

    if (filters.months.length > 0) {
      const seasonal = t.seasonal || {};
      const matchesMonth = filters.months.some(monthIdx => {
        const monthName = MONTH_ABBR[monthIdx];
        return monthName && seasonal[monthName] > 0;
      });
      if (!matchesMonth) return false;
    }

    if (filters.wilderness) {
      const name = t.fullName || t.name || '';
      if (!name.includes('\u25C6')) return false;
    }

    return true;
  });
}

// Sort logic shared by browse and schedule modes
export function sortTrails(items, filters, nameKey = 'name') {
  const sorted = [...items];
  
  if (filters.sortBy === 'name') {
    sorted.sort((a, b) => {
      const ta = a.trail || a;
      const tb = b.trail || b;
      return (ta.fullName || a[nameKey] || '').localeCompare(tb.fullName || b[nameKey] || '');
    });
  } else if (filters.sortBy === 'popularity') {
    const selectedMonthNames = filters.months.length > 0
      ? filters.months.map(i => MONTH_ABBR[i])
      : MONTH_ABBR;
    sorted.sort((a, b) => {
      const sa = (a.trail || a).seasonal || {};
      const sb = (b.trail || b).seasonal || {};
      const scoreA = selectedMonthNames.reduce((sum, m) => sum + (sa[m] || 0), 0);
      const scoreB = selectedMonthNames.reduce((sum, m) => sum + (sb[m] || 0), 0);
      return scoreB - scoreA;
    });
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
      const aWild = (ta.fullName || ta.name || '').includes('\u25C6') ? 1 : 0;
      const bWild = (tb.fullName || tb.name || '').includes('\u25C6') ? 1 : 0;
      if (aWild !== bWild) return aWild - bWild;
      return (ta.fullName || ta.name || '').localeCompare(tb.fullName || tb.name || '');
    });
  }
  
  return sorted;
}
