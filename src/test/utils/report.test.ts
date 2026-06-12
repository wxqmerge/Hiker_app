import { describe, it, expect, vi } from 'vitest';
import { generateReportText, generateReportHtml, getRideCost, copyToClipboard } from '../../utils/report';

describe('getRideCost', () => {
  it('returns ride-$3 for range < 30', () => {
    expect(getRideCost(10)).toBe('ride-$3');
    expect(getRideCost(29)).toBe('ride-$3');
  });

  it('returns ride-$5 for range 30-59', () => {
    expect(getRideCost(30)).toBe('ride-$5');
    expect(getRideCost(59)).toBe('ride-$5');
  });

  it('returns ride-$7 for range 60-89', () => {
    expect(getRideCost(60)).toBe('ride-$7');
    expect(getRideCost(89)).toBe('ride-$7');
  });

  it('returns ride-$10 for range >= 90', () => {
    expect(getRideCost(90)).toBe('ride-$10');
    expect(getRideCost(120)).toBe('ride-$10');
  });

  it('returns null for invalid range', () => {
    expect(getRideCost(0)).toBeNull();
    expect(getRideCost(-1)).toBeNull();
    expect(getRideCost(null)).toBeNull();
    expect(getRideCost(undefined)).toBeNull();
  });
});

describe('generateReportText', () => {
  const mockTrail = {
    id: 'trail-1',
    name: 'Rainier',
    fullName: 'Mount Rainier',
    distance: 5.5,
    elevationStart: 2000,
    elevationMax: 4000,
    difficulty: 'Moderate',
    parking: 'Lot',
    range: 45,
  };

  it('includes trail header line', () => {
    const result = generateReportText(mockTrail);
    expect(result).toContain('Mount Rainier');
    expect(result).toContain('[Moderate]');
  });

  it('includes description from trailDetails', () => {
    const trailDetails = {
      'trail-1': {
        fullDescription: 'This is a beautiful trail with great views.',
        pros: 'Great views',
        others: 'Parking is easy',
      },
    };
    const result = generateReportText(mockTrail, trailDetails);
    expect(result).toContain('This is a beautiful trail with great views.');
  });

  it('exports full description as-is', () => {
    const trailDetails = {
      'trail-1': {
        fullDescription: 'Beautiful trail with great views.',
      },
    };
    const result = generateReportText(mockTrail, trailDetails);
    expect(result).toContain('Beautiful trail with great views.');
  });

  it('handles missing trailDetails', () => {
    const result = generateReportText(mockTrail, null);
    expect(result).toContain('Mount Rainier');
  });

  it('handles missing trailDetails for specific trail', () => {
    const trailDetails = {
      'trail-99': { fullDescription: 'Some other trail' },
    };
    const result = generateReportText(mockTrail, trailDetails);
    expect(result).toContain('Mount Rainier');
  });

  it('includes (Early Start) after trail name when earlyStart is true', () => {
    const result = generateReportText(mockTrail, null, true);
    expect(result).toContain('(Early Start)');
    expect(result).toContain('[Moderate]');
    const earlyStartIdx = result.indexOf('(Early Start)');
    const difficultyIdx = result.indexOf('[Moderate]');
    expect(earlyStartIdx).toBeLessThan(difficultyIdx);
  });

  it('does not include (Early Start) when earlyStart is false', () => {
    const result = generateReportText(mockTrail, null, false);
    expect(result).not.toContain('(Early Start)');
  });
});

describe('copyToClipboard', () => {
  it('copies text successfully', async () => {
    const setStatus = vi.fn();
    const result = await copyToClipboard('test text', setStatus);
    expect(result).toBe(true);
    expect(setStatus).toHaveBeenCalledWith(true);
  });

  it('calls setTimeout to reset status', async () => {
    const setStatus = vi.fn();
    vi.useFakeTimers();
    await copyToClipboard('test text', setStatus);
    expect(setStatus).toHaveBeenCalledWith(true);
    vi.advanceTimersByTime(2000);
    expect(setStatus).toHaveBeenCalledWith(false);
    vi.useRealTimers();
  });

  it('handles copy failure', async () => {
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('Failed'));
    const setStatus = vi.fn();
    const result = await copyToClipboard('test', setStatus);
    expect(result).toBe(false);
    vi.restoreAllMocks();
  });
});

describe('generateReportHtml', () => {
  const mockTrail = {
    id: 'trail-1',
    name: 'Rainier',
    fullName: 'Mount Rainier',
    distance: 5.5,
    elevationStart: 2000,
    elevationMax: 4000,
    difficulty: 'Moderate',
    parking: 'Lot',
    range: 45,
    webLink: 'https://example.com/rainier',
  };

  it('includes title in h1', () => {
    const html = generateReportHtml([], 'Over-the-Hill Hike Descriptions -- Jun, 2026');
    expect(html).toContain('<h1>Over-the-Hill Hike Descriptions -- Jun, 2026</h1>');
  });

  it('renders trail header line in bold', () => {
    const entries = [{ dateStr: 'Fri, Jun 12', trail: mockTrail, trailDetails: null, earlyStart: false }];
    const html = generateReportHtml(entries, 'Title');
    expect(html).toContain('entry-header');
    expect(html).toContain('Mount Rainier');
    expect(html).toContain('[Moderate]');
    expect(html).toContain('font-weight: bold');
  });

  it('renders description', () => {
    const entries = [{
      dateStr: 'Fri, Jun 12',
      trail: mockTrail,
      trailDetails: { 'trail-1': { fullDescription: 'Beautiful trail.' } },
      earlyStart: false,
    }];
    const html = generateReportHtml(entries, 'Title');
    expect(html).toContain('Beautiful trail.');
  });

  it('renders web link as clickable blue anchor', () => {
    const entries = [{ dateStr: 'Fri, Jun 12', trail: mockTrail, trailDetails: null, earlyStart: false }];
    const html = generateReportHtml(entries, 'Title');
    expect(html).toContain('<a href="https://example.com/rainier"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('color: blue');
  });

  it('renders TBD for missing trail', () => {
    const entries = [{ dateStr: 'Wed, Jun 10', trail: null, trailDetails: null, earlyStart: false }];
    const html = generateReportHtml(entries, 'Title');
    expect(html).toContain('TBD');
  });

  it('includes (Early Start) when earlyStart is true', () => {
    const entries = [{ dateStr: 'Fri, Jun 12', trail: mockTrail, trailDetails: null, earlyStart: true }];
    const html = generateReportHtml(entries, 'Title');
    expect(html).toContain('(Early Start)');
  });

  it('escapes HTML special characters in description', () => {
    const entries = [{
      dateStr: 'Fri, Jun 12',
      trail: mockTrail,
      trailDetails: { 'trail-1': { fullDescription: 'Use & enjoy <the> trail.' } },
      earlyStart: false,
    }];
    const html = generateReportHtml(entries, 'Title');
    expect(html).toContain('&amp;');
    expect(html).toContain('&lt;the&gt;');
  });
});
