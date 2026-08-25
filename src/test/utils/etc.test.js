import { describe, it, expect } from 'vitest';
import { calculateETC, normalizeStartOffset, extractStartOffset } from '../../utils/etc';

// Formula: total = round(8*60 + startMin + hikeMinutes + range*2)
// hikeMinutes = gpx > 0 ? clamp(gpx, dist/2.2*60, dist/1.1*60) : dist/2.2*60
// startMin = 30 (normal) or 0 (early)

describe('calculateETC', () => {
  it('computes ETC from distance at 2.2 mph minimum (no GPX)', () => {
    // 5/2.2*60 = 136.36; 510 + 136.36 + 60 = 706.36 → 706 → 11:46
    expect(calculateETC(5, 30, false, null)).toBe('11:46 AM');
  });

  it('uses GPX duration when within bounds', () => {
    // min = 136.36, max = 272.73; GPX = 200 (in range) → use 200
    // 510 + 200 + 60 = 770 → 12:50
    expect(calculateETC(5, 30, false, 200)).toBe('12:50 PM');
  });

  it('clamps GPX duration below the 2.2 mph minimum', () => {
    // min = 136.36; GPX = 100 < 136.36 → use 136.36
    // 510 + 136.36 + 60 = 706.36 → 706 → 11:46
    expect(calculateETC(5, 30, false, 100)).toBe('11:46 AM');
  });

  it('clamps GPX duration above the 1.1 mph maximum', () => {
    // max = 5/1.1*60 = 272.73; GPX = 400 > 272.73 → use 272.73
    // 510 + 272.73 + 60 = 842.73 → 843 → 14:03
    expect(calculateETC(5, 30, false, 400)).toBe('2:03 PM');
  });

  it('uses GPX duration when it equals the minimum', () => {
    // min = 136.36; GPX = 136.36 → use 136.36
    expect(calculateETC(5, 30, false, 136.36)).toBe('11:46 AM');
  });

  it('uses GPX duration when it equals the maximum', () => {
    // max = 272.73; GPX = 272.73 → use 272.73
    // 510 + 272.73 + 60 = 842.73 → 843 → 14:03
    expect(calculateETC(5, 30, false, 272.73)).toBe('2:03 PM');
  });

  it('handles early start (8:00 AM)', () => {
    // 5/2.2*60 = 136.36; 480 + 0 + 136.36 + 60 = 676.36 → 676 → 11:16
    expect(calculateETC(5, 30, true, null)).toBe('11:16 AM');
  });

  it('handles zero distance and no GPX', () => {
    // 0 min hike; 510 + 0 + 0 = 510 → 8:30
    expect(calculateETC(0, 0, false, null)).toBe('8:30 AM');
  });

  it('handles zero distance with GPX duration', () => {
    // min = 0, max = 0; GPX = 90 > 0 → clamp to 0
    // 510 + 0 + 0 = 510 → 8:30
    expect(calculateETC(0, 0, false, 90)).toBe('8:30 AM');
  });

  it('handles null distance and null GPX', () => {
    expect(calculateETC(null, null, false, null)).toBe('8:30 AM');
  });

  it('handles undefined inputs', () => {
    expect(calculateETC(undefined, undefined, false, undefined)).toBe('8:30 AM');
  });

  it('crosses noon correctly', () => {
    // 10/2.2*60 = 272.73; 510 + 272.73 + 60 = 842.73 → 843 → 14:03
    expect(calculateETC(10, 30, false, null)).toBe('2:03 PM');
  });

  it('clamps very long GPX to 1.1 mph max', () => {
    // max = 5/1.1*60 = 272.73; GPX = 300 > 272.73 → use 272.73
    // 510 + 272.73 + 60 = 842.73 → 843 → 14:03
    expect(calculateETC(5, 30, false, 300)).toBe('2:03 PM');
  });

  it('handles 12:00 PM boundary', () => {
    // 5.5/2.2*60 = 150; 510 + 150 + 60 = 720 → 12:00
    expect(calculateETC(5.5, 30, false, null)).toBe('12:00 PM');
  });

  it('handles short hike staying in AM', () => {
    // 0.1/2.2*60 = 2.73; 510 + 2.73 + 0 = 512.73 → 513 → 8:33
    expect(calculateETC(0.1, 0, false, null)).toBe('8:33 AM');
  });
});

describe('normalizeStartOffset', () => {
  it('converts true to -30', () => {
    expect(normalizeStartOffset(true)).toBe(-30);
  });
  it('converts false to 0', () => {
    expect(normalizeStartOffset(false)).toBe(0);
  });
  it('converts null to 0', () => {
    expect(normalizeStartOffset(null)).toBe(0);
  });
  it('passes through numbers', () => {
    expect(normalizeStartOffset(-60)).toBe(-60);
    expect(normalizeStartOffset(30)).toBe(30);
    expect(normalizeStartOffset(0)).toBe(0);
  });
});

describe('extractStartOffset', () => {
  it('returns 0 for no marker', () => {
    expect(extractStartOffset('Hurricane Hill')).toBe(0);
  });
  it('returns 0 for null/empty', () => {
    expect(extractStartOffset(null)).toBe(0);
    expect(extractStartOffset('')).toBe(0);
  });
  it('parses (Early Start) as -30', () => {
    expect(extractStartOffset('Hurricane Hill (Early Start)')).toBe(-30);
  });
  it('parses (early start) case-insensitive', () => {
    expect(extractStartOffset('Trail (early start)')).toBe(-30);
  });
  it('parses (Late Start) as +30', () => {
    expect(extractStartOffset('Hurricane Hill (Late Start)')).toBe(30);
  });
  it('parses (late start) case-insensitive', () => {
    expect(extractStartOffset('Trail (late start)')).toBe(30);
  });
  it('parses (30m early) as -30', () => {
    expect(extractStartOffset('Trail (30m early)')).toBe(-30);
  });
  it('parses (60m early) as -60', () => {
    expect(extractStartOffset('Trail (60m early)')).toBe(-60);
  });
  it('parses (90m early) as -90', () => {
    expect(extractStartOffset('Trail (90m early)')).toBe(-90);
  });
  it('parses (30m late) as +30', () => {
    expect(extractStartOffset('Trail (30m late)')).toBe(30);
  });
  it('parses (60m late) as +60', () => {
    expect(extractStartOffset('Trail (60m late)')).toBe(60);
  });
  it('handles mixed case', () => {
    expect(extractStartOffset('Trail (30M Early)')).toBe(-30);
  });
});
