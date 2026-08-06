import { describe, it, expect } from 'vitest';
import { buildTrailLineParts } from '../../utils/formatTrail';

describe('buildTrailLineParts', () => {
  it('formats a basic trail', () => {
    const trail = {
      id: 'trail-1',
      name: 'Rainier',
      fullName: 'Mount Rainier',
      distance: 5.5,
      distanceExtended: 6.0,
      elevationStart: 2000,
      elevationMax: 4000,
      difficulty: 'Moderate',
      parking: 'Lot',
      range: 45,
    };
    const result = buildTrailLineParts(trail);
    expect(result.name).toBe('Mount Rainier');
    expect(result.difficulty).toBe('[Moderate]');
    expect(result.distanceText).toBe('5.5-6.0');
    expect(result.elevationText).toBe('2,000\'-4,000\'');
    expect(result.parking).toBe('Lot');
    expect(result.rideCost).toBe('ride-$5');
  });

  it('returns structured parts', () => {
    const trail = {
      id: 'test',
      name: 'Test Trail',
      fullName: 'Test Trail Full',
      difficulty: 'Moderate',
      distance: 5.5,
      elevationStart: 1000,
      elevationMax: 2500,
      parking: 'Free',
      range: 45,
    };
    const parts = buildTrailLineParts(trail);
    expect(parts).toHaveProperty('name');
    expect(parts).toHaveProperty('difficulty');
    expect(parts).toHaveProperty('distanceText');
    expect(parts).toHaveProperty('elevationText');
    expect(parts).toHaveProperty('parking');
    expect(parts).toHaveProperty('rideCost');
  });

  it('strips ◆ marker from trail name', () => {
    const trail = {
      id: 'trail-2',
      name: 'Wilderness',
      fullName: '◆ Wilderness Peak',
      distance: 8.0,
      elevationStart: 4200,
      elevationMax: 5000,
      difficulty: 'Difficult',
      parking: 'Free',
    };
    const result = buildTrailLineParts(trail);
    expect(result.name).toBe('Wilderness Peak');
  });

  it('falls back to name when no fullName', () => {
    const trail = {
      id: 'test',
      name: 'Test Trail',
      fullName: '',
      difficulty: 'Moderate',
      distance: 5.5,
      elevationStart: 1000,
    };
    const parts = buildTrailLineParts(trail);
    expect(parts.name).toBe('Test Trail');
  });

  it('handles missing optional fields', () => {
    const trail = {
      id: 'trail-3',
      name: 'Simple',
      fullName: 'Simple Trail',
      distance: 3.0,
      elevationStart: 1000,
      difficulty: 'Easy',
      parking: '',
    };
    const result = buildTrailLineParts(trail);
    expect(result.name).toBe('Simple Trail');
    expect(result.difficulty).toBe('[Easy]');
  });

  it('handles null distance', () => {
    const trail = {
      id: 'trail-4',
      name: 'No Distance',
      fullName: 'No Distance Trail',
      distance: null,
      elevationStart: 1000,
      difficulty: 'Easy',
    };
    const result = buildTrailLineParts(trail);
    expect(result.distanceText).toBe('N/A');
  });

  it('shows N/A for missing distance', () => {
    const trail = {
      id: 'test',
      name: 'Test',
      fullName: 'Test',
      distance: null,
      elevationStart: 1000,
    };
    const parts = buildTrailLineParts(trail);
    expect(parts.distanceText).toBe('N/A');
  });

  it('includes extended distance', () => {
    const trail = {
      id: 'test',
      name: 'Test',
      distance: 5.5,
      distanceExtended: 7.0,
      elevationStart: 1000,
    };
    const parts = buildTrailLineParts(trail);
    expect(parts.distanceText).toBe('5.5-7.0');
  });

  it('handles missing elevationMax', () => {
    const trail = {
      id: 'trail-5',
      name: 'Flat',
      fullName: 'Flat Trail',
      distance: 2.0,
      elevationStart: 500,
      difficulty: 'Easy',
    };
    const result = buildTrailLineParts(trail);
    expect(result.elevationText).toBe('500\'-500\'');
  });

  it('uses elevationStart as max when no elevationMax', () => {
    const trail = {
      id: 'test',
      name: 'Test',
      distance: 5.5,
      elevationStart: 1000,
      elevationMax: null,
    };
    const parts = buildTrailLineParts(trail);
    expect(parts.elevationText).toBe("1,000'-1,000'");
  });

  it('defaults to 0 for missing elevationStart', () => {
    const trail = {
      id: 'test',
      name: 'Test',
      distance: 5.5,
      elevationStart: null,
      elevationMax: null,
    };
    const parts = buildTrailLineParts(trail);
    expect(parts.elevationText).toBe("0'-0'");
  });

  it('uses name when fullName is missing', () => {
    const trail = {
      id: 'trail-6',
      name: 'No FullName',
      distance: 1.0,
      elevationStart: 100,
      difficulty: 'Easy',
    };
    const result = buildTrailLineParts(trail);
    expect(result.name).toBe('No FullName');
  });

  it('handles large elevation numbers with locale', () => {
    const trail = {
      id: 'trail-7',
      name: 'Big',
      fullName: 'Big Mountain',
      distance: 10.0,
      elevationStart: 12345,
      elevationMax: 23456,
      difficulty: 'Difficult',
    };
    const result = buildTrailLineParts(trail);
    expect(result.elevationText).toContain('12,345\'');
    expect(result.elevationText).toContain('23,456\'');
  });

  it('formats elevation with commas', () => {
    const trail = {
      id: 'test',
      name: 'Test',
      distance: 5.5,
      elevationStart: 1000,
      elevationMax: 2500,
    };
    const parts = buildTrailLineParts(trail);
    expect(parts.elevationText).toBe("1,000'-2,500'");
  });

  it('returns empty parking when not set', () => {
    const trail = {
      id: 'test',
      name: 'Test',
      distance: 5.5,
      elevationStart: 1000,
      parking: null,
    };
    const parts = buildTrailLineParts(trail);
    expect(parts.parking).toBe('');
  });

  it('returns ride cost from range', () => {
    const trail = {
      id: 'test',
      name: 'Test',
      distance: 5.5,
      elevationStart: 1000,
      range: 45,
    };
    const parts = buildTrailLineParts(trail);
    expect(parts.rideCost).toBe('ride-$5');
  });

  it('returns empty ride cost when no range', () => {
    const trail = {
      id: 'test',
      name: 'Test',
      distance: 5.5,
      elevationStart: 1000,
      range: null,
    };
    const parts = buildTrailLineParts(trail);
    expect(parts.rideCost).toBe('');
  });
});
