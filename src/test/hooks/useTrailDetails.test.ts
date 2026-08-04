import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTrailDetails } from '../../hooks/useTrailDetails';

vi.mock('../../hooks/useTrailStore', () => ({
  useTrailStore: vi.fn(() => ({
    trailDetails: { 'trail-1': { fullDescription: 'Trail one details', parking: 'Free parking' } },
  })),
}));

describe('useTrailDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns trailDetails from store', () => {
    const { result } = renderHook(() => useTrailDetails());
    expect(result.current).toEqual({ 'trail-1': { fullDescription: 'Trail one details', parking: 'Free parking' } });
  });

  it('returns object', () => {
    const { result } = renderHook(() => useTrailDetails());
    expect(typeof result.current).toBe('object');
  });
});
