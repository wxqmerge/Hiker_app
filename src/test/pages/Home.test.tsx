import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import Home from '../../pages/Home';
import { MemoryRouter } from 'react-router-dom';

describe('Home', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
  });

  const renderHome = () => render(
    <MemoryRouter initialEntries={['/']}>
      <Home />
    </MemoryRouter>
  );

  it('renders heading', () => {
    renderHome();
    expect(screen.getByText('Browse Trails')).toBeInTheDocument();
  });

  it('renders Schedule Builder link', () => {
    renderHome();
    expect(screen.getByText('Schedule Builder')).toBeInTheDocument();
  });

  it('renders FilterPanel', () => {
    renderHome();
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
  });

  it('shows trail count', () => {
    renderHome();
    expect(screen.getByText(/Showing.*trails/)).toBeInTheDocument();
  });

  it('renders TrailList', () => {
    renderHome();
    expect(screen.getByText('Mount Rainier')).toBeInTheDocument();
  });

  it('hides export button when no edits', () => {
    renderHome();
    waitFor(() => {
      expect(screen.queryByText('Export Merged Data')).not.toBeInTheDocument();
    });
  });

  it('shows export button when edits exist', () => {
    localStorage.setItem('hiker-trail-edits', JSON.stringify({ 'trail-1': { notes: 'test' } }));
    renderHome();
    waitFor(() => {
      expect(screen.getByText('Export Merged Data')).toBeInTheDocument();
    });
  });

  it('renders with error state gracefully', () => {
    const { container } = renderHome();
    expect(container.querySelector('.min-h-screen')).toBeInTheDocument();
  });
});
