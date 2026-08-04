import { describe, it, expect, vi } from 'vitest';
import { generateReportText, generateReportHtml, getRideCost, copyToClipboard } from '../../utils/report';

describe('getRideCost', () => {
  it('returns ride-$3 for range < 30', () => {
    expect(getRideCost(25)).toBe('ride-$3');
  });

  it('returns ride-$5 for range 30-59', () => {
    expect(getRideCost(45)).toBe('ride-$5');
  });

  it('returns ride-$7 for range 60-89', () => {
    expect(getRideCost(75)).toBe('ride-$7');
  });

  it('returns ride-$10 for range >= 90', () => {
    expect(getRideCost(100)).toBe('ride-$10');
  });

  it('returns null for invalid range', () => {
    expect(getRideCost(0)).toBeNull();
    expect(getRideCost(null)).toBeNull();
    expect(getRideCost(undefined)).toBeNull();
  });
});

describe('generateReportText', () => {
  const trail = {
    id: 'test-trail',
    name: 'Test Trail',
    fullName: 'Test Trail Full',
    difficulty: 'Moderate',
    distance: 5.5,
    elevationStart: 1000,
    elevationMax: 2500,
    parking: 'Free',
    range: 45,
  };

  it('generates report with trail info', () => {
    const report = generateReportText(trail);
    expect(report).toContain('Test Trail Full');
    expect(report).toContain('[Moderate]');
    expect(report).toContain('5.5');
    expect(report).toContain("1,000'");
    expect(report).toContain('Free');
    expect(report).toContain('ride-$5');
  });

  it('includes early start marker', () => {
    const report = generateReportText(trail, null, true);
    expect(report).toContain('Early Start');
  });

  it('includes description from trailDetails', () => {
    const details = { 'test-trail': { fullDescription: 'A beautiful trail' } };
    const report = generateReportText(trail, details);
    expect(report).toContain('A beautiful trail');
  });

  it('includes web link', () => {
    const trailWithLink = { ...trail, webLink: 'https://example.com' };
    const report = generateReportText(trailWithLink);
    expect(report).toContain('Link: https://example.com');
  });

  it('includes GPX availability', () => {
    const trailWithGpx = { ...trail, hasGpx: true };
    const report = generateReportText(trailWithGpx);
    expect(report).toContain('GPX: available');
  });

  it('handles missing trail details', () => {
    const report = generateReportText(trail, {});
    expect(report).not.toContain('undefined');
  });
});

describe('generateReportHtml', () => {
  const trail = {
    id: 'test-trail',
    name: 'Test Trail',
    fullName: 'Test Trail Full',
    difficulty: 'Moderate',
    distance: 5.5,
    elevationStart: 1000,
    elevationMax: 2500,
    parking: 'Free',
    range: 45,
  };

  it('generates valid HTML document', () => {
    const entries = [{ dateStr: '2024-01-15', trail, trailDetails: null, earlyStart: false }];
    const html = generateReportHtml(entries, 'Test Schedule');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<title>Test Schedule</title>');
    expect(html).toContain('<h1>Test Schedule</h1>');
  });

  it('includes trail info in entry', () => {
    const entries = [{ dateStr: '2024-01-15', trail, trailDetails: null, earlyStart: false }];
    const html = generateReportHtml(entries, 'Test Schedule');
    expect(html).toContain('Test Trail Full');
    expect(html).toContain('2024-01-15');
  });

  it('includes early start marker', () => {
    const entries = [{ dateStr: '2024-01-15', trail, trailDetails: null, earlyStart: true }];
    const html = generateReportHtml(entries, 'Test Schedule');
    expect(html).toContain('early-start');
  });

  it('includes description', () => {
    const entries = [{ dateStr: '2024-01-15', trail, trailDetails: { 'test-trail': { fullDescription: 'A beautiful trail' } }, earlyStart: false }];
    const html = generateReportHtml(entries, 'Test Schedule');
    expect(html).toContain('A beautiful trail');
  });

  it('includes web link', () => {
    const trailWithLink = { ...trail, webLink: 'https://example.com' };
    const entries = [{ dateStr: '2024-01-15', trail: trailWithLink, trailDetails: null, earlyStart: false }];
    const html = generateReportHtml(entries, 'Test Schedule');
    expect(html).toContain('entry-link');
    expect(html).toContain('https://example.com');
  });

  it('includes GPX availability', () => {
    const trailWithGpx = { ...trail, hasGpx: true };
    const entries = [{ dateStr: '2024-01-15', trail: trailWithGpx, trailDetails: null, earlyStart: false }];
    const html = generateReportHtml(entries, 'Test Schedule');
    expect(html).toContain('GPX: available');
  });

  it('handles TBD entry', () => {
    const entries = [{ dateStr: '2024-01-15', trail: null, trailDetails: null, earlyStart: false }];
    const html = generateReportHtml(entries, 'Test Schedule');
    expect(html).toContain('TBD');
  });

  it('escapes HTML special characters', () => {
    const trailWithSpecial = { ...trail, fullName: 'Test <Trail> & "Full"' };
    const entries = [{ dateStr: '2024-01-15', trail: trailWithSpecial, trailDetails: null, earlyStart: false }];
    const html = generateReportHtml(entries, 'Test Schedule');
    expect(html).not.toContain('<Trail>');
    expect(html).toContain('&lt;Trail&gt;');
  });

  it('handles multiple entries', () => {
    const entries = [
      { dateStr: '2024-01-15', trail, trailDetails: null, earlyStart: false },
      { dateStr: '2024-01-22', trail, trailDetails: null, earlyStart: false },
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
