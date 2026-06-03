import { describe, it, expect } from 'vitest';
import { filterTrails, sortTrails } from '../../utils/filterTrails';

const mockTrails = [
  {
    id: 'trail-1',
    name: 'Rainier',
    fullName: 'Mount Rainier',
    distance: 5.5,
    elevationStart: 2000,
    difficulty: 'Moderate',
    parking: 'Lot',
    seasonal: { Jan: 3, Feb: 2, Mar: 1, Apr: 0, May: 0, Jun: 0, Jul: 0, Aug: 0, Sep: 0, Oct: 0, Nov: 0, Dec: 0 },
    notes: 'Beautiful trail',
  },
  {
    id: 'trail-2',
    name: 'Stevens',
    fullName: 'Stevens Ridge',
    distance: 12.3,
    elevationStart: 3500,
    difficulty: 'Difficult',
    parking: 'Discover',
    seasonal: { Jan: 0, Feb: 0, Mar: 0, Apr: 0, May: 0, Jun: 0, Jul: 0, Aug: 0, Sep: 1, Oct: 2, Nov: 3, Dec: 0 },
    notes: 'Ridge trail',
  },
  {
    id: 'trail-3',
    name: 'Easy Path',
    fullName: 'Easy Path Trail',
    distance: 2.1,
    elevationStart: 800,
    difficulty: 'Easy',
    parking: 'Free',
    seasonal: { Jan: 0, Feb: 0, Mar: 0, Apr: 0, May: 0, Jun: 0, Jul: 0, Aug: 0, Sep: 0, Oct: 0, Nov: 0, Dec: 0 },
    notes: '',
  },
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

const mockFilters = {
  search: '',
  distanceMin: 0,
  distanceMax: 20,
  elevationMin: 0,
  elevationMax: 5000,
  difficulties: [],
  months: [],
  sortBy: 'name',
  wilderness: false,
};

describe('filterTrails', () => {
  it('returns all trails with no filters', () => {
    const result = filterTrails(mockTrails, mockFilters);
    expect(result).toHaveLength(4);
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

  it('filters by distance range', () => {
    const filters = { ...mockFilters, distanceMin: 3, distanceMax: 10 };
    const result = filterTrails(mockTrails, filters);
    expect(result).toHaveLength(2); // trail-1 (5.5) and trail-4 (8.0)
  });

  it('filters by elevation range', () => {
    const filters = { ...mockFilters, elevationMin: 1000, elevationMax: 3000 };
    const result = filterTrails(mockTrails, filters);
    expect(result).toHaveLength(1); // trail-1 (2000)
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
    const filters = { ...mockFilters, months: [0] }; // January
    const result = filterTrails(mockTrails, filters);
    expect(result).toHaveLength(1); // trail-1 has Jan: 3
  });

  it('filters by wilderness marker', () => {
    const filters = { ...mockFilters, wilderness: true };
    const result = filterTrails(mockTrails, filters);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('trail-4');
  });

  it('combines multiple filters', () => {
    const filters = { ...mockFilters, difficulties: ['Difficult'], elevationMin: 4000 };
    const result = filterTrails(mockTrails, filters);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('trail-4');
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
    // ◆ (U+25C6) sorts before ASCII in localeCompare
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
    const filters = { ...mockFilters, sortBy: 'popularity', months: [0] }; // January
    const result = sortTrails(mockTrails, filters);
    expect(result[0].id).toBe('trail-1'); // trail-1 has Jan: 3
  });

  it('sorts by popularity across all months when no months selected', () => {
    const filters = { ...mockFilters, sortBy: 'popularity' };
    const result = sortTrails(mockTrails, filters);
    // trail-1 and trail-2 both have total score 6, trail-3 has 0
    expect(result[2].id).toBe('trail-3'); // trail-3 has no seasonal data, should be last
  });

  it('sorts not-wilderness putting wilderness trails last', () => {
    const filters = { ...mockFilters, sortBy: 'not-wilderness' };
    const result = sortTrails(mockTrails, filters);
    expect(result[3].id).toBe('trail-4'); // wilderness trail should be last
  });

  it('handles schedule mode wrapper objects', () => {
    const scheduleItems = mockTrails.map(t => ({ hike: t.name, trail: t }));
    const filters = { ...mockFilters, sortBy: 'name' };
    const result = sortTrails(scheduleItems, filters, 'hike');
    // ◆ (U+25C6) sorts before ASCII in localeCompare
    expect(result[0].hike).toBe('Wilderness Peak');
    expect(result[1].hike).toBe('Easy Path');
    expect(result[2].hike).toBe('Rainier');
    expect(result[3].hike).toBe('Stevens');
  });
});
