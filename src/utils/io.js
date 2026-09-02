import { getTrailName } from './data';
import { formatDateCompact, formatDateToISO, isWithin7Days } from './dateUtils';

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
  if (!hasValidCoords(lat, lon)) return;
  const url = `https://www.google.com/maps?q=${lat},${lon}`;
  window.open(url, '_blank');
}

function isValidCoordinate(value) {
  if (value == null || value === '' || typeof value === 'boolean') return false;
  return Number.isFinite(Number(value));
}

export function hasValidCoords(lat, lon) {
  if (!isValidCoordinate(lat) || !isValidCoordinate(lon)) return false;
  const latNum = Number(lat);
  const lonNum = Number(lon);
  if (latNum === 0 && lonNum === 0) return false;
  if (Math.abs(latNum) > 90 || Math.abs(lonNum) > 180) return false;
  return true;
}

// NOAA/NWS coverage box (continental US). Coordinates strictly inside this box
// use the NWS forecast; coordinates outside fall back to Open-Meteo.
const NOAA_BOX = { minLat: 25, maxLat: 48.2, minLon: -124, maxLon: -66 };

/**
 * Whether a coordinate falls inside the NOAA/NWS coverage box.
 * @param {number|string} lat
 * @param {number|string} lon
 * @returns {boolean}
 */
export function isNoaaRegion(lat, lon) {
  if (!hasValidCoords(lat, lon)) return false;
  const la = Number(lat);
  const lo = Number(lon);
  return la > NOAA_BOX.minLat && la < NOAA_BOX.maxLat && lo > NOAA_BOX.minLon && lo < NOAA_BOX.maxLon;
}

// Open NWS weather forecast page for a coordinate
export function openWeatherUrl(lat, lon) {
  if (!hasValidCoords(lat, lon)) return;
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
const _nwsMissCache = new Map();
const _nwsTTL = 3 * 60 * 60 * 1000; // 3 hours

export function clearNwsCache() {
  _nwsCache.clear();
  _nwsMissCache.clear();
}

export async function fetchNwsForecastForDate(lat, lon, targetDate) {
  if (!hasValidCoords(lat, lon) || !targetDate) return null;
  const cacheKey = `${lat},${lon}`;
  const miss = _nwsMissCache.get(cacheKey);
  if (miss && Date.now() - miss.ts < _nwsTTL) return null;

  let cached = _nwsCache.get(cacheKey);
  let periods;
  if (cached && Date.now() - cached.ts < _nwsTTL) {
    periods = cached.periods;
  } else {
    try {
      const ptRes = await fetch(`https://api.weather.gov/points/${lat},${lon}`, {
        headers: { 'Accept': 'application/geo+json', 'User-Agent': 'Hiker-App' }
      });
      if (!ptRes.ok) {
        if (ptRes.status === 404) _nwsMissCache.set(cacheKey, { ts: Date.now() });
        return null;
      }
      const pt = await ptRes.json();
      const gridId = pt.properties.gridId;
      const gridX = pt.properties.gridX;
      const gridY = pt.properties.gridY;
      const fcRes = await fetch(
        `https://api.weather.gov/gridpoints/${gridId}/${gridX},${gridY}/forecast`,
        { headers: { 'Accept': 'application/geo+json', 'User-Agent': 'Hiker-App' } }
      );
      if (!fcRes.ok) {
        if (fcRes.status === 404) _nwsMissCache.set(cacheKey, { ts: Date.now() });
        return null;
      }
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
    if (isSameDay) return /^(Today|This (Morning|Afternoon|Evening)|Tonight)$/.test(p.name);
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

/**
 * Fetch Open-Meteo forecast for a date from coordinates.
 * Returns { temp, rain, om: true } or null.
 *   temp  — high temperature in °F for the day
 *   rain  — max precipitation probability (0–100) for the day
 *   om    — true, so the UI can tag the rain % with an "OM" source marker
 */
const OPEN_METEO_MAX_DAYS = 16;
const _omCache = new Map();
const _omTTL = 6 * 60 * 60 * 1000; // 6 hours

export function clearOmCache() {
  _omCache.clear();
}

export async function fetchOpenMeteoForDate(lat, lon, targetDate) {
  if (!hasValidCoords(lat, lon) || !targetDate) return null;
  const now = new Date();
  const diffDays = Math.floor((new Date(targetDate) - now) / (1000 * 60 * 60 * 24));
  if (diffDays > OPEN_METEO_MAX_DAYS) return null;
  const dateStr = formatDateToISO(targetDate);
  const cacheKey = `${lat},${lon},${dateStr}`;
  const cached = _omCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < _omTTL) return cached.value;
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&daily=temperature_2m_max,precipitation_probability_max` +
    `&temperature_unit=fahrenheit&timezone=auto` +
    `&start_date=${dateStr}&end_date=${dateStr}`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Hiker-App' } });
    if (!res.ok) return null;
    const data = await res.json();
    const daily = data?.daily;
    if (!daily || !Array.isArray(daily.time) || daily.time.length === 0) return null;
    const temp = daily.temperature_2m_max?.[0];
    if (temp == null) return null;
    const rain = daily.precipitation_probability_max?.[0];
    const result = { temp: Math.round(temp), rain: rain ?? 0, om: true };
    _omCache.set(cacheKey, { value: result, ts: Date.now() });
    return result;
  } catch {
    return null;
  }
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

/**
 * Build a trailCoords map from trail IDs and trail objects.
 * Includes trails that have coordinates OR a tide station ID.
 * @param {string[]} trailIds
 * @param {Array} trails
 * @returns {Object<string, {lat: number|null, lon: number|null, stationId: string|null}>}
 */
export function buildTrailCoords(trailIds, trails) {
  const trailById = new Map((trails || []).map(t => [t.id, t]));
  const trailCoords = {};
  for (const id of trailIds) {
    const t = trailById.get(id);
    const hasCoords = hasValidCoords(t?.trailHeadLat, t?.trailHeadLon);
    const hasTide = !!t?.tideStationId;
    if (hasCoords || hasTide) {
      trailCoords[id] = {
        lat: t.trailHeadLat ?? null,
        lon: t.trailHeadLon ?? null,
        stationId: t.tideStationId || null,
      };
    }
  }
  return trailCoords;
}

/**
 * Fetch weather for coordinates on a given date, plus tide if a station ID
 * is provided.
 * @param {number} lat
 * @param {number} lon
 * @param {Date} targetDate
 * @param {string|null} [stationId] - NOAA tide station ID (tide fetched only when provided)
 * @returns {{temp: number, rain: number, tide?: number}|null}
 */
const FETCH_TIMEOUT_MS = 15000;

function withTimeout(promise, ms = FETCH_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

export async function fetchWeatherAndTide(lat, lon, targetDate, stationId) {
  try {
    const hasCoords = hasValidCoords(lat, lon);
    const tasks = [];
    if (hasCoords) {
      // NWS only covers the next 7 days inside the NOAA box. Everything else
      // (out-of-box sites, or in-box sites beyond 7 days) uses Open-Meteo.
      const useNws = isNoaaRegion(lat, lon) && isWithin7Days(targetDate);
      tasks.push(withTimeout(useNws
        ? fetchNwsForecastForDate(lat, lon, targetDate)
        : fetchOpenMeteoForDate(lat, lon, targetDate)));
    }
    if (stationId) tasks.push(withTimeout(fetchTideHeightAt(stationId, targetDate)));
    if (tasks.length === 0) return null;

    const results = await Promise.allSettled(tasks);
    const entry = {};
    if (hasCoords && results[0].status === 'fulfilled' && results[0].value) Object.assign(entry, results[0].value);
    const tideIdx = hasCoords ? 1 : 0;
    if (stationId && results[tideIdx]?.status === 'fulfilled' && results[tideIdx]?.value) {
      entry.tide = results[tideIdx].value.height;
      entry.tideTime = results[tideIdx].value.time;
    }

    return Object.keys(entry).length > 0 ? entry : null;
  } catch {
    return null;
  }
}

/**
 * Fetch weather for a map of trail coordinates on a given date.
 * @param {Object<string, {lat: number|null, lon: number|null, stationId: string|null}>} trailCoords
 * @param {Date} date
 * @returns {Promise<Object<string, {temp: number, rain: number, tide?: number}>>}
 */
export async function fetchWeatherForCoords(trailCoords, date) {
  const results = {};
  await Promise.allSettled(Object.entries(trailCoords).map(async ([trailId, info]) => {
    const res = await fetchWeatherAndTide(info.lat, info.lon, date, info.stationId);
    if (res) results[trailId] = res;
  }));
  return results;
}

/**
 * Fetch tide predictions for a map of trail coordinates on a given date.
 * @param {Object<string, {lat: number|null, lon: number|null, stationId: string|null}>} trailCoords
 * @param {Date} date
 * @returns {Promise<Object<string, {tide: number, tideTime: string}>>}
 */
export async function fetchTideForCoords(trailCoords, date) {
  const results = {};
  await Promise.allSettled(Object.entries(trailCoords).map(async ([trailId, info]) => {
    if (!info?.stationId) return;
    const res = await fetchTideHeightAt(info.stationId, date);
    if (res) results[trailId] = { tide: res.height, tideTime: res.time };
  }));
  return results;
}

/**
 * Fetch the nearest low tide (feet, MLLW datum) to the given local hour.
 * @param {string} stationId - NOAA tide station ID
 * @param {Date} targetDate
 * @param {number} [hour] - Local hour 0-23 (default 10 = 10am)
 * @returns {{height: number, time: string}|null}
 */
const _tideCache = new Map();
const _tideTTL = 6 * 60 * 60 * 1000; // 6 hours — tide predictions are stable

export function clearTideCache() {
  _tideCache.clear();
}

export async function fetchTideHeightAt(stationId, targetDate, hour = 10) {
  if (!stationId || !targetDate) return null;
  const d = new Date(targetDate);
  const dateStr = formatDateCompact(d);
  const cacheKey = `${stationId}:${dateStr}:${hour}`;
  const cached = _tideCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < _tideTTL) return cached.value;
  try {
    const { getApiBase } = await import('./url');
    const res = await fetch(
      `${getApiBase()}/api/tide-proxy?station=${stationId}&begin_date=${dateStr}&end_date=${dateStr}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const preds = (data.predictions || []).filter(p => p.type === 'L');
    if (!preds.length) return null;
    const target = new Date(targetDate);
    target.setHours(hour, 0, 0, 0);
    let best = null;
    for (const p of preds) {
      // API returns "YYYY-MM-DD HH:MM" in local station time
      const [datePart, timePart] = p.t.split(' ');
      const [y, mo, dd] = datePart.split('-').map(Number);
      const [hh, mm] = timePart.split(':').map(Number);
      const t = new Date(y, mo - 1, dd, hh, mm);
      if (isNaN(t.getTime())) continue;
      const diff = Math.abs(t.getTime() - target.getTime());
      if (!best || diff < best.diff) best = { diff, v: p.v, hh, mm };
    }
    if (!best) return null;
    const height = parseFloat(best.v);
    if (isNaN(height)) return null;
    const h12 = best.hh % 12 || 12;
    const time = `${h12}:${String(best.mm).padStart(2, '0')}${best.hh >= 12 ? 'p' : 'a'}`;
    const result = { height, time };
    _tideCache.set(cacheKey, { value: result, ts: Date.now() });
    return result;
  } catch {
    return null;
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
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Open HTML content in a new browser tab
export function openHtmlInNewTab(html) {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// Create a hidden file input, trigger it, and call onFile with the selected file
export function createFileInput({ accept, onFile, onCleanup }) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  input.style.display = 'none';
  input.onchange = async () => {
    if (!input.files?.[0]) {
      document.body.removeChild(input);
      onCleanup?.();
      return;
    }
    document.body.removeChild(input);
    onCleanup?.();
    try {
      await onFile(input.files[0]);
    } catch (err) {
      console.error('[createFileInput] Unhandled error:', err);
    }
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
      reader.onload = async (e) => {
        try {
          const imported = JSON.parse(e.target.result);
          await onImport(imported);
        } catch (err) {
          onError?.(err.message || 'Error importing file: Invalid JSON format');
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
  grid[0][0] = getTrailName(trail);

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
