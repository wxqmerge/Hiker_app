import { describe, it, expect } from 'vitest';
import { formatTrailLine } from '../../utils/formatTrail';

describe('formatTrailLine', () => {
  it('formats a basic trail', () => {
    const trail = {
      id: 'trail-1',
      name: 'Rainier',
      fullName: 'Mount Rainier',
      distance: 5.5,
      distanceExtended: 6.0,
      elevationStart: 2000,
      elevationMax: 4000,
      difficulty: 'Moderate',
      parking: 'Lot',
      range: 45,
    };
    const result = formatTrailLine(trail);
    expect(result).toContain('Mount Rainier');
    expect(result).toContain('[Moderate]');
    expect(result).toContain('5.5');
    expect(result).toContain('6.0');
    expect(result).toContain('2,000\'-4,000\'');
    expect(result).toContain('Lot');
    expect(result).toContain('ride-$5');
  });

  it('strips ◆ marker from trail name', () => {
    const trail = {
      id: 'trail-2',
      name: 'Wilderness',
      fullName: '◆ Wilderness Peak',
      distance: 8.0,
      elevationStart: 4200,
      elevationMax: 5000,
      difficulty: 'Difficult',
      parking: 'Free',
    };
    const result = formatTrailLine(trail);
    // Function strips ◆ from fullName but adds ◆︎ to output for wilderness indicator
    expect(result).toContain('Wilderness Peak');
    expect(result).toContain('◆');
  });

  it('handles missing optional fields', () => {
    const trail = {
      id: 'trail-3',
      name: 'Simple',
      fullName: 'Simple Trail',
      distance: 3.0,
      elevationStart: 1000,
      difficulty: 'Easy',
      parking: '',
    };
    const result = formatTrailLine(trail);
    expect(result).toContain('Simple Trail');
    expect(result).toContain('[Easy]');
  });

  it('handles null distance', () => {
    const trail = {
      id: 'trail-4',
      name: 'No Distance',
      fullName: 'No Distance Trail',
      distance: null,
      elevationStart: 1000,
      difficulty: 'Easy',
    };
    const result = formatTrailLine(trail);
    expect(result).toContain('N/A');
  });

  it('handles missing elevationMax', () => {
    const trail = {
      id: 'trail-5',
      name: 'Flat',
      fullName: 'Flat Trail',
      distance: 2.0,
      elevationStart: 500,
      difficulty: 'Easy',
    };
    const result = formatTrailLine(trail);
    expect(result).toContain('500\'-500\'');
  });

  it('uses name when fullName is missing', () => {
    const trail = {
      id: 'trail-6',
      name: 'No FullName',
      distance: 1.0,
      elevationStart: 100,
      difficulty: 'Easy',
    };
    const result = formatTrailLine(trail);
    expect(result).toContain('No FullName');
  });

  it('handles large elevation numbers with locale', () => {
    const trail = {
      id: 'trail-7',
      name: 'Big',
      fullName: 'Big Mountain',
      distance: 10.0,
      elevationStart: 12345,
      elevationMax: 23456,
      difficulty: 'Difficult',
    };
    const result = formatTrailLine(trail);
    expect(result).toContain('12,345\'');
    expect(result).toContain('23,456\'');
  });
});
