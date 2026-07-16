// Sanitize a string for use as a filename
export function sanitizeFilename(name, fallback = 'file') {
  return (name || fallback).replace(/[^a-zA-Z0-9]/g, '_');
}

// Extract the first GPS coordinate from GPX XML content
export function getFirstCoordinateFromGpx(gpxContent) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(gpxContent, 'application/xml');
  // Check for parsing errors
  if (doc.querySelector('parsererror')) return null;
  // Try trkpt first (track points)
  const trkpt = doc.querySelector('trkpt');
  if (trkpt) {
    const lat = parseFloat(trkpt.getAttribute('lat'));
    const lon = parseFloat(trkpt.getAttribute('lon'));
    if (!isNaN(lat) && !isNaN(lon)) return { lat, lon };
  }
  // Fallback to wpt (waypoints)
  const wpt = doc.querySelector('wpt');
  if (wpt) {
    const lat = parseFloat(wpt.getAttribute('lat'));
    const lon = parseFloat(wpt.getAttribute('lon'));
    if (!isNaN(lat) && !isNaN(lon)) return { lat, lon };
  }
  // Fallback to rtept (route points)
  const rtept = doc.querySelector('rtept');
  if (rtept) {
    const lat = parseFloat(rtept.getAttribute('lat'));
    const lon = parseFloat(rtept.getAttribute('lon'));
    if (!isNaN(lat) && !isNaN(lon)) return { lat, lon };
  }
  return null;
}

// Open Google Maps for a trailhead coordinate
export function openGoogleMapsTrailhead(lat, lon) {
  const url = `https://www.google.com/maps?q=${lat},${lon}`;
  window.open(url, '_blank');
}

// Open NWS weather forecast page for a coordinate
export function openWeatherUrl(lat, lon) {
  const url = `https://forecast.weather.gov/MapClick.php?lon=${lon}&lat=${lat}`;
  window.open(url, '_blank');
}

/**
 * Fetch NWS forecast for a date from trailhead coordinates.
 * Returns { temp, rain } or null.
 *   temp  — high temperature in °F for the day period
 *   rain  — probability of precipitation (0–100) for the day period
 * Uses a module-level cache keyed by "lat,lon" with a 3-hour TTL so the
 * forecast refreshes when NWS updates it.
 */
const _nwsCache = new Map();
const _nwsTTL = 3 * 60 * 60 * 1000; // 3 hours

export async function fetchNwsForecastForDate(lat, lon, targetDate) {
  const cacheKey = `${lat},${lon}`;
  let cached = _nwsCache.get(cacheKey);

  let periods;
  if (cached && Date.now() - cached.ts < _nwsTTL) {
    periods = cached.periods;
  } else {
    try {
      const ptRes = await fetch(`https://api.weather.gov/points/${lat},${lon}`, {
        headers: { 'Accept': 'application/geo+json', 'User-Agent': 'Hiker-App' }
      });
      if (!ptRes.ok) return null;
      const pt = await ptRes.json();
      const gridId = pt.properties.gridId;
      const gridX = pt.properties.gridX;
      const gridY = pt.properties.gridY;
      const fcRes = await fetch(
        `https://api.weather.gov/gridpoints/${gridId}/${gridX},${gridY}/forecast`,
        { headers: { 'Accept': 'application/geo+json', 'User-Agent': 'Hiker-App' } }
      );
      if (!fcRes.ok) return null;
      const fc = await fcRes.json();
      periods = fc.properties.periods;
      _nwsCache.set(cacheKey, { periods, ts: Date.now() });
    } catch {
      return null;
    }
  }

  // Match the period whose name matches the target day.
  // NWS uses "Today"/"Tonight" for the current day, and weekday names for
  // subsequent days (e.g. "Thursday", "Thursday Night").
  // Prefer daytime; fall back to nighttime for same-day hikes where
  // the daytime period has already passed.
  const today = new Date();
  const isSameDay = targetDate.toDateString() === today.toDateString();
  const dayName = targetDate.toLocaleDateString('en-US', { weekday: 'long' });

  const matchDay = (p) => {
    if (isSameDay) return p.name.includes('Today') || p.name.includes('today');
    return p.name.includes(dayName);
  };

  const dayPeriod = periods.find(p => matchDay(p) && p.isDaytime !== false)
    || periods.find(p => matchDay(p));
  if (!dayPeriod) return null;

  return {
    temp: dayPeriod.temperature,
    rain: dayPeriod.probabilityOfPrecipitation
      ? dayPeriod.probabilityOfPrecipitation.value
      : 0,
  };
}

// Fetch GPX for a trail, extract first coordinate, and open weather forecast page
export async function openWeatherForTrail(getGpxFn, trailId) {
  const gpx = await getGpxFn(trailId);
  if (!gpx) return;
  const coord = getFirstCoordinateFromGpx(gpx);
  if (coord) {
    openWeatherUrl(coord.lat, coord.lon);
  }
}

// Open GPX file in associated app (mobile: Web Share, desktop: download with extension)
export async function shareGpxFile(gpxContent, trailName) {
  const safeName = sanitizeFilename(trailName, 'route');
  const filename = `${safeName}.gpx`;
  const blob = new Blob([gpxContent], { type: 'application/gpx+xml' });
  const file = new File([blob], filename, { type: 'application/gpx+xml' });

  // Mobile: Web Share API opens directly in app
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: trailName });
      return true;
    } catch (err) {
      if (err.name === 'AbortError') return false;
    }
  }

  // Desktop: download with .gpx extension so OS file association works
  // If browser has "Open compatible downloads" enabled (Chrome default), it will
  // automatically prompt to open in the associated app (GPXsee, Locus, etc.)
  downloadBlob(gpxContent, filename, 'application/gpx+xml');
  return true;
}

// Download a blob as a file
export function downloadBlob(data, filename, type = 'application/json') {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Create a hidden file input, trigger it, and call onFile with the selected file
export function createFileInput({ accept, onFile, onCleanup }) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  input.style.display = 'none';
  input.onchange = () => {
    if (!input.files?.[0]) return;
    onFile(input.files[0]);
    document.body.removeChild(input);
    onCleanup?.();
  };
  document.body.appendChild(input);
  input.click();
}

// Returns a file input element that triggers a callback with parsed JSON
export function createImportFileInput(onImport, onError) {
  createFileInput({
    accept: '.json',
    onFile: (file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target.result);
          onImport(imported);
        } catch {
          onError?.('Error importing file: Invalid JSON format');
        }
      };
      reader.readAsText(file);
    },
  });
}

// Split string into chunks of ~maxLen chars, breaking at word boundaries
function chunkString(str, maxLen) {
  const chunks = [];
  let i = 0;
  while (i < str.length) {
    if (i + maxLen >= str.length) {
      chunks.push(str.slice(i));
      break;
    }
    let end = i + maxLen;
    const lastSpace = str.lastIndexOf(' ', end);
    if (lastSpace > i) end = lastSpace;
    chunks.push(str.slice(i, end));
    i = end + 1;
  }
  return chunks;
}

// Export a single trail to TSV format matching the Excel hike page layout exactly.
// Output is a raw cell dump: 20 rows x 9 columns (A-I), tabs between columns.
// Cell positions:
//   A0=Trail Name, B2=Distance, D2=Dist Extended, G2=Elev Start, I2=Elev Max
//   B3=Parking, G3=Best Season, B4=Level, G4=Range
//   A6=Description, B14=Pros, B16=Other, B19=Leaders
export function exportTrailTsv(trail, detail) {
  const r = (len = 9) => Array(len).fill('');
  const grid = [];

  // Row 0: Trail Name
  grid.push([...r()]);
  grid[0][0] = trail.fullName || trail.name || '';

  // Row 1: empty
  grid.push([...r()]);

  // Row 2: Miles & Elevation
  grid.push([...r()]);
  grid[2][0] = 'Miles';
  grid[2][1] = trail.distance ?? '';
  grid[2][2] = 'to';
  grid[2][3] = trail.distanceExtended ?? '';
  grid[2][5] = 'Elevation';
  grid[2][6] = trail.elevationStart ?? '';
  grid[2][7] = 'to';
  grid[2][8] = trail.elevationMax ?? '';

  // Row 3: Parking & Season
  grid.push([...r()]);
  grid[3][0] = 'Parking';
  grid[3][1] = trail.parking || '';
  grid[3][5] = 'Season';
  grid[3][6] = trail.seasonal?.bestSeason || '';

  // Row 4: Level & Range
  grid.push([...r()]);
  grid[4][0] = 'Level';
  grid[4][1] = trail.difficulty || '';
  grid[4][5] = 'Range';
  grid[4][6] = trail.range ?? '';

  // Row 5: General Information
  grid.push([...r()]);
  grid[5][0] = 'General Information';

  // Rows 6-13: Description (split across 8 rows, ~80 chars per row to match Excel wrapping)
  const desc = detail?.fullDescription || '';
  const descChunks = desc ? chunkString(desc, 80) : [];
  for (let i = 6; i <= 13; i++) {
    grid.push([...r()]);
    grid[i][0] = descChunks[i - 6] || '';
  }

  // Row 14: Pros
  grid.push([...r()]);
  grid[14][0] = 'Pros';
  grid[14][1] = detail?.pros || '';

  // Row 15: empty
  grid.push([...r()]);

  // Row 16: Other
  grid.push([...r()]);
  grid[16][0] = 'Other';
  grid[16][1] = detail?.others || '';

  // Rows 17-18: empty
  for (let i = 17; i <= 18; i++) grid.push([...r()]);

  // Row 19: Leaders
  grid.push([...r()]);
  grid[19][0] = 'Leaders';
  grid[19][1] = Array.isArray(detail?.leaders) ? detail.leaders.join(', ') : '';

  return grid.map(row => row.join('\t')).join('\n');
}

// Parse TSV in the raw Excel cell layout format back into trail + detail objects.
// Expects 20 rows x 9 columns (A-I), tabs between columns.
export function parseTrailTsv(text) {
  const lines = text.split('\n').map(l => l.split('\t'));
  if (lines.length < 20) throw new Error('TSV file must have 20 rows.');

  const cell = (row, col) => (lines[row]?.[col] || '').trim();
  const parseNum = (v, fn) => {
    if (!v) return null;
    try { return fn(v); } catch { return null; }
  };

  const trailName = cell(0, 0);
  let distance = parseNum(cell(2, 1), parseFloat);
  let distanceExtended = parseNum(cell(2, 3), parseFloat);
  let elevationStart = parseNum(cell(2, 6), v => parseInt(v, 10));
  let elevationMax = parseNum(cell(2, 8), v => parseInt(v, 10));
  // If distanceExtended has a value but distance is empty, move it to distance
  if (!distance && distanceExtended != null) {
    distance = distanceExtended;
    distanceExtended = null;
  }
  // If elevationMax has a value but elevationStart is empty, swap them
  if (!elevationStart && elevationMax != null) {
    elevationStart = elevationMax;
    elevationMax = null;
  }
  const parking = cell(3, 1);
  const bestSeason = cell(3, 6);
  const level = cell(4, 1);
  const range = cell(4, 6);
  const description = lines.slice(6, 14).map(l => (l[0] || '').trim()).filter(Boolean).join(' ');
  const pros = cell(14, 1) || null;
  const others = cell(16, 1) || null;
  const leadersRaw = cell(19, 1);
  const leaders = leadersRaw
    ? leadersRaw.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  const orderMap = { 'Easy': 1, 'Easy to Mod': 2, 'Moderate': 3, 'Mod to Diff': 4, 'Difficult': 5 };

  const trail = {
    name: trailName || '',
    fullName: trailName || '',
    distance,
    distanceExtended,
    elevationStart,
    elevationMax,
    difficulty: level || 'Unknown',
    parking,
    range: range || '',
    notes: trailName ? trailName.substring(0, 200) : '',
    seasonal: {
      availableMonths: [],
      bestSeason,
    },
    difficultyOrder: orderMap[level] ?? 99,
  };

  const detail = {
    fullDescription: description || '',
    pros,
    others,
    leaders,
  };

  return { trail, detail };
}
