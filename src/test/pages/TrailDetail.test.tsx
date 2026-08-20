import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

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
});
