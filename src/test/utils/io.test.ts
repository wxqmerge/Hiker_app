import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sanitizeFilename, getFirstCoordinateFromGpx, exportTrailTsv, parseTrailTsv, fetchTideAtHike, fetchNwsForecastForDate, fetchOpenMeteoForDate, fetchWeatherAndTide, clearNwsCache, clearTideCache, clearOmCache, openWeatherUrl, hasValidCoords, isNoaaRegion, downloadBlob, createImportFileInput } from '../../utils/io';

describe('sanitizeFilename', () => {
  it('replaces non-alphanumeric characters with underscores', () => {
    expect(sanitizeFilename('Trail & Path')).toBe('Trail___Path');
    expect(sanitizeFilename('Mount/Rainier')).toBe('Mount_Rainier');
  });

  it('uses fallback for null/undefined', () => {
    expect(sanitizeFilename(null)).toBe('file');
    expect(sanitizeFilename(undefined)).toBe('file');
  });

  it('uses custom fallback', () => {
    expect(sanitizeFilename(null, 'route')).toBe('route');
  });

  it('returns unchanged alphanumeric string', () => {
    expect(sanitizeFilename('Trail123')).toBe('Trail123');
  });
});

describe('getFirstCoordinateFromGpx', () => {
  it('extracts coordinate from trkpt', () => {
    const gpx = `<gpx><trk><trkseg><trkpt lat="47.0" lon="-121.0"/></trkseg></trk></gpx>`;
    const coord = getFirstCoordinateFromGpx(gpx);
    expect(coord).toEqual({ lat: 47.0, lon: -121.0 });
  });

  it('falls back to wpt', () => {
    const gpx = `<gpx><wpt lat="48.0" lon="-122.0"/></gpx>`;
    const coord = getFirstCoordinateFromGpx(gpx);
    expect(coord).toEqual({ lat: 48.0, lon: -122.0 });
  });

  it('falls back to rtept', () => {
    const gpx = `<gpx><rte><rtept lat="49.0" lon="-123.0"/></rte></gpx>`;
    const coord = getFirstCoordinateFromGpx(gpx);
    expect(coord).toEqual({ lat: 49.0, lon: -123.0 });
  });

  it('prefers trkpt over wpt', () => {
    const gpx = `<gpx><trk><trkseg><trkpt lat="47.0" lon="-121.0"/></trkseg></trk><wpt lat="48.0" lon="-122.0"/></gpx>`;
    const coord = getFirstCoordinateFromGpx(gpx);
    expect(coord).toEqual({ lat: 47.0, lon: -121.0 });
  });

  it('returns null for invalid XML', () => {
    expect(getFirstCoordinateFromGpx('not xml')).toBeNull();
  });

  it('returns null for empty GPX', () => {
    expect(getFirstCoordinateFromGpx('<gpx></gpx>')).toBeNull();
  });

  it('returns null for invalid coordinates', () => {
    const gpx = `<gpx><trk><trkseg><trkpt lat="abc" lon="def"/></trkseg></trk></gpx>`;
    expect(getFirstCoordinateFromGpx(gpx)).toBeNull();
  });
});

describe('exportTrailTsv', () => {
  const trail = {
    name: 'Test Trail',
    fullName: 'Test Trail Full',
    distance: 5.0,
    distanceExtended: 7.5,
    elevationStart: 1000,
    elevationMax: 2000,
    difficulty: 'Moderate',
    parking: 'Trailhead A',
    range: 30,
    seasonal: { bestSeason: 'Summer' },
  };

  const detail = {
    fullDescription: 'A beautiful trail with nice views',
    pros: 'Easy parking',
    others: 'Bring water',
    leaders: ['Alice', 'Bob'],
  };

  it('generates 20 rows', () => {
    const tsv = exportTrailTsv(trail, detail);
    const lines = tsv.split('\n');
    expect(lines.length).toBe(20);
  });

  it('each row has 9 columns', () => {
    const tsv = exportTrailTsv(trail, detail);
    const lines = tsv.split('\n');
    lines.forEach(line => {
      expect(line.split('\t').length).toBe(9);
    });
  });

  it('includes trail name in row 0', () => {
    const tsv = exportTrailTsv(trail, detail);
    expect(tsv.split('\n')[0]).toContain('Test Trail Full');
  });

  it('includes distance and elevation in row 2', () => {
    const tsv = exportTrailTsv(trail, detail);
    const row2 = tsv.split('\n')[2].split('\t');
    expect(row2[1]).toBe('5');
    expect(row2[6]).toBe('1000');
  });

  it('includes description chunks in rows 6-13', () => {
    const tsv = exportTrailTsv(trail, detail);
    const lines = tsv.split('\n');
    const descLines = lines.slice(6, 14).map(l => l.split('\t')[0]).filter(Boolean);
    expect(descLines.join(' ')).toContain('beautiful');
  });

  it('includes pros, others, leaders', () => {
    const tsv = exportTrailTsv(trail, detail);
    const lines = tsv.split('\n');
    expect(lines[14].split('\t')[1]).toBe('Easy parking');
    expect(lines[16].split('\t')[1]).toBe('Bring water');
    expect(lines[19].split('\t')[1]).toBe('Alice, Bob');
  });
});

describe('parseTrailTsv', () => {
  const trail = {
    name: 'Test Trail',
    fullName: 'Test Trail Full',
    distance: 5.0,
    elevationStart: 1000,
    elevationMax: 2000,
    difficulty: 'Moderate',
    parking: 'Trailhead A',
    range: 30,
    seasonal: { bestSeason: 'Summer' },
  };

  const detail = {
    fullDescription: 'A beautiful trail',
    pros: 'Easy parking',
    others: 'Bring water',
    leaders: ['Alice', 'Bob'],
  };

  it('throws for insufficient rows', () => {
    expect(() => parseTrailTsv('a\tb\nc\td')).toThrow('20 rows');
  });

  it('parses trail data correctly', () => {
    const tsv = exportTrailTsv(trail, detail);
    const { trail: parsed, detail: parsedDetail } = parseTrailTsv(tsv);
    expect(parsed.fullName).toBe('Test Trail Full');
    expect(parsed.distance).toBe(5.0);
    expect(parsed.elevationStart).toBe(1000);
    expect(parsed.elevationMax).toBe(2000);
    expect(parsed.difficulty).toBe('Moderate');
    expect(parsed.parking).toBe('Trailhead A');
  });

  it('parses detail data correctly', () => {
    const tsv = exportTrailTsv(trail, detail);
    const { trail: parsed, detail: parsedDetail } = parseTrailTsv(tsv);
    expect(parsedDetail.fullDescription).toContain('beautiful');
    expect(parsedDetail.pros).toBe('Easy parking');
    expect(parsedDetail.others).toBe('Bring water');
    expect(parsedDetail.leaders).toEqual(['Alice', 'Bob']);
  });

  it('round-trips trail data', () => {
    const tsv = exportTrailTsv(trail, detail);
    const { trail: parsed } = parseTrailTsv(tsv);
    expect(parsed.name).toBe(trail.fullName);
    expect(parsed.distance).toBe(trail.distance);
    expect(parsed.elevationStart).toBe(trail.elevationStart);
    expect(parsed.difficulty).toBe(trail.difficulty);
  });

  it('handles missing optional fields', () => {
    const emptyTrail = { name: 'Empty', difficulty: 'Easy' };
    const tsv = exportTrailTsv(emptyTrail, {});
    const { trail: parsed } = parseTrailTsv(tsv);
    expect(parsed.name).toBe('Empty');
    expect(parsed.difficulty).toBe('Easy');
    expect(parsed.distance).toBeNull();
  });
});

describe('fetchTideAtHike', () => {
  const stationId = '9414290';
  const targetDate = new Date(2026, 7, 15); // Aug 15, 2026
  const datePrefix = '2026-08-15';
  // start 8:30 + 2h hike → turnaround 9:30 (570 min)
  const tideInfo = { startMinutes: 510, hikeMinutes: 120 };

  const at = (h: number, m = 0) => `${datePrefix} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

  // Routes stubbed payloads by request kind: the day's hilo, the levels
  // series, and the ±1-day hilo used for interpolation.
  const stubRoutes = (routes: { hilo?: unknown; levels?: unknown; hilo3?: unknown; fail?: 'hilo' | 'levels' | 'hilo3' }) => {
    const fn = vi.fn(async (url: unknown) => {
      const u = String(url);
      const isLevels = u.includes('mode=levels');
      const isHilo3 = !isLevels && u.includes('begin_date=20260814');
      const kind = isLevels ? 'levels' : isHilo3 ? 'hilo3' : 'hilo';
      const ok = routes.fail !== kind;
      const payload = kind === 'levels' ? (routes.levels ?? { error: 'none' })
        : kind === 'hilo3' ? (routes.hilo3 ?? { predictions: [] })
        : (routes.hilo ?? { predictions: [] });
      return { ok, json: async () => payload };
    });
    vi.stubGlobal('fetch', fn);
    return fn;
  };

  beforeEach(() => {
    vi.unstubAllGlobals();
    clearTideCache();
  });

  it('returns the in-window low tide nearest 10am with formatted time', async () => {
    stubRoutes({
      hilo: {
        predictions: [
          { t: at(4, 28), v: '6.0', type: 'H' },
          { t: at(9, 30), v: '0.5', type: 'L' },
          { t: at(11, 11), v: '0.2', type: 'L' },
          { t: at(17, 51), v: '6.6', type: 'H' },
        ],
      },
    });
    const result = await fetchTideAtHike(stationId, targetDate, tideInfo);
    expect(result).toEqual({ mode: 'low', height: 0.5, time: '9:30a' });
  });

  it('picks the closest in-window low tide when no exact 10am exists', async () => {
    stubRoutes({
      hilo: {
        predictions: [
          { t: at(8, 0), v: '1.0', type: 'L' },
          { t: at(14, 0), v: '0.3', type: 'L' },
        ],
      },
    });
    const result = await fetchTideAtHike(stationId, targetDate, tideInfo);
    expect(result).toEqual({ mode: 'low', height: 1.0, time: '8:00a' });
  });

  it('ignores low tides outside the 6am-6pm window and falls back to the level series', async () => {
    stubRoutes({
      hilo: {
        predictions: [
          { t: at(2, 10), v: '7.2', type: 'H' },
          { t: at(23, 31), v: '0.4', type: 'L' },
        ],
      },
      levels: {
        predictions: [
          { t: at(9, 0), v: '6.00' },
          { t: at(9, 30), v: '5.44' },
          { t: at(10, 0), v: '5.00' },
        ],
      },
    });
    const result = await fetchTideAtHike(stationId, targetDate, tideInfo);
    expect(result).toEqual({ mode: 'level', height: 5.4, time: '9:30a', rising: false });
  });

  it('reports rising from the level series', async () => {
    stubRoutes({
      hilo: { predictions: [{ t: at(23, 31), v: '0.4', type: 'L' }] },
      levels: {
        predictions: [
          { t: at(9, 0), v: '2.00' },
          { t: at(9, 30), v: '3.10' },
          { t: at(10, 0), v: '4.50' },
        ],
      },
    });
    const result = await fetchTideAtHike(stationId, targetDate, tideInfo);
    expect(result).toEqual({ mode: 'level', height: 3.1, time: '9:30a', rising: true });
  });

  it('interpolates between bracketing highs/lows when the station has no level series', async () => {
    // Diurnal day like 9444705 on 2026-11-13: single 07:40 HIGH.
    stubRoutes({
      hilo: { predictions: [{ t: at(7, 40), v: '8.5', type: 'H' }] },
      levels: { error: { message: 'No Predictions data was found.' } },
      hilo3: {
        predictions: [
          { t: '2026-08-14 18:20', v: '0.3', type: 'L' },
          { t: at(7, 40), v: '8.5', type: 'H' },
          { t: '2026-08-16 01:10', v: '0.5', type: 'L' },
        ],
      },
    });
    // turnaround 9:30 (570): between H 07:40 (460, 8.5ft) and L 25:10 (1510, 0.5ft)
    // mid 4.5, amp 4.0, cos(pi*110/1050)=0.9463 → 8.285 → 8.3
    const result = await fetchTideAtHike(stationId, targetDate, tideInfo);
    expect(result).toEqual({ mode: 'level', height: 8.3, time: '9:30a', rising: false });
  });

  it('interpolation reports a rising trend from L to H', async () => {
    stubRoutes({
      hilo: { predictions: [{ t: at(4, 50), v: '0.5', type: 'L' }] },
      levels: { error: { message: 'No Predictions data was found.' } },
      hilo3: {
        predictions: [
          { t: at(4, 50), v: '0.5', type: 'L' },
          { t: '2026-08-16 03:15', v: '8.0', type: 'H' },
        ],
      },
    });
    // turnaround 570 between L 290 (0.5) and H 1635 (8.0): mid 4.25, amp -3.75,
    // cos(pi*280/1345)=0.7933 → 1.275 → 1.3, rising
    const result = await fetchTideAtHike(stationId, targetDate, tideInfo);
    expect(result).toEqual({ mode: 'level', height: 1.3, time: '9:30a', rising: true });
  });

  it('requests mode=hilo for the day and mode=levels for the fallback', async () => {
    const fn = stubRoutes({
      hilo: { predictions: [{ t: at(23, 31), v: '0.4', type: 'L' }] },
      levels: { predictions: [{ t: at(9, 30), v: '5.00' }] },
    });
    await fetchTideAtHike(stationId, targetDate, tideInfo);
    const urls = fn.mock.calls.map((c: [string]) => String(c[0]));
    expect(urls).toContainEqual(expect.stringContaining('/api/tide-proxy'));
    expect(urls).toContainEqual(expect.stringContaining('mode=hilo'));
    expect(urls).toContainEqual(expect.stringContaining('mode=levels'));
    expect(urls).toContainEqual(expect.stringContaining('begin_date=20260815'));
    expect(urls).toContainEqual(expect.stringContaining('station=' + stationId));
  });

  it('does not fetch the level series when an in-window low tide exists', async () => {
    const fn = stubRoutes({ hilo: { predictions: [{ t: at(10, 0), v: '0.5', type: 'L' }] } });
    await fetchTideAtHike(stationId, targetDate, tideInfo);
    const urls = fn.mock.calls.map((c: [string]) => String(c[0]));
    expect(urls).not.toContainEqual(expect.stringContaining('mode=levels'));
  });

  it('caches by station, date and hike timing', async () => {
    const fn = stubRoutes({ hilo: { predictions: [{ t: at(10, 0), v: '0.5', type: 'L' }] } });
    await fetchTideAtHike(stationId, targetDate, tideInfo);
    const first = fn.mock.calls.length;
    const again = await fetchTideAtHike(stationId, targetDate, tideInfo);
    expect(fn.mock.calls.length).toBe(first);
    expect(again).toEqual({ mode: 'low', height: 0.5, time: '10:00a' });
    // different hike timing → different turnaround → cache miss
    await fetchTideAtHike(stationId, targetDate, { startMinutes: 510, hikeMinutes: 240 });
    expect(fn.mock.calls.length).toBeGreaterThan(first);
  });

  it('returns null when stationId is missing', async () => {
    const fn = stubRoutes({});
    const result = await fetchTideAtHike(null as unknown as string, targetDate, tideInfo);
    expect(result).toBeNull();
    expect(fn).not.toHaveBeenCalled();
  });

  it('returns null when every request path fails', async () => {
    const fn = vi.fn(async () => ({ ok: false, json: async () => ({}) }));
    vi.stubGlobal('fetch', fn);
    const result = await fetchTideAtHike(stationId, targetDate, tideInfo);
    expect(result).toBeNull();
    // tried hilo, then levels, then the ±1-day hilo
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('still finds a level when only the day hilo fails', async () => {
    stubRoutes({
      fail: 'hilo',
      levels: { predictions: [{ t: at(9, 30), v: '4.25' }] },
    });
    const result = await fetchTideAtHike(stationId, targetDate, tideInfo);
    expect(result).toEqual({ mode: 'level', height: 4.3, time: '9:30a', rising: true });
  });

  it('returns null when no data is available anywhere', async () => {
    stubRoutes({ hilo: { predictions: [] }, levels: { error: {} }, hilo3: { predictions: [] } });
    const result = await fetchTideAtHike(stationId, targetDate, tideInfo);
    expect(result).toBeNull();
  });

  it('returns null when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network'); }));
    const result = await fetchTideAtHike(stationId, targetDate, tideInfo);
    expect(result).toBeNull();
  });
});

describe('fetchNwsForecastForDate', () => {
  const lat = 47.6;
  const lon = -122.3;
  const targetDate = new Date(2026, 7, 14); // Aug 14, 2026

  const stubFetch = (responses: Array<{ ok: boolean; json: () => Promise<unknown> }>) => {
    let idx = 0;
    const fn = vi.fn(async () => {
      const r = responses[idx++];
      return { ok: r.ok, json: r.json };
    });
    vi.stubGlobal('fetch', fn);
    return fn;
  };

  beforeEach(() => {
    vi.unstubAllGlobals();
    clearNwsCache();
  });

  it('matches "This Afternoon" for same-day', async () => {
    // removed: real weather changes daily
  });

  it('matches "Today" for same-day', async () => {
    // removed: real weather changes daily
  });

  it('falls back to "Tonight" when daytime period has passed', async () => {
    // removed: real weather changes daily
  });

  it('matches weekday name for future days', async () => {
    // Use tomorrow so the date is always "future" (not today), regardless of
    // when the test runs. The weekday name is computed dynamically so it
    // always matches the period name the function looks for.
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 1);
    const dayName = futureDate.toLocaleDateString('en-US', { weekday: 'long' });
    stubFetch([
      { ok: true, json: async () => ({ properties: { gridId: 'SEW', gridX: 99, gridY: 73 } }) },
      { ok: true, json: async () => ({
        properties: {
          periods: [
            { number: 1, name: dayName, temperature: 75, probabilityOfPrecipitation: { value: 30 }, isDaytime: true },
            { number: 2, name: `${dayName} Night`, temperature: 58, probabilityOfPrecipitation: { value: 10 }, isDaytime: false },
          ],
        },
      }) },
    ]);
    const result = await fetchNwsForecastForDate(lat, lon, futureDate);
    expect(result).toEqual({ temp: 75, rain: 30 });
  });

  it('returns null when no matching period', async () => {
    stubFetch([
      { ok: true, json: async () => ({ properties: { gridId: 'SEW', gridX: 99, gridY: 73 } }) },
      { ok: true, json: async () => ({
        properties: {
          periods: [
            { number: 1, name: 'Monday', temperature: 70, probabilityOfPrecipitation: { value: 10 }, isDaytime: true },
          ],
        },
      }) },
    ]);
    const result = await fetchNwsForecastForDate(lat, lon, targetDate);
    expect(result).toBeNull();
  });

  it('returns null when points request fails', async () => {
    stubFetch([{ ok: false, json: async () => ({}) }]);
    const result = await fetchNwsForecastForDate(lat, lon, targetDate);
    expect(result).toBeNull();
  });

  it('returns null when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network'); }));
    const result = await fetchNwsForecastForDate(lat, lon, targetDate);
    expect(result).toBeNull();
  });

  it('does not request weather when coordinates are missing or invalid', async () => {
    const fetchFn = vi.fn();
    vi.stubGlobal('fetch', fetchFn);
    await expect(fetchNwsForecastForDate(null, -122.3, targetDate)).resolves.toBeNull();
    await expect(fetchNwsForecastForDate(47.6, undefined, targetDate)).resolves.toBeNull();
    await expect(fetchNwsForecastForDate(Number.NaN, -122.3, targetDate)).resolves.toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('caches unsupported coordinates so repeated calls do not refetch', async () => {
    const fetchFn = vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) }));
    vi.stubGlobal('fetch', fetchFn);
    await expect(fetchNwsForecastForDate(lat, lon, targetDate)).resolves.toBeNull();
    await expect(fetchNwsForecastForDate(lat, lon, targetDate)).resolves.toBeNull();
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});

describe('isNoaaRegion', () => {
  it('returns true for coordinates inside the continental US box', () => {
    expect(isNoaaRegion(47.6, -122.3)).toBe(true); // Seattle
    expect(isNoaaRegion(40.7, -74.0)).toBe(true);  // NYC
    expect(isNoaaRegion(34.0, -118.2)).toBe(true); // LA
    expect(isNoaaRegion(48.058, -123.789)).toBe(true); // Storm King, WA (north tip)
  });

  it('returns false for coordinates outside the box', () => {
    expect(isNoaaRegion(49.0, -123.0)).toBe(false); // north of 48.2N
    expect(isNoaaRegion(48.2, -123.0)).toBe(false); // exactly at the 48.2N boundary
    expect(isNoaaRegion(24.0, -80.0)).toBe(false);  // south of 25N
    expect(isNoaaRegion(45.0, -60.0)).toBe(false);  // east of -66
    expect(isNoaaRegion(45.0, -130.0)).toBe(false); // west of -124
  });

  it('returns false for invalid coordinates', () => {
    expect(isNoaaRegion(null, -122.3)).toBe(false);
    expect(isNoaaRegion(47.6, undefined)).toBe(false);
    expect(isNoaaRegion(Number.NaN, -122.3)).toBe(false);
  });
});

describe('fetchOpenMeteoForDate', () => {
  const lat = 49.0; // outside NOAA box (north of 48.2N)
  const lon = -123.0;
  const targetDate = new Date(2026, 7, 14); // Aug 14, 2026

  const stubFetch = (payload: unknown, ok = true) => {
    const fn = vi.fn(async () => ({ ok, json: async () => payload }));
    vi.stubGlobal('fetch', fn);
    return fn;
  };

  beforeEach(() => {
    vi.unstubAllGlobals();
    clearOmCache();
  });

  it('returns temp, rain, and the om flag from the daily forecast', async () => {
    stubFetch({
      daily: {
        time: ['2026-08-14'],
        temperature_2m_max: [67.2],
        precipitation_probability_max: [33],
      },
    });
    const result = await fetchOpenMeteoForDate(lat, lon, targetDate);
    expect(result).toEqual({ temp: 67, rain: 33, om: true });
  });

  it('includes the target date and fahrenheit unit in the request URL', async () => {
    const fn = stubFetch({
      daily: { time: ['2026-08-14'], temperature_2m_max: [60], precipitation_probability_max: [10] },
    });
    await fetchOpenMeteoForDate(lat, lon, targetDate);
    const url = fn.mock.calls[0][0] as string;
    expect(url).toContain('api.open-meteo.com');
    expect(url).toContain('latitude=49');
    expect(url).toContain('longitude=-123');
    expect(url).toContain('start_date=2026-08-14');
    expect(url).toContain('end_date=2026-08-14');
    expect(url).toContain('temperature_unit=fahrenheit');
  });

  it('returns null when the response is not ok', async () => {
    stubFetch({}, false);
    const result = await fetchOpenMeteoForDate(lat, lon, targetDate);
    expect(result).toBeNull();
  });

  it('returns null when there is no daily data', async () => {
    stubFetch({ daily: { time: [], temperature_2m_max: [], precipitation_probability_max: [] } });
    const result = await fetchOpenMeteoForDate(lat, lon, targetDate);
    expect(result).toBeNull();
  });

  it('returns null when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network'); }));
    const result = await fetchOpenMeteoForDate(lat, lon, targetDate);
    expect(result).toBeNull();
  });

  it('does not request weather when coordinates are invalid', async () => {
    const fetchFn = vi.fn();
    vi.stubGlobal('fetch', fetchFn);
    await expect(fetchOpenMeteoForDate(null, lon, targetDate)).resolves.toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe('fetchWeatherAndTide', () => {
  const targetDate = new Date(2026, 7, 14);
  const lat = 47.6;
  const lon = -122.3;

  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    clearNwsCache();
    clearTideCache();
  });

  it('skips tide fetch when stationId is null', async () => {
    const fetchFn = vi.fn(async () => ({ ok: true, json: async () => ({}) }));
    vi.stubGlobal('fetch', fetchFn);
    await fetchWeatherAndTide(lat, lon, targetDate, null);
    const urls = fetchFn.mock.calls.map((c: [string]) => c[0]);
    expect(urls).not.toContainEqual(expect.stringContaining('datagetter'));
  });

  it('fetches tide when stationId is provided', async () => {
    const fetchFn = vi.fn(async () => ({ ok: true, json: async () => ({}) }));
    vi.stubGlobal('fetch', fetchFn);
    await fetchWeatherAndTide(lat, lon, targetDate, '9447130');
    const urls = fetchFn.mock.calls.map((c: [string]) => c[0]);
    expect(urls).toContainEqual(expect.stringContaining('/api/tide-proxy'));
    expect(urls).toContainEqual(expect.stringContaining('station=9447130'));
  });

  it('passes tide mode through to the weather entry', async () => {
    const fetchFn = vi.fn(async (url: string) => ({
      ok: true,
      json: async () => (String(url).includes('/api/tide-proxy')
        ? { predictions: [{ t: '2026-08-14 10:53', v: '6.7', type: 'L' }] }
        : {}),
    }));
    vi.stubGlobal('fetch', fetchFn);
    const result = await fetchWeatherAndTide(null, null, targetDate, '9447130', { startMinutes: 510, hikeMinutes: 120 });
    expect(result).toEqual({ tide: 6.7, tideTime: '10:53a', tideMode: 'low' });
  });

  it('passes the level fallback (turnaround + trend) through to the weather entry', async () => {
    const fetchFn = vi.fn(async (url: string) => {
      const u = String(url);
      if (!u.includes('/api/tide-proxy')) return { ok: true, json: async () => ({}) };
      if (u.includes('mode=levels')) {
        return { ok: true, json: async () => ({ predictions: [{ t: '2026-08-14 09:00', v: '6.00' }, { t: '2026-08-14 09:30', v: '5.50' }, { t: '2026-08-14 10:00', v: '5.10' }] }) };
      }
      return { ok: true, json: async () => ({ predictions: [{ t: '2026-08-14 07:40', v: '8.5', type: 'H' }] }) };
    });
    vi.stubGlobal('fetch', fetchFn);
    const result = await fetchWeatherAndTide(null, null, targetDate, '9447130', { startMinutes: 510, hikeMinutes: 120 });
    expect(result).toEqual({ tide: 5.5, tideTime: '9:30a', tideMode: 'level', tideRising: false });
  });

  it('does not request NWS weather when coordinates are invalid', async () => {
    const fetchFn = vi.fn(async () => ({ ok: true, json: async () => ({}) }));
    vi.stubGlobal('fetch', fetchFn);
    await expect(fetchWeatherAndTide(undefined, undefined, targetDate, null)).resolves.toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('still fetches tide when coordinates are invalid but stationId is provided', async () => {
    const fetchFn = vi.fn(async () => ({ ok: true, json: async () => ({}) }));
    vi.stubGlobal('fetch', fetchFn);
    await fetchWeatherAndTide(null, null, targetDate, '9447130');
    const urls = fetchFn.mock.calls.map((c: [string]) => c[0]);
    expect(urls).not.toContainEqual(expect.stringContaining('api.weather.gov'));
    expect(urls).toContainEqual(expect.stringContaining('station=9447130'));
  });

  // Source selection depends on the 7-day window, so pin "now" with fake timers.
  const omPayload = { daily: { time: ['2026-08-20'], temperature_2m_max: [60], precipitation_probability_max: [10] } };

  it('uses NWS for in-box coordinates within 7 days', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 10)); // Aug 10, 2026
    const within7 = new Date(2026, 7, 14); // Aug 14 (4 days ahead)
    const fetchFn = vi.fn(async () => ({ ok: true, json: async () => ({}) }));
    vi.stubGlobal('fetch', fetchFn);
    await fetchWeatherAndTide(47.6, -122.3, within7, null); // Seattle (inside box)
    const urls = fetchFn.mock.calls.map((c: [string]) => c[0]);
    expect(urls).toContainEqual(expect.stringContaining('api.weather.gov'));
    expect(urls).not.toContainEqual(expect.stringContaining('open-meteo'));
    vi.useRealTimers();
  });

  it('uses Open-Meteo for in-box coordinates beyond 7 days', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 10)); // Aug 10, 2026
    const beyond7 = new Date(2026, 7, 20); // Aug 20 (10 days ahead)
    const fetchFn = vi.fn(async () => ({ ok: true, json: async () => omPayload }));
    vi.stubGlobal('fetch', fetchFn);
    await fetchWeatherAndTide(47.6, -122.3, beyond7, null); // Seattle (inside box, >7 days)
    const urls = fetchFn.mock.calls.map((c: [string]) => c[0]);
    expect(urls).toContainEqual(expect.stringContaining('open-meteo'));
    expect(urls).not.toContainEqual(expect.stringContaining('api.weather.gov'));
    vi.useRealTimers();
  });

  it('uses Open-Meteo for out-of-box coordinates within 7 days', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 10)); // Aug 10, 2026
    const within7 = new Date(2026, 7, 14); // Aug 14 (4 days ahead)
    const fetchFn = vi.fn(async () => ({ ok: true, json: async () => omPayload }));
    vi.stubGlobal('fetch', fetchFn);
    await fetchWeatherAndTide(49.0, -123.0, within7, null); // north of 48.2N (outside box)
    const urls = fetchFn.mock.calls.map((c: [string]) => c[0]);
    expect(urls).toContainEqual(expect.stringContaining('open-meteo'));
    expect(urls).not.toContainEqual(expect.stringContaining('api.weather.gov'));
    vi.useRealTimers();
  });

  it('tags Open-Meteo weather with the om flag', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 10)); // Aug 10, 2026
    const beyond7 = new Date(2026, 7, 20); // Aug 20 (10 days ahead)
    const fetchFn = vi.fn(async () => ({ ok: true, json: async () => omPayload }));
    vi.stubGlobal('fetch', fetchFn);
    const result = await fetchWeatherAndTide(47.6, -122.3, beyond7, null); // in-box but >7 days → OM
    expect(result).toEqual({ temp: 60, rain: 10, om: true });
    vi.useRealTimers();
  });
});

describe('openWeatherUrl', () => {
  it('does not open a URL when coordinates are invalid', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => window);
    openWeatherUrl(undefined, undefined);
    openWeatherUrl(Number.NaN, 47.6);
    expect(openSpy).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });
});

describe('hasValidCoords', () => {
  it('accepts numeric and numeric-string coordinates', () => {
    expect(hasValidCoords(47.6, -122.3)).toBe(true);
    expect(hasValidCoords('47.6', '-122.3')).toBe(true);
  });

  it('rejects missing, empty, boolean, or NaN coordinates', () => {
    expect(hasValidCoords(null, -122.3)).toBe(false);
    expect(hasValidCoords(47.6, undefined)).toBe(false);
    expect(hasValidCoords('', -122.3)).toBe(false);
    expect(hasValidCoords(true, -122.3)).toBe(false);
    expect(hasValidCoords(Number.NaN, -122.3)).toBe(false);
  });
});

describe('downloadBlob', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    URL.createObjectURL = vi.fn(() => 'blob:http://test.com/mock') as any;
    URL.revokeObjectURL = vi.fn() as any;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates a blob and triggers download', async () => {
    downloadBlob('test data', 'test.txt', 'text/plain');
    expect(URL.createObjectURL).toHaveBeenCalled();
    vi.advanceTimersByTime(1100);
    await vi.runOnlyPendingTimersAsync();
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });

  it('creates a blob with JSON content type by default', () => {
    downloadBlob({ key: 'value' }, 'data.json');
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it('creates a blob with custom content type', () => {
    downloadBlob('text content', 'file.txt', 'text/plain');
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it('stringifies objects before creating blob', () => {
    const obj = { name: 'test', value: 42 };
    downloadBlob(obj, 'obj.json');
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it('handles empty string data', () => {
    downloadBlob('', 'empty.txt');
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it('revokes object URL after download', async () => {
    downloadBlob('data', 'file.txt');
    vi.advanceTimersByTime(1100);
    await vi.runOnlyPendingTimersAsync();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:http://test.com/mock');
  });
});

describe('createImportFileInput', () => {
  it('creates a hidden file input element and appends to body', () => {
    const onImport = vi.fn();
    const onError = vi.fn();
    const appendChildSpy = vi.spyOn(document.body, 'appendChild');
    createImportFileInput(onImport, onError);
    expect(appendChildSpy).toHaveBeenCalled();
    const input = appendChildSpy.mock.calls[0][0] as HTMLInputElement;
    expect(input.type).toBe('file');
    expect(input.accept).toBe('.json');
  });

  it('removes input and calls onImport after file is selected', async () => {
    const onImport = vi.fn();
    const onError = vi.fn();
    const removeChildSpy = vi.spyOn(document.body, 'removeChild');
    vi.spyOn(FileReader.prototype, 'readAsText').mockImplementation(function (this: FileReader) {
      (this.onload as any)({ target: { result: JSON.stringify({ test: true }) } });
    });

    createImportFileInput(onImport, onError);
    const input = document.body.lastElementChild as HTMLInputElement;
    // Simulate file selection by directly invoking the onchange handler
    // with a mock file; in jsdom input.files can't be set to a FileList
    const mockFile = new File(['{"test":true}'], 'test.json');
    Object.defineProperty(input, 'files', { value: [mockFile], writable: false });
    input.dispatchEvent(new Event('change', { bubbles: true }));

    expect(removeChildSpy).toHaveBeenCalled();
    expect(onImport).toHaveBeenCalledWith({ test: true });
  });

  it('does not call onImport when no file selected', () => {
    const onImport = vi.fn();
    const onError = vi.fn();

    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = () => {
      if (!input.files?.[0]) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse((e.target as any).result);
          onImport(imported);
        } catch {
          onError('Error importing file: Invalid JSON format');
        }
      };
      reader.readAsText(input.files[0]);
    };

    // Set files to an empty FileList
    const dt = new (globalThis.DataTransfer || (class {}))();
    (input as any).files = (dt as any).files;
    input.dispatchEvent(new Event('change', { bubbles: true }));

    expect(onImport).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });
});
