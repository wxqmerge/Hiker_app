import { describe, it, expect } from 'vitest';
import { filterTrails, sortTrails } from '../../utils/filterTrails';
import { DEFAULT_FILTERS } from '../../utils/constants';

const mockTrails = [
  { id: 'trail-1', name: 'Trail One', fullName: 'Trail One', difficulty: 'Easy', distance: 3.0, elevationStart: 1000, seasonal: { Jan: 3 } },
  { id: 'trail-2', name: 'Trail Two', fullName: 'Trail Two', difficulty: 'Hard', distance: 8.0, elevationStart: 3000, seasonal: { Jun: 2 } },
  { id: 'trail-3', name: 'Trail Three', fullName: 'Trail Three', difficulty: 'Moderate', distance: 5.0, elevationStart: 2000, seasonal: { Mar: 1 } },
];

describe('filterTrails', () => {
  it('returns all trails with default filters', () => {
    const filtered = filterTrails(mockTrails, DEFAULT_FILTERS, {});
    expect(filtered).toHaveLength(3);
  });

  it('filters by search text', () => {
    const filtered = filterTrails(mockTrails, { ...DEFAULT_FILTERS, search: 'One' }, {});
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('trail-1');
  });

  it('filters by search text case insensitive', () => {
    const filtered = filterTrails(mockTrails, { ...DEFAULT_FILTERS, search: 'two' }, {});
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('trail-2');
  });

  it('filters by distance range', () => {
    const filtered = filterTrails(mockTrails, { ...DEFAULT_FILTERS, distance: { min: 4, max: 6 } }, {});
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('trail-3');
  });

  it('filters by elevation range', () => {
    const filtered = filterTrails(mockTrails, { ...DEFAULT_FILTERS, elevation: { min: 1500, max: 2500 } }, {});
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('trail-3');
  });

  it('filters by difficulties', () => {
    const filtered = filterTrails(mockTrails, { ...DEFAULT_FILTERS, difficulties: ['Easy'] }, {});
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('trail-1');
  });

  it('filters by multiple difficulties', () => {
    const filtered = filterTrails(mockTrails, { ...DEFAULT_FILTERS, difficulties: ['Easy', 'Moderate'] }, {});
    expect(filtered).toHaveLength(2);
  });

  it('filters by months', () => {
    const filtered = filterTrails(mockTrails, { ...DEFAULT_FILTERS, months: [0] }, {});
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('trail-1');
  });

  it('filters by multiple months', () => {
    const filtered = filterTrails(mockTrails, { ...DEFAULT_FILTERS, months: [0, 2] }, {});
    expect(filtered).toHaveLength(2);
  });

  it('filters by GPX only', () => {
    const trailsWithGpx = mockTrails.map(t => ({ ...t, hasGpx: t.id === 'trail-1' }));
    const filtered = filterTrails(trailsWithGpx, { ...DEFAULT_FILTERS, gpx: 'gpx' }, {});
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('trail-1');
  });

  it('filters by no GPX', () => {
    const trailsWithGpx = mockTrails.map(t => ({ ...t, hasGpx: t.id === 'trail-1' }));
    const filtered = filterTrails(trailsWithGpx, { ...DEFAULT_FILTERS, gpx: 'noGpx' }, {});
    expect(filtered).toHaveLength(2);
  });

  it('does not filter GPX when gpx is all', () => {
    const trailsWithGpx = mockTrails.map(t => ({ ...t, hasGpx: t.id === 'trail-1' }));
    const filtered = filterTrails(trailsWithGpx, { ...DEFAULT_FILTERS, gpx: 'all' }, {});
    expect(filtered).toHaveLength(3);
  });

  it('filters by wilderness', () => {
    const trailsWithWild = mockTrails.map(t => ({ ...t, fullName: t.fullName.includes('One') ? `◆ ${t.fullName}` : t.fullName }));
    const filtered = filterTrails(trailsWithWild, { ...DEFAULT_FILTERS, wilderness: true }, {});
    expect(filtered).toHaveLength(1);
  });

  it('combines multiple filters', () => {
    const filtered = filterTrails(mockTrails, { ...DEFAULT_FILTERS, difficulties: ['Easy', 'Moderate'], distance: { min: 4, max: 10 } }, {});
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('trail-3');
  });

  it('handles empty trails', () => {
    const filtered = filterTrails([], DEFAULT_FILTERS, {});
    expect(filtered).toHaveLength(0);
  });

  it('handles trail wrapper objects', () => {
    const wrapped = mockTrails.map(t => ({ trail: t }));
    const filtered = filterTrails(wrapped, { ...DEFAULT_FILTERS, search: 'One' }, {});
    expect(filtered).toHaveLength(1);
  });
});

describe('sortTrails', () => {
  it('sorts by name ascending', () => {
    const sorted = sortTrails(mockTrails, { ...DEFAULT_FILTERS, sortBy: 'name' }, 'name', {});
    expect(sorted[0].fullName).toBe('Trail One');
    expect(sorted[2].fullName).toBe('Trail Two');
  });

  it('sorts by distance ascending', () => {
    const sorted = sortTrails(mockTrails, { ...DEFAULT_FILTERS, sortBy: 'distance-up' }, 'name', {});
    expect(sorted[0].distance).toBe(3.0);
    expect(sorted[2].distance).toBe(8.0);
  });

  it('sorts by distance descending', () => {
    const sorted = sortTrails(mockTrails, { ...DEFAULT_FILTERS, sortBy: 'distance-down' }, 'name', {});
    expect(sorted[0].distance).toBe(8.0);
    expect(sorted[2].distance).toBe(3.0);
  });

  it('sorts by elevation ascending', () => {
    const sorted = sortTrails(mockTrails, { ...DEFAULT_FILTERS, sortBy: 'elevation-up' }, 'name', {});
    expect(sorted[0].elevationStart).toBe(1000);
    expect(sorted[2].elevationStart).toBe(3000);
  });

  it('sorts by elevation descending', () => {
    const sorted = sortTrails(mockTrails, { ...DEFAULT_FILTERS, sortBy: 'elevation-down' }, 'name', {});
    expect(sorted[0].elevationStart).toBe(3000);
    expect(sorted[2].elevationStart).toBe(1000);
  });

  it('sorts by popularity', () => {
    const sorted = sortTrails(mockTrails, { ...DEFAULT_FILTERS, sortBy: 'popularity' }, 'name', {});
    expect(sorted[0].id).toBe('trail-1');
  });

  it('sorts by not wilderness', () => {
    const trailsWithWild = mockTrails.map(t => ({ ...t, fullName: t.fullName.includes('One') ? `◆ ${t.fullName}` : t.fullName }));
    const sorted = sortTrails(trailsWithWild, { ...DEFAULT_FILTERS, sortBy: 'not-wilderness' }, 'name', {});
    expect(sorted[0].fullName).not.toContain('◆');
    expect(sorted[2].fullName).toContain('◆');
  });

  it('returns sorted copy without mutating original', () => {
    const original = [...mockTrails];
    sortTrails(mockTrails, { ...DEFAULT_FILTERS, sortBy: 'name' }, 'name', {});
    expect(mockTrails).toEqual(original);
  });

  it('handles empty trails', () => {
    const sorted = sortTrails([], DEFAULT_FILTERS, 'name', {});
    expect(sorted).toHaveLength(0);
  });

  it('handles trail wrapper objects', () => {
    const wrapped = mockTrails.map(t => ({ trail: t }));
    const sorted = sortTrails(wrapped, { ...DEFAULT_FILTERS, sortBy: 'distance-up' }, 'name', {});
    expect(sorted[0].trail.distance).toBe(3.0);
  });
});
