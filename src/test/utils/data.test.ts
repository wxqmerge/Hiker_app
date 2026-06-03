import { describe, it, expect } from 'vitest';
import { getTrailDetailsById } from '../../utils/data';

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
});
