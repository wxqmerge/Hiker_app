import { describe, it, expect } from 'vitest';
import { filterTrails, sortTrails } from '../../utils/filterTrails';
import { DEFAULT_FILTERS } from '../../utils/constants';

const baseTrails = globalThis.__TEST_MOCK_DATA__.trails;
const mockTrails = [
  ...baseTrails,
  {
    id: 'trail-4',
    name: 'Wilderness Peak',
    fullName: '◆ Wilderness Peak',
    distance: 8.0,
    elevationStart: 4200,
    difficulty: 'Difficult',
    parking: 'Wilderness',
    seasonal: { Jan: 0, Feb: 0, Mar: 0, Apr: 0, May: 0, Jun: 0, Jul: 0, Aug: 0, Sep: 0, Oct: 0, Nov: 0, Dec: 0 },
    notes: '',
  },
];

const mockFilters = { ...DEFAULT_FILTERS };

describe('filterTrails', () => {
  it('returns all trails with no filters', () => {
    const result = filterTrails(mockTrails, mockFilters);
    expect(result).toHaveLength(4);
  });

  it('returns all trails with default filters', () => {
    const filtered = filterTrails(mockTrails, DEFAULT_FILTERS);
    expect(filtered).toHaveLength(4);
  });

  it('filters by search text in fullName', () => {
    const filters = { ...mockFilters, search: 'Rainier' };
    const result = filterTrails(mockTrails, filters);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('trail-1');
  });

  it('filters by search text in name', () => {
    const filters = { ...mockFilters, search: 'Stevens' };
    const result = filterTrails(mockTrails, filters);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('trail-2');
  });

  it('filters by search text in notes', () => {
    const filters = { ...mockFilters, search: 'Ridge' };
    const result = filterTrails(mockTrails, filters);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('trail-2');
  });

  it('filters by search text case insensitive', () => {
    const filters = { ...mockFilters, search: 'rainier' };
    const result = filterTrails(mockTrails, filters);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('trail-1');
  });

  it('filters by distance range', () => {
    const filters = { ...mockFilters, distance: { min: 3, max: 10 } };
    const result = filterTrails(mockTrails, filters);
    expect(result).toHaveLength(2);
  });

  it('filters by elevation range', () => {
    const filters = { ...mockFilters, elevation: { min: 1000, max: 3000 } };
    const result = filterTrails(mockTrails, filters);
    expect(result).toHaveLength(1);
  });

  it('filters by difficulty', () => {
    const filters = { ...mockFilters, difficulties: ['Easy'] };
    const result = filterTrails(mockTrails, filters);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('trail-3');
  });

  it('filters by multiple difficulties', () => {
    const filters = { ...mockFilters, difficulties: ['Easy', 'Moderate'] };
    const result = filterTrails(mockTrails, filters);
    expect(result).toHaveLength(2);
  });

  it('filters by month availability', () => {
    const filters = { ...mockFilters, months: [0] };
    const result = filterTrails(mockTrails, filters);
    expect(result).toHaveLength(1);
  });

  it('filters by multiple months', () => {
    const filters = { ...mockFilters, months: [0, 5] };
    const result = filterTrails(mockTrails, filters);
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it('filters by GPX only', () => {
    const trailsWithGpx = mockTrails.map(t => ({ ...t, hasGpx: t.id === 'trail-1' }));
    const filters = { ...mockFilters, gpx: 'gpx' };
    const result = filterTrails(trailsWithGpx, filters);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('trail-1');
  });

  it('filters by no GPX', () => {
    const trailsWithGpx = mockTrails.map(t => ({ ...t, hasGpx: t.id === 'trail-1' }));
    const filters = { ...mockFilters, gpx: 'noGpx' };
    const result = filterTrails(trailsWithGpx, filters);
    expect(result).toHaveLength(3);
  });

  it('does not filter GPX when gpx is all', () => {
    const trailsWithGpx = mockTrails.map(t => ({ ...t, hasGpx: t.id === 'trail-1' }));
    const filters = { ...mockFilters, gpx: 'all' };
    const result = filterTrails(trailsWithGpx, filters);
    expect(result).toHaveLength(4);
  });

  it('filters by wilderness marker', () => {
    const filters = { ...mockFilters, wilderness: true };
    const result = filterTrails(mockTrails, filters);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('trail-4');
  });

  it('combines multiple filters', () => {
    const filters = { ...mockFilters, difficulties: ['Difficult'], elevation: { min: 4000, max: 5000 } };
    const result = filterTrails(mockTrails, filters);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('trail-4');
  });

  it('handles empty trails', () => {
    const result = filterTrails([], DEFAULT_FILTERS);
    expect(result).toHaveLength(0);
  });

  it('handles schedule mode wrapper objects', () => {
    const scheduleItems = mockTrails.map(t => ({ hike: t.name, trail: t }));
    const filters = { ...mockFilters, search: 'Rainier' };
    const result = filterTrails(scheduleItems, filters);
    expect(result).toHaveLength(1);
    expect(result[0].trail.id).toBe('trail-1');
  });
});

describe('sortTrails', () => {
  it('sorts by name ascending', () => {
    const result = sortTrails(mockTrails, mockFilters);
    expect(result[0].fullName).toBe('◆ Wilderness Peak');
    expect(result[1].fullName).toBe('Easy Path Trail');
    expect(result[2].fullName).toBe('Mount Rainier');
    expect(result[3].fullName).toBe('Stevens Ridge');
  });

  it('sorts by elevation ascending', () => {
    const filters = { ...mockFilters, sortBy: 'elevation-up' };
    const result = sortTrails(mockTrails, filters);
    expect(result[0].elevationStart).toBe(800);
    expect(result[3].elevationStart).toBe(4200);
  });

  it('sorts by elevation descending', () => {
    const filters = { ...mockFilters, sortBy: 'elevation-down' };
    const result = sortTrails(mockTrails, filters);
    expect(result[0].elevationStart).toBe(4200);
    expect(result[3].elevationStart).toBe(800);
  });

  it('sorts by distance ascending', () => {
    const filters = { ...mockFilters, sortBy: 'distance-up' };
    const result = sortTrails(mockTrails, filters);
    expect(result[0].distance).toBe(2.1);
    expect(result[3].distance).toBe(12.3);
  });

  it('sorts by distance descending', () => {
    const filters = { ...mockFilters, sortBy: 'distance-down' };
    const result = sortTrails(mockTrails, filters);
    expect(result[0].distance).toBe(12.3);
    expect(result[3].distance).toBe(2.1);
  });

  it('sorts by popularity based on selected months', () => {
    const filters = { ...mockFilters, sortBy: 'popularity', months: [0] };
    const result = sortTrails(mockTrails, filters);
    expect(result[0].id).toBe('trail-1');
  });

  it('sorts by popularity across all months when no months selected', () => {
    const filters = { ...mockFilters, sortBy: 'popularity' };
    const result = sortTrails(mockTrails, filters);
    expect(result[2].id).toBe('trail-3');
  });

  it('sorts not-wilderness putting wilderness trails last', () => {
    const filters = { ...mockFilters, sortBy: 'not-wilderness' };
    const result = sortTrails(mockTrails, filters);
    expect(result[3].id).toBe('trail-4');
  });

  it('returns sorted copy without mutating original', () => {
    const original = [...mockTrails];
    sortTrails(mockTrails, mockFilters);
    expect(mockTrails).toEqual(original);
  });

  it('handles empty trails', () => {
    const result = sortTrails([], DEFAULT_FILTERS);
    expect(result).toHaveLength(0);
  });

  it('handles schedule mode wrapper objects', () => {
    const scheduleItems = mockTrails.map(t => ({ trail: t }));
    const filters = { ...mockFilters, sortBy: 'name' };
    const result = sortTrails(scheduleItems, filters);
    expect(result[0].trail.fullName).toBe('◆ Wilderness Peak');
    expect(result[1].trail.fullName).toBe('Easy Path Trail');
    expect(result[2].trail.fullName).toBe('Mount Rainier');
    expect(result[3].trail.fullName).toBe('Stevens Ridge');
  });
});
