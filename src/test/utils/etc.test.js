import { describe, it, expect } from 'vitest';
import { calculateETC } from '../../utils/etc';

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
