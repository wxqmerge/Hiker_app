import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFilters } from '../../hooks/useTrails';

describe('useFilters', () => {
  const mockTrails = globalThis.__TEST_MOCK_DATA__.trails.slice(0, 2);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns default filters on init', () => {
    const { result } = renderHook(() => useFilters(mockTrails));
    expect(result.current.filters.search).toBe('');
    expect(result.current.filters.distanceMax).toBe(20);
    expect(result.current.filters.elevationMax).toBe(5000);
    expect(result.current.filters.difficulties).toEqual([]);
    expect(result.current.filters.months).toEqual([]);
    expect(result.current.filters.sortBy).toBe('name');
    expect(result.current.filters.wilderness).toBe(false);
  });

  it('returns sorted trails by default', () => {
    const { result } = renderHook(() => useFilters(mockTrails));
    expect(result.current.sortedTrails).toHaveLength(2);
    expect(result.current.sortedTrails[0].fullName).toBe('Mount Rainier');
    expect(result.current.sortedTrails[1].fullName).toBe('Stevens Ridge');
  });

  it('filters by search text', () => {
    const { result } = renderHook(() => useFilters(mockTrails));
    act(() => {
      result.current.setFilters({ ...result.current.filters, search: 'Stevens' });
    });
    expect(result.current.sortedTrails).toHaveLength(1);
    expect(result.current.sortedTrails[0].name).toBe('Stevens');
  });

  it('filters by distance', () => {
    const { result } = renderHook(() => useFilters(mockTrails));
    act(() => {
      result.current.setFilters({ ...result.current.filters, distanceMin: 6, distanceMax: 20 });
    });
    expect(result.current.sortedTrails).toHaveLength(1);
    expect(result.current.sortedTrails[0].distance).toBe(12.3);
  });

  it('filters by elevation', () => {
    const { result } = renderHook(() => useFilters(mockTrails));
    act(() => {
      result.current.setFilters({ ...result.current.filters, elevationMin: 3000, elevationMax: 5000 });
    });
    expect(result.current.sortedTrails).toHaveLength(1);
    expect(result.current.sortedTrails[0].elevationStart).toBe(3500);
  });

  it('filters by difficulty', () => {
    const { result } = renderHook(() => useFilters(mockTrails));
    act(() => {
      result.current.setFilters({ ...result.current.filters, difficulties: ['Difficult'] });
    });
    expect(result.current.sortedTrails).toHaveLength(1);
    expect(result.current.sortedTrails[0].difficulty).toBe('Difficult');
  });

  it('filters by month', () => {
    const { result } = renderHook(() => useFilters(mockTrails));
    act(() => {
      result.current.setFilters({ ...result.current.filters, months: [0] }); // January
    });
    expect(result.current.sortedTrails).toHaveLength(1);
    expect(result.current.sortedTrails[0].id).toBe('trail-1');
  });

  it('filters by wilderness marker', () => {
    const wildernessTrail = {
      id: 'trail-3',
      name: 'Wilderness',
      fullName: '◆ Wilderness Peak',
      distance: 8.0,
      elevationStart: 4200,
      difficulty: 'Difficult',
      parking: 'Free',
      seasonal: {},
    };
    const trails = [...mockTrails, wildernessTrail];
    const { result } = renderHook(() => useFilters(trails));
    act(() => {
      result.current.setFilters({ ...result.current.filters, wilderness: true });
    });
    expect(result.current.sortedTrails).toHaveLength(1);
    expect(result.current.sortedTrails[0].id).toBe('trail-3');
  });

  it('sorts by popularity', () => {
    const { result } = renderHook(() => useFilters(mockTrails));
    act(() => {
      result.current.setFilters({ ...result.current.filters, sortBy: 'popularity', months: [0] });
    });
    expect(result.current.sortedTrails[0].id).toBe('trail-1'); // trail-1 has Jan: 3
  });

  it('resets filters to defaults', () => {
    const { result } = renderHook(() => useFilters(mockTrails));
    act(() => {
      result.current.setFilters({ ...result.current.filters, search: 'test' });
    });
    act(() => {
      result.current.resetFilters();
    });
    expect(result.current.filters.search).toBe('');
    expect(result.current.sortedTrails).toHaveLength(2);
  });

  it('handles empty trails array', () => {
    const { result } = renderHook(() => useFilters([]));
    expect(result.current.sortedTrails).toHaveLength(0);
  });

  it('searches seasonal month names', () => {
    const { result } = renderHook(() => useFilters(mockTrails));
    act(() => {
      result.current.setFilters({ ...result.current.filters, search: 'Jan' });
    });
    expect(result.current.sortedTrails).toHaveLength(1);
  });
});
