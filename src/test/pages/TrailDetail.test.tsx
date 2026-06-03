import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

describe('TrailDetail', () => {
  beforeEach(() => {
    localStorage.clear();
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
});
