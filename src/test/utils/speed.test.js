import { describe, it, expect } from 'vitest';
import { computeMedianSpeed, formatSpeed } from '../../utils/speed';

describe('computeMedianSpeed', () => {
  it('returns null when no trails have valid data', () => {
    expect(computeMedianSpeed([])).toBeNull();
    expect(computeMedianSpeed([{ distance: 5, durationMinutes: null }])).toBeNull();
    expect(computeMedianSpeed([{ distance: null, durationMinutes: 60 }])).toBeNull();
    expect(computeMedianSpeed([{ distance: 0, durationMinutes: 60 }])).toBeNull();
    expect(computeMedianSpeed([{ distance: 5, durationMinutes: 0 }])).toBeNull();
  });

  it('computes speed for a single trail', () => {
    // 5 miles in 120 minutes = 2.5 mph
    const trails = [{ distance: 5, durationMinutes: 120 }];
    expect(computeMedianSpeed(trails)).toBeCloseTo(2.5);
  });

  it('computes median for odd number of trails', () => {
    // 5mi/120min=2.5, 3mi/60min=3.0, 6mi/180min=2.0
    const trails = [
      { distance: 5, durationMinutes: 120 },
      { distance: 3, durationMinutes: 60 },
      { distance: 6, durationMinutes: 180 },
    ];
    // sorted: [2.0, 2.5, 3.0] -> median = 2.5
    expect(computeMedianSpeed(trails)).toBeCloseTo(2.5);
  });

  it('computes median for even number of trails', () => {
    // 5mi/120min=2.5, 3mi/60min=3.0, 6mi/180min=2.0, 4mi/80min=3.0
    const trails = [
      { distance: 5, durationMinutes: 120 },
      { distance: 3, durationMinutes: 60 },
      { distance: 6, durationMinutes: 180 },
      { distance: 4, durationMinutes: 80 },
    ];
    // sorted: [2.0, 2.5, 3.0, 3.0] -> median = (2.5+3.0)/2 = 2.75
    expect(computeMedianSpeed(trails)).toBeCloseTo(2.75);
  });

  it('ignores trails missing distance or duration', () => {
    const trails = [
      { distance: 5, durationMinutes: 120 },
      { distance: null, durationMinutes: 60 },
      { distance: 3, durationMinutes: null },
      { distance: 4, durationMinutes: 80 },
    ];
    // Only 2 valid: 2.5 and 3.0 -> median = 2.75
    expect(computeMedianSpeed(trails)).toBeCloseTo(2.75);
  });

  it('handles large datasets', () => {
    const trails = Array.from({ length: 100 }, (_, i) => ({
      distance: (i + 1) * 0.5,
      durationMinutes: (i + 1) * 10,
    }));
    const result = computeMedianSpeed(trails);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(10);
  });
});

describe('formatSpeed', () => {
  it('returns N/A for null', () => {
    expect(formatSpeed(null)).toBe('N/A');
  });

  it('formats speed to one decimal', () => {
    expect(formatSpeed(2.5)).toBe('2.5 mph');
    expect(formatSpeed(3.0)).toBe('3.0 mph');
    expect(formatSpeed(2.456)).toBe('2.5 mph');
  });
});
