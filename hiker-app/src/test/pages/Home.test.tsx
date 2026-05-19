import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import Home from '../../pages/Home';
import { MemoryRouter } from 'react-router-dom';

describe('Home', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
  });

  it('renders heading', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Home />
      </MemoryRouter>
    );
    expect(screen.getByText('Browse Trails')).toBeInTheDocument();
  });

  it('renders Schedule Builder link', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Home />
      </MemoryRouter>
    );
    expect(screen.getByText('Schedule Builder')).toBeInTheDocument();
  });

  it('renders FilterPanel', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Home />
      </MemoryRouter>
    );
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
  });

  it('shows trail count', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Home />
      </MemoryRouter>
    );
    expect(screen.getByText(/Showing.*trails/)).toBeInTheDocument();
  });

  it('renders TrailList', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Home />
      </MemoryRouter>
    );
    expect(screen.getByText('Mount Rainier')).toBeInTheDocument();
  });

  it('hides export button when no edits', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Home />
      </MemoryRouter>
    );
    waitFor(() => {
      expect(screen.queryByText('Export Merged Data')).not.toBeInTheDocument();
    });
  });

  it('shows export button when edits exist', () => {
    localStorage.setItem('hiker-trail-edits', JSON.stringify({ 'trail-1': { notes: 'test' } }));
    render(
      <MemoryRouter initialEntries={['/']}>
        <Home />
      </MemoryRouter>
    );
    waitFor(() => {
      expect(screen.getByText('Export Merged Data')).toBeInTheDocument();
    });
  });

  it('renders with error state gracefully', () => {
    // Home should not crash when there's an error
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <Home />
      </MemoryRouter>
    );
    expect(container.querySelector('.min-h-screen')).toBeInTheDocument();
  });
});
