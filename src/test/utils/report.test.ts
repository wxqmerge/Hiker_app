import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateReportHtml, getRideCost, copyToClipboard } from '../../utils/report';

describe('getRideCost', () => {
  it('returns ride-$3 for range < 30', () => {
    expect(getRideCost(10)).toBe('ride-$3');
    expect(getRideCost(25)).toBe('ride-$3');
    expect(getRideCost(29)).toBe('ride-$3');
  });

  it('returns ride-$5 for range 30-59', () => {
    expect(getRideCost(30)).toBe('ride-$5');
    expect(getRideCost(45)).toBe('ride-$5');
    expect(getRideCost(59)).toBe('ride-$5');
  });

  it('returns ride-$7 for range 60-89', () => {
    expect(getRideCost(60)).toBe('ride-$7');
    expect(getRideCost(75)).toBe('ride-$7');
    expect(getRideCost(89)).toBe('ride-$7');
  });

  it('returns ride-$10 for range >= 90', () => {
    expect(getRideCost(90)).toBe('ride-$10');
    expect(getRideCost(100)).toBe('ride-$10');
    expect(getRideCost(120)).toBe('ride-$10');
  });

  it('returns null for invalid range', () => {
    expect(getRideCost(0)).toBeNull();
    expect(getRideCost(-1)).toBeNull();
    expect(getRideCost(null)).toBeNull();
    expect(getRideCost(undefined)).toBeNull();
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

  it('generates valid HTML document', () => {
    const entries = [{ dateStr: '2024-01-15', trail: mockTrail, trailDetails: null, earlyStart: false }];
    const html = generateReportHtml(entries, 'Test Schedule');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<title>Test Schedule</title>');
    expect(html).toContain('<h1>Test Schedule</h1>');
  });

  it('includes trail info in entry', () => {
    const entries = [{ dateStr: '2024-01-15', trail: mockTrail, trailDetails: null, earlyStart: false }];
    const html = generateReportHtml(entries, 'Test Schedule');
    expect(html).toContain('Mount Rainier');
    expect(html).toContain('2024-01-15');
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

  it('includes early start marker', () => {
    const entries = [{ dateStr: '2024-01-15', trail: mockTrail, trailDetails: null, earlyStart: true }];
    const html = generateReportHtml(entries, 'Test Schedule');
    expect(html).toContain('early-start');
  });

  it('includes description', () => {
    const entries = [{ dateStr: '2024-01-15', trail: mockTrail, trailDetails: { 'trail-1': { fullDescription: 'A beautiful trail' } }, earlyStart: false }];
    const html = generateReportHtml(entries, 'Test Schedule');
    expect(html).toContain('A beautiful trail');
  });

  it('includes web link', () => {
    const trailWithLink = { ...mockTrail, webLink: 'https://example.com' };
    const entries = [{ dateStr: '2024-01-15', trail: trailWithLink, trailDetails: null, earlyStart: false }];
    const html = generateReportHtml(entries, 'Test Schedule');
    expect(html).toContain('entry-link');
    expect(html).toContain('https://example.com');
  });

  it('includes GPX availability', () => {
    const trailWithGpx = { ...mockTrail, hasGpx: true };
    const entries = [{ dateStr: '2024-01-15', trail: trailWithGpx, trailDetails: null, earlyStart: false }];
    const html = generateReportHtml(entries, 'Test Schedule');
    expect(html).toContain('GPX: available');
  });

  it('handles TBD entry', () => {
    const entries = [{ dateStr: '2024-01-15', trail: null, trailDetails: null, earlyStart: false }];
    const html = generateReportHtml(entries, 'Test Schedule');
    expect(html).toContain('TBD');
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

  it('escapes HTML special characters', () => {
    const trailWithSpecial = { ...mockTrail, fullName: 'Test <Trail> & "Full"' };
    const entries = [{ dateStr: '2024-01-15', trail: trailWithSpecial, trailDetails: null, earlyStart: false }];
    const html = generateReportHtml(entries, 'Test Schedule');
    expect(html).not.toContain('<Trail>');
    expect(html).toContain('&lt;Trail&gt;');
  });

  it('handles multiple entries', () => {
    const entries = [
      { dateStr: '2024-01-15', trail: mockTrail, trailDetails: null, earlyStart: false },
      { dateStr: '2024-01-22', trail: mockTrail, trailDetails: null, earlyStart: false },
    ];
    const html = generateReportHtml(entries, 'Test Schedule');
    expect(html).toContain('2024-01-15');
    expect(html).toContain('2024-01-22');
  });
});

describe('copyToClipboard', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

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

  it('copies text to clipboard', async () => {
    const setCopied = vi.fn();
    const showToast = vi.fn();
    const result = await copyToClipboard('test text', setCopied, showToast);
    expect(result).toBe(true);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test text');
    expect(setCopied).toHaveBeenCalledWith(true);
    expect(showToast).toHaveBeenCalledWith('Trail report copied to clipboard', 'success');
  });

  it('handles clipboard error', async () => {
    (navigator.clipboard.writeText as any).mockRejectedValueOnce(new Error('Failed'));
    const setCopied = vi.fn();
    const showToast = vi.fn();
    const result = await copyToClipboard('test text', setCopied, showToast);
    expect(result).toBe(false);
    expect(showToast).toHaveBeenCalledWith('Failed to copy to clipboard', 'error');
  });

  it('works without setCopied', async () => {
    const showToast = vi.fn();
    const result = await copyToClipboard('test text', null, showToast);
    expect(result).toBe(true);
  });

  it('works without showToast', async () => {
    const setCopied = vi.fn();
    const result = await copyToClipboard('test text', setCopied, null);
    expect(result).toBe(true);
  });
});
