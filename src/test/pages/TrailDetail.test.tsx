import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { openHtmlInNewTab } from '../../utils/io';

vi.mock('../../utils/io', () => ({
  openHtmlInNewTab: vi.fn(),
  downloadBlob: vi.fn(),
  exportTrailTsv: vi.fn(),
  createFileInput: vi.fn(),
  sanitizeFilename: vi.fn(),
}));

describe('TrailDetail', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders "Trail not found" for missing trail', async () => {
    const { default: TrailDetail } = await import('../../pages/TrailDetail');
    render(
      <MemoryRouter initialEntries={['/trail/nonexistent']}>
        <TrailDetail />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('Trail not found')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('renders Back to Browse link', async () => {
    const { default: TrailDetail } = await import('../../pages/TrailDetail');
    render(
      <MemoryRouter initialEntries={['/trail/nonexistent']}>
        <TrailDetail />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('Back to Browse')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('deletes the current trail after confirmation', async () => {
    localStorage.setItem('hiker-api-key', 'test-key');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { default: TrailDetail } = await import('../../pages/TrailDetail');
    render(
      <MemoryRouter initialEntries={['/trail/trail-1']}>
        <Routes>
          <Route path="/trail/:id" element={<TrailDetail />} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByTitle('Delete this trail')).toBeInTheDocument();
    }, { timeout: 3000 });
    fireEvent.click(screen.getByTitle('Delete this trail'));
    await waitFor(() => {
      expect(globalThis.fetch.mock.calls.some(([url, options]) => url === '/api/trails/trail-1' && options?.method === 'DELETE')).toBe(true);
    }, { timeout: 3000 });
  });

  it('includes the hike date in the report when opened from a card link', async () => {
    openHtmlInNewTab.mockClear();
    const { default: TrailDetail } = await import('../../pages/TrailDetail');
    render(
      <MemoryRouter initialEntries={['/trail/trail-1?date=2026-08-20']}>
        <Routes>
          <Route path="/trail/:id" element={<TrailDetail />} />
        </Routes>
      </MemoryRouter>
    );
    const reportButton = await waitFor(() => screen.getByTitle('Open trail report in new tab'), { timeout: 3000 });
    fireEvent.click(reportButton);
    await waitFor(() => {
      expect(openHtmlInNewTab).toHaveBeenCalled();
    }, { timeout: 3000 });
    const html = openHtmlInNewTab.mock.calls[0][0];
    expect(html).toContain('Thu, Aug 20');
    expect(html).toContain('Mount Rainier');
  });
});
