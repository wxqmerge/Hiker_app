import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTrails } from '../../hooks/useTrails';

vi.mock('../../hooks/useTrailStore', () => ({
  useTrailStore: vi.fn(() => ({
    trails: [{ id: 'trail-1', name: 'Test Trail' }],
    trailDetails: { 'trail-1': { fullDescription: 'Test details' } },
    loading: false,
    lookup: { findTrailById: vi.fn((id) => id === 'trail-1' ? { id: 'trail-1', name: 'Test Trail' } : null) },
    schedule: { Jan: {} },
  })),
}));

import { useTrailStore } from '../../hooks/useTrailStore';

describe('useTrails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns expected properties', () => {
    const { result } = renderHook(() => useTrails());
    expect(result.current).toHaveProperty('trails');
    expect(result.current).toHaveProperty('trailDetails');
    expect(result.current).toHaveProperty('loading');
    expect(result.current).toHaveProperty('lookup');
    expect(result.current).toHaveProperty('schedule');
  });

  it('returns trails from store', () => {
    const { result } = renderHook(() => useTrails());
    expect(result.current.trails).toEqual([{ id: 'trail-1', name: 'Test Trail' }]);
  });

  it('returns trailDetails from store', () => {
    const { result } = renderHook(() => useTrails());
    expect(result.current.trailDetails).toEqual({ 'trail-1': { fullDescription: 'Test details' } });
  });

  it('returns loading state from store', () => {
    const { result } = renderHook(() => useTrails());
    expect(result.current.loading).toBe(false);
  });

  it('returns lookup object from store', () => {
    const { result } = renderHook(() => useTrails());
    expect(result.current.lookup).toHaveProperty('findTrailById');
  });

  it('returns schedule from store', () => {
    const { result } = renderHook(() => useTrails());
    expect(result.current.schedule).toEqual({ Jan: {} });
  });
});
