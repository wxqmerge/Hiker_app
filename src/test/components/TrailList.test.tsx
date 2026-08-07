import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TrailList from '../../components/TrailList';

describe('TrailList', () => {
  const mockTrails = globalThis.__TEST_MOCK_DATA__.trails.slice(0, 2).map(t => ({ ...t, seasonal: {} }));

  beforeEach(() => {
    vi.resetAllMocks();
    delete window.__EMBEDDED_DATA__;
  });

  it('renders all trails', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <TrailList trails={mockTrails} />
      </MemoryRouter>
    );
    expect(screen.getByText('Mount Rainier')).toBeInTheDocument();
    expect(screen.getByText('Stevens Ridge')).toBeInTheDocument();
  });

  it('renders empty state when no trails', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <TrailList trails={[]} />
      </MemoryRouter>
    );
    expect(screen.getByText('No trails found')).toBeInTheDocument();
    expect(screen.getByText('Try adjusting your filters or search terms.')).toBeInTheDocument();
  });

  it('renders correct number of cards', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <TrailList trails={mockTrails} />
      </MemoryRouter>
    );
    const cards = container.querySelectorAll('[class*="rounded-lg shadow-sm"]');
    expect(cards.length).toBe(2);
  });

  it('links to each trail detail page', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <TrailList trails={mockTrails} />
      </MemoryRouter>
    );
    const links = screen.getAllByRole('link');
    expect(links.length).toBeGreaterThanOrEqual(2);
    const trailLinks = links.filter(l => l.getAttribute('href')?.startsWith('/trail/'));
    expect(trailLinks.length).toBeGreaterThanOrEqual(2);
    expect(trailLinks[0]).toHaveAttribute('href', '/trail/trail-1');
    expect(trailLinks[1]).toHaveAttribute('href', '/trail/trail-2');
  });

  it('renders Report buttons for each trail', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <TrailList trails={mockTrails} />
      </MemoryRouter>
    );
    const buttons = screen.getAllByText('Report');
    expect(buttons.length).toBe(2);
  });

  it('renders responsive grid', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <TrailList trails={mockTrails} />
      </MemoryRouter>
    );
    expect(container.firstChild).toHaveClass('grid');
  });
});
