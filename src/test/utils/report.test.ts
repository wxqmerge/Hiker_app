import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateReportHtml, generateDescriptionsPrintHtml, generatePrintableScheduleHtml, getRideCost, copyToClipboard } from '../../utils/report';

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
    const entries = [{ dateStr: '2024-01-15', trail: mockTrail, trailDetails: null, earlyStart: 0 }];
    const html = generateReportHtml(entries, 'Test Schedule');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<title>Test Schedule</title>');
    expect(html).toContain('<h1>Test Schedule</h1>');
  });

  it('includes trail info in entry', () => {
    const entries = [{ dateStr: '2024-01-15', trail: mockTrail, trailDetails: null, earlyStart: 0 }];
    const html = generateReportHtml(entries, 'Test Schedule');
    expect(html).toContain('Mount Rainier');
    expect(html).toContain('2024-01-15');
  });

  it('renders trail header line in bold', () => {
    const entries = [{ dateStr: 'Fri, Jun 12', trail: mockTrail, trailDetails: null, earlyStart: 0 }];
    const html = generateReportHtml(entries, 'Title');
    expect(html).toContain('entry-header');
    expect(html).toContain('Mount Rainier');
    expect(html).toContain('[Moderate]');
    expect(html).toContain('font-weight: bold');
  });

  it('adds the wilderness ◆ marker only for trails whose name has it', () => {
    const plain = [{ dateStr: 'Fri, Jun 12', trail: mockTrail, trailDetails: null, earlyStart: 0 }];
    expect(generateReportHtml(plain, 'Title')).not.toContain('\u25C6');

    const wild = { ...mockTrail, id: 'trail-w', fullName: '\u25C6 Wilderness Peak' };
    const wildEntries = [{ dateStr: 'Fri, Jun 12', trail: wild, trailDetails: null, earlyStart: 0 }];
    const html = generateReportHtml(wildEntries, 'Title');
    expect(html).toContain('Wilderness Peak\u25C6');
  });

  it('renders description', () => {
    const entries = [{
      dateStr: 'Fri, Jun 12',
      trail: mockTrail,
      trailDetails: { 'trail-1': { fullDescription: 'Beautiful trail.' } },
      earlyStart: 0,
    }];
    const html = generateReportHtml(entries, 'Title');
    expect(html).toContain('Beautiful trail.');
  });

  it('renders web link as clickable blue anchor', () => {
    const entries = [{ dateStr: 'Fri, Jun 12', trail: mockTrail, trailDetails: null, earlyStart: 0 }];
    const html = generateReportHtml(entries, 'Title');
    expect(html).toContain('<a href="https://example.com/rainier"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('color: blue');
  });

  it('renders TBD for missing trail', () => {
    const entries = [{ dateStr: 'Wed, Jun 10', trail: null, trailDetails: null, earlyStart: 0 }];
    const html = generateReportHtml(entries, 'Title');
    expect(html).toContain('TBD');
  });

  it('includes (30m early) when earlyStart is -30', () => {
    const entries = [{ dateStr: 'Fri, Jun 12', trail: mockTrail, trailDetails: null, earlyStart: -30 }];
    const html = generateReportHtml(entries, 'Title');
    expect(html).toContain('(30m early)');
  });

  it('includes early start marker', () => {
    const entries = [{ dateStr: '2024-01-15', trail: mockTrail, trailDetails: null, earlyStart: -30 }];
    const html = generateReportHtml(entries, 'Test Schedule');
    expect(html).toContain('early-start');
  });

  it('includes description', () => {
    const entries = [{ dateStr: '2024-01-15', trail: mockTrail, trailDetails: { 'trail-1': { fullDescription: 'A beautiful trail' } }, earlyStart: 0 }];
    const html = generateReportHtml(entries, 'Test Schedule');
    expect(html).toContain('A beautiful trail');
  });

  it('includes web link', () => {
    const trailWithLink = { ...mockTrail, webLink: 'https://example.com' };
    const entries = [{ dateStr: '2024-01-15', trail: trailWithLink, trailDetails: null, earlyStart: 0 }];
    const html = generateReportHtml(entries, 'Test Schedule');
    expect(html).toContain('entry-link');
    expect(html).toContain('https://example.com');
  });

  it('omits javascript: web links instead of emitting executable hrefs', () => {
    const evilTrail = { ...mockTrail, webLink: 'javascript:alert(1)' };
    const entries = [{ dateStr: '2024-01-15', trail: evilTrail, trailDetails: null, earlyStart: 0 }];
    const html = generateReportHtml(entries, 'Test Schedule');
    expect(html).not.toContain('href="javascript:');
    expect(html).not.toContain('<div class="entry-link">');
  });

  it('omits data: web links', () => {
    const evilTrail = { ...mockTrail, webLink: 'data:text/html,<script>alert(1)</script>' };
    const entries = [{ dateStr: '2024-01-15', trail: evilTrail, trailDetails: null, earlyStart: 0 }];
    const html = generateReportHtml(entries, 'Test Schedule');
    expect(html).not.toContain('href="data:');
  });

  it('includes GPX availability', () => {
    const trailWithGpx = { ...mockTrail, hasGpx: true };
    const entries = [{ dateStr: '2024-01-15', trail: trailWithGpx, trailDetails: null, earlyStart: 0 }];
    const html = generateReportHtml(entries, 'Test Schedule');
    expect(html).toContain('GPX: available');
  });

  it('handles TBD entry', () => {
    const entries = [{ dateStr: '2024-01-15', trail: null, trailDetails: null, earlyStart: 0 }];
    const html = generateReportHtml(entries, 'Test Schedule');
    expect(html).toContain('TBD');
  });

  it('escapes HTML special characters in description', () => {
    const entries = [{
      dateStr: 'Fri, Jun 12',
      trail: mockTrail,
      trailDetails: { 'trail-1': { fullDescription: 'Use & enjoy <the> trail.' } },
      earlyStart: 0,
    }];
    const html = generateReportHtml(entries, 'Title');
    expect(html).toContain('&amp;');
    expect(html).toContain('&lt;the&gt;');
  });

  it('escapes HTML special characters', () => {
    const trailWithSpecial = { ...mockTrail, fullName: 'Test <Trail> & "Full"' };
    const entries = [{ dateStr: '2024-01-15', trail: trailWithSpecial, trailDetails: null, earlyStart: 0 }];
    const html = generateReportHtml(entries, 'Test Schedule');
    expect(html).not.toContain('<Trail>');
    expect(html).toContain('&lt;Trail&gt;');
  });

  it('handles multiple entries', () => {
    const entries = [
      { dateStr: '2024-01-15', trail: mockTrail, trailDetails: null, earlyStart: 0 },
      { dateStr: '2024-01-22', trail: mockTrail, trailDetails: null, earlyStart: 0 },
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

describe('generateDescriptionsPrintHtml', () => {
  const trail = {
    id: 'trail-1', name: 'Rainier', fullName: 'Mount Rainier', difficulty: 'Moderate',
    distance: 5.5, distanceExtended: 6.0, elevationStart: 2000, elevationMax: 4000,
    parking: 'Lot', range: 45, webLink: 'https://example.com/rainier', hasGpx: true,
  };

  it('renders month sections with report-format entries', () => {
    const html = generateDescriptionsPrintHtml({
      title: 'Club Hike Descriptions',
      monthGroups: [{
        label: 'November, 2026',
        entries: [{ dateStr: 'Wed, November 4', trail, trailDetails: null, earlyStart: -50 }],
      }],
    });
    expect(html).toContain('November, 2026');
    expect(html).toContain('Wed, November 4');
    expect(html).toContain('Mount Rainier');
    expect(html).toContain('(50m early)');
    expect(html).toContain('GPX: available');
  });

  it('shows an empty-month message and the footer notes', () => {
    const html = generateDescriptionsPrintHtml({
      title: 'Club Hike Descriptions',
      monthGroups: [{ label: 'December, 2026', entries: [] }],
      notes: [
        { heading: 'NOTE:', text: 'Always carry your Hiking Essentials.' },
        { heading: 'WILDERNESS HIKE:', text: 'Any hike with a \u25C6\uFE0E goes into the Wilderness.' },
      ],
    });
    expect(html).toContain('No hikes scheduled.');
    expect(html).toContain('Always carry your Hiking Essentials.');
    expect(html).toContain('WILDERNESS HIKE:');
  });

  it('includes print CSS with a no-print toolbar', () => {
    const html = generateDescriptionsPrintHtml({ title: 'T', monthGroups: [] });
    expect(html).toContain('@media print');
    expect(html).toContain('break-inside: avoid');
    expect(html).toContain('class="toolbar no-print"');
  });
});

describe('generatePrintableScheduleHtml', () => {
  it('renders one row per hike with leader and early-start', () => {
    const html = generatePrintableScheduleHtml({
      title: 'Club Hiking Schedule',
      monthGroups: [{
        label: 'November, 2026',
        rows: [
          { dateStr: 'Wed, November 4', trailName: 'Madison Falls\u25C6\uFE0E', difficulty: '[Easy to Mod]', earlyLabel: '45m early', leader: 'Al' },
          { dateStr: 'Fri, November 6', trailName: 'Burnt Hill', difficulty: '[Mod to Diff]', earlyLabel: '', leader: '' },
        ],
      }],
    });
    expect(html).toContain('November, 2026');
    expect(html).toContain('<td class="date">Wed, November 4</td>');
    expect(html).toContain('Leader: Al');
    expect(html).toContain('(45m early)');
    expect(html).toContain('Burnt Hill');
  });

  it('handles an empty month', () => {
    const html = generatePrintableScheduleHtml({
      title: 'T',
      monthGroups: [{ label: 'December, 2026', rows: [] }],
    });
    expect(html).toContain('No hikes scheduled.');
  });
});
