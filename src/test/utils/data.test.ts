import { describe, it, expect } from 'vitest';
import { getTrailName, findTrailById, findTrailIndexById, getScoredMonths, getAvailableMonthsFromSeasonal, getTrailDetailsById } from '../../utils/data';

describe('getTrailName', () => {
  it('returns fullName when available', () => {
    expect(getTrailName({ name: 'Short', fullName: 'Full Name' })).toBe('Full Name');
  });

  it('falls back to name', () => {
    expect(getTrailName({ name: 'Short' })).toBe('Short');
  });

  it('returns empty string for null trail', () => {
    expect(getTrailName(null)).toBe('');
  });
});

describe('getTrailDetailsById', () => {
  const mockDetails = {
    'trail-1': { fullDescription: 'Trail 1 description', pros: 'Great views' },
    '360': { fullDescription: '360 Road description', pros: 'Easy parking' },
    'first': { fullDescription: 'First word ID', pros: 'Test' },
  };

  it('returns details for exact match', () => {
    const result = getTrailDetailsById(mockDetails, 'trail-1');
    expect(result).toEqual({ 'trail-1': { fullDescription: 'Trail 1 description', pros: 'Great views' } });
  });

  it('returns details for first-word fallback', () => {
    const result = getTrailDetailsById(mockDetails, '360-road');
    expect(result).toEqual({ '360-road': { fullDescription: '360 Road description', pros: 'Easy parking' } });
  });

  it('returns null for no match', () => {
    const result = getTrailDetailsById(mockDetails, 'nonexistent');
    expect(result).toBeNull();
  });

  it('returns null for null details', () => {
    const result = getTrailDetailsById(null, 'trail-1');
    expect(result).toBeNull();
  });

  it('returns null for null trailId', () => {
    const result = getTrailDetailsById(mockDetails, null);
    expect(result).toBeNull();
  });

  it('returns null for empty details', () => {
    const result = getTrailDetailsById({}, 'trail-1');
    expect(result).toBeNull();
  });

  it('returns null for empty trailId', () => {
    const result = getTrailDetailsById(mockDetails, '');
    expect(result).toBeNull();
  });
});

describe('findTrailById', () => {
  const mockTrails = [
    { id: 'trail-1', name: 'Trail One', fullName: 'Trail One Full Name' },
    { id: '360-rd', name: '360 Rd', fullName: '360 Road' },
    { id: 'first', name: 'First Trail', fullName: 'First Trail Full Name' },
    { id: 'mount-rainier', name: 'MR', fullName: 'Mount Rainier Loop' },
    { id: 'cascade', name: 'Cascade Falls', fullName: 'Cascade Falls Trail' },
  ];

  it('matches exact trail id', () => {
    expect(findTrailById(mockTrails, 'trail-1')).toBe(mockTrails[0]);
    expect(findTrailById(mockTrails, '360-rd')).toBe(mockTrails[1]);
  });

  it('does not match single-word slug against hyphenated id', () => {
    expect(findTrailById(mockTrails, '360')).toBeNull();
  });

  it('falls back to case-insensitive match', () => {
    expect(findTrailById(mockTrails, 'TRAIL-1')).toBe(mockTrails[0]);
    expect(findTrailById(mockTrails, 'Trail-1')).toBe(mockTrails[0]);
  });

  it('falls back to slug word matching in fullName', () => {
    expect(findTrailById(mockTrails, 'mount-rainier')).toBe(mockTrails[3]);
    expect(findTrailById(mockTrails, 'cascade-falls')).toBe(mockTrails[4]);
  });

  it('falls back to slug word matching in name', () => {
    expect(findTrailById(mockTrails, '360-road')).toBe(mockTrails[1]);
  });

  it('returns null for no match', () => {
    expect(findTrailById(mockTrails, 'nonexistent')).toBeNull();
  });

  it('returns null for null trails', () => {
    expect(findTrailById(null, 'trail-1')).toBeNull();
  });

  it('returns null for null trailId', () => {
    expect(findTrailById(mockTrails, null)).toBeNull();
  });

  it('returns null for empty trails array', () => {
    expect(findTrailById([], 'trail-1')).toBeNull();
  });

  it('returns null for empty trailId', () => {
    expect(findTrailById(mockTrails, '')).toBeNull();
  });

  it('only matches full slug words, not partial', () => {
    expect(findTrailById(mockTrails, 'mount')).toBeNull();
    expect(findTrailById(mockTrails, 'rain')).toBeNull();
    expect(findTrailById(mockTrails, 'cas')).toBeNull();
  });
});

describe('findTrailIndexById', () => {
  const mockTrails = [
    { id: 'trail-1', name: 'Trail One' },
    { id: '360-rd', name: '360 Rd' },
    { id: 'cascade', name: 'Cascade Falls' },
  ];

  it('returns correct index for exact match', () => {
    expect(findTrailIndexById(mockTrails, 'trail-1')).toBe(0);
    expect(findTrailIndexById(mockTrails, 'cascade')).toBe(2);
  });

  it('returns correct index for case-insensitive match', () => {
    expect(findTrailIndexById(mockTrails, 'TRAIL-1')).toBe(0);
  });

  it('does not do slug word matching', () => {
    expect(findTrailIndexById(mockTrails, '360')).toBe(-1);
    expect(findTrailIndexById(mockTrails, '360-road')).toBe(-1);
  });

  it('returns -1 for no match', () => {
    expect(findTrailIndexById(mockTrails, 'nonexistent')).toBe(-1);
  });

  it('returns -1 for null input', () => {
    expect(findTrailIndexById(mockTrails, null)).toBe(-1);
    expect(findTrailIndexById(null, 'trail-1')).toBe(-1);
  });

  it('returns -1 for empty array', () => {
    expect(findTrailIndexById([], 'trail-1')).toBe(-1);
  });
});

describe('getScoredMonths', () => {
  it('returns scored months as abbreviations', () => {
    const seasonal = { Jan: 3, Mar: 2, Jun: 1 };
    const result = getScoredMonths(seasonal);
    expect(result).toEqual(['Jan', 'Mar', 'Jun']);
  });

  it('returns scored months as 1-based indices', () => {
    const seasonal = { Jan: 3, Mar: 2, Jun: 1 };
    const result = getScoredMonths(seasonal, { asIndices: true });
    expect(result).toEqual([1, 3, 6]);
  });

  it('filters out zero and negative scores', () => {
    const seasonal = { Jan: 3, Feb: 0, Mar: -1, Jun: 1 };
    const result = getScoredMonths(seasonal);
    expect(result).toEqual(['Jan', 'Jun']);
  });

  it('filters out non-month keys', () => {
    const seasonal = { Jan: 3, Q1: 2, Jun: 1 };
    const result = getScoredMonths(seasonal);
    expect(result).toEqual(['Jan', 'Jun']);
  });

  it('returns empty array for null seasonal', () => {
    expect(getScoredMonths(null)).toEqual([]);
  });

  it('sorts by month order', () => {
    const seasonal = { Jun: 1, Jan: 3, Mar: 2 };
    const result = getScoredMonths(seasonal);
    expect(result).toEqual(['Jan', 'Mar', 'Jun']);
  });

  it('does not sort when sort is false', () => {
    const seasonal = { Jun: 1, Jan: 3, Mar: 2 };
    const result = getScoredMonths(seasonal, { sort: false });
    expect(result.length).toBe(3);
  });
});

describe('getAvailableMonthsFromSeasonal', () => {
  it('returns 1-based month indices', () => {
    const seasonal = { Jan: 3, Mar: 2 };
    const result = getAvailableMonthsFromSeasonal(seasonal);
    expect(result).toEqual([1, 3]);
  });

  it('returns empty array for null seasonal', () => {
    expect(getAvailableMonthsFromSeasonal(null)).toEqual([]);
  });
});
