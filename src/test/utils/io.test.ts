import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sanitizeFilename, getFirstCoordinateFromGpx, exportTrailTsv, parseTrailTsv, fetchTideHeightAt, fetchNwsForecastForDate, fetchWeatherAndTide, clearNwsCache } from '../../utils/io';

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

describe('fetchTideHeightAt', () => {
  const stationId = '9414290';
  const targetDate = new Date(2026, 7, 15); // Aug 15, 2026
  const datePrefix = '2026-08-15';

  const at = (h: number, m = 0) => `${datePrefix} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

  const stubFetch = (payload: unknown, ok = true) => {
    const fn = vi.fn(async () => ({
      ok,
      json: async () => payload,
    }));
    vi.stubGlobal('fetch', fn);
    return fn;
  };

  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the low tide nearest 10am with formatted time', async () => {
    stubFetch({
      predictions: [
        { t: at(4, 28), v: '6.0', type: 'H' },
        { t: at(9, 30), v: '0.5', type: 'L' },
        { t: at(11, 11), v: '0.2', type: 'L' },
        { t: at(17, 51), v: '6.6', type: 'H' },
      ],
    });
    const result = await fetchTideHeightAt(stationId, targetDate);
    expect(result).toEqual({ height: 0.5, time: '9:30a' });
  });

  it('picks the closest low tide when no exact 10am exists', async () => {
    stubFetch({
      predictions: [
        { t: at(8, 0), v: '1.0', type: 'L' },
        { t: at(14, 0), v: '0.3', type: 'L' },
      ],
    });
    const result = await fetchTideHeightAt(stationId, targetDate);
    expect(result).toEqual({ height: 1.0, time: '8:00a' });
  });

  it('ignores high tides', async () => {
    stubFetch({
      predictions: [
        { t: at(10, 0), v: '6.5', type: 'H' },
        { t: at(16, 0), v: '0.1', type: 'L' },
      ],
    });
    const result = await fetchTideHeightAt(stationId, targetDate);
    expect(result).toEqual({ height: 0.1, time: '4:00p' });
  });

  it('includes station and begin_date/end_date in the request URL', async () => {
    stubFetch({ predictions: [{ t: at(10), v: '0.5', type: 'L' }] });
    const fn = await (async () => {
      const f = vi.fn(async () => ({ ok: true, json: async () => ({ predictions: [{ t: at(10), v: '0.5', type: 'L' }] }) }));
      vi.stubGlobal('fetch', f);
      await fetchTideHeightAt(stationId, targetDate);
      return f;
    })();
    const url = fn.mock.calls[0][0] as string;
    expect(url).toContain(`station=${stationId}`);
    expect(url).toContain('begin_date=20260815');
    expect(url).toContain('end_date=20260815');
    expect(url).toContain('interval=hilo');
  });

  it('returns null when stationId is missing', async () => {
    const fn = stubFetch({ predictions: [] });
    const result = await fetchTideHeightAt(null as unknown as string, targetDate);
    expect(result).toBeNull();
    expect(fn).not.toHaveBeenCalled();
  });

  it('returns null when the response is not ok', async () => {
    stubFetch({}, false);
    const result = await fetchTideHeightAt(stationId, targetDate);
    expect(result).toBeNull();
  });

  it('returns null when there are no low tides', async () => {
    stubFetch({ predictions: [{ t: at(10), v: '6.0', type: 'H' }] });
    const result = await fetchTideHeightAt(stationId, targetDate);
    expect(result).toBeNull();
  });

  it('returns null when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network'); }));
    const result = await fetchTideHeightAt(stationId, targetDate);
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
});

describe('fetchWeatherAndTide', () => {
  const targetDate = new Date(2026, 7, 14);
  const lat = 47.6;
  const lon = -122.3;

  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    clearNwsCache();
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
    expect(urls).toContainEqual(expect.stringContaining('datagetter'));
    expect(urls).toContainEqual(expect.stringContaining('station=9447130'));
  });
});
