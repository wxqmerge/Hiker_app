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

describe('findTrailById', () => {
  const trails = [
    { id: 'test-trail', name: 'Test Trail', fullName: 'Test Trail Full' },
    { id: 'mount-rainier', name: 'Mount Rainier', fullName: 'Mount Rainier Summit' },
  ];

  it('finds by exact ID', () => {
    expect(findTrailById(trails, 'test-trail')).toBe(trails[0]);
  });

  it('finds by case-insensitive ID', () => {
    expect(findTrailById(trails, 'TEST-TRAIL')).toBe(trails[0]);
  });

  it('finds by slug word matching', () => {
    const result = findTrailById(trails, 'mount-rainier-summit');
    expect(result).toBe(trails[1]);
  });

  it('returns null for missing trail', () => {
    expect(findTrailById(trails, 'nonexistent')).toBeNull();
  });

  it('returns null for empty trails', () => {
    expect(findTrailById([], 'test')).toBeNull();
  });

  it('returns null for null trails', () => {
    expect(findTrailById(null, 'test')).toBeNull();
  });

  it('returns null for empty trailId', () => {
    expect(findTrailById(trails, '')).toBeNull();
  });

  it('returns null for single-word slug that does not match', () => {
    expect(findTrailById(trails, 'mount')).toBeNull();
  });
});

describe('findTrailIndexById', () => {
  const trails = [
    { id: 'test-trail', name: 'Test Trail' },
    { id: 'another-trail', name: 'Another Trail' },
  ];

  it('finds by exact ID', () => {
    expect(findTrailIndexById(trails, 'test-trail')).toBe(0);
  });

  it('finds by case-insensitive ID', () => {
    expect(findTrailIndexById(trails, 'TEST-TRAIL')).toBe(0);
  });

  it('returns -1 for missing trail', () => {
    expect(findTrailIndexById(trails, 'nonexistent')).toBe(-1);
  });

  it('returns -1 for empty trails', () => {
    expect(findTrailIndexById([], 'test')).toBe(-1);
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

describe('getTrailDetailsById', () => {
  const details = {
    'test-trail': { fullDescription: 'A test trail' },
    '360': { fullDescription: '360 trail' },
  };

  it('finds by exact ID', () => {
    const result = getTrailDetailsById(details, 'test-trail');
    expect(result).toEqual({ 'test-trail': { fullDescription: 'A test trail' } });
  });

  it('falls back to base ID for compound IDs', () => {
    const result = getTrailDetailsById(details, '360-rd');
    expect(result).toEqual({ '360-rd': { fullDescription: '360 trail' } });
  });

  it('returns null for missing ID', () => {
    expect(getTrailDetailsById(details, 'nonexistent')).toBeNull();
  });

  it('returns null for null details', () => {
    expect(getTrailDetailsById(null, 'test')).toBeNull();
  });

  it('returns null for empty trailId', () => {
    expect(getTrailDetailsById(details, '')).toBeNull();
  });
});
