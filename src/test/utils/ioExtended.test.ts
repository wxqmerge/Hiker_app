import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sanitizeFilename, getFirstCoordinateFromGpx, exportTrailTsv, parseTrailTsv } from '../../utils/io';

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
