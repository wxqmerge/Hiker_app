import { describe, it, expect } from 'vitest';
import { buildTrailLineParts } from '../../utils/formatTrail';

describe('buildTrailLineParts', () => {
  const baseTrail = {
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

  it('returns structured parts', () => {
    const parts = buildTrailLineParts(baseTrail);
    expect(parts).toHaveProperty('name');
    expect(parts).toHaveProperty('difficulty');
    expect(parts).toHaveProperty('distanceText');
    expect(parts).toHaveProperty('elevationText');
    expect(parts).toHaveProperty('parking');
    expect(parts).toHaveProperty('rideCost');
  });

  it('uses fullName when available', () => {
    const parts = buildTrailLineParts(baseTrail);
    expect(parts.name).toBe('Test Trail Full');
  });

  it('falls back to name when no fullName', () => {
    const trail = { ...baseTrail, fullName: '' };
    const parts = buildTrailLineParts(trail);
    expect(parts.name).toBe('Test Trail');
  });

  it('removes diamond symbols from name', () => {
    const trail = { ...baseTrail, fullName: '◆ Test Trail ◆' };
    const parts = buildTrailLineParts(trail);
    expect(parts.name).not.toContain('◆');
  });

  it('formats difficulty with brackets', () => {
    const parts = buildTrailLineParts(baseTrail);
    expect(parts.difficulty).toBe('[Moderate]');
  });

  it('formats distance with one decimal', () => {
    const parts = buildTrailLineParts(baseTrail);
    expect(parts.distanceText).toBe('5.5');
  });

  it('shows N/A for missing distance', () => {
    const trail = { ...baseTrail, distance: null };
    const parts = buildTrailLineParts(trail);
    expect(parts.distanceText).toBe('N/A');
  });

  it('includes extended distance', () => {
    const trail = { ...baseTrail, distanceExtended: 7.0 };
    const parts = buildTrailLineParts(trail);
    expect(parts.distanceText).toBe('5.5-7.0');
  });

  it('formats elevation with commas', () => {
    const parts = buildTrailLineParts(baseTrail);
    expect(parts.elevationText).toBe("1,000'-2,500'");
  });

  it('uses elevationStart as max when no elevationMax', () => {
    const trail = { ...baseTrail, elevationMax: null };
    const parts = buildTrailLineParts(trail);
    expect(parts.elevationText).toBe("1,000'-1,000'");
  });

  it('defaults to 0 for missing elevationStart', () => {
    const trail = { ...baseTrail, elevationStart: null, elevationMax: null };
    const parts = buildTrailLineParts(trail);
    expect(parts.elevationText).toBe("0'-0'");
  });

  it('returns empty parking when not set', () => {
    const trail = { ...baseTrail, parking: null };
    const parts = buildTrailLineParts(trail);
    expect(parts.parking).toBe('');
  });

  it('returns ride cost from range', () => {
    const parts = buildTrailLineParts(baseTrail);
    expect(parts.rideCost).toBe('ride-$5');
  });

  it('returns empty ride cost when no range', () => {
    const trail = { ...baseTrail, range: null };
    const parts = buildTrailLineParts(trail);
    expect(parts.rideCost).toBe('');
  });
});
