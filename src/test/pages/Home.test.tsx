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

  it('renders TrailList with trail names', () => {
    renderHome();
    expect(screen.getByText('Mount Rainier')).toBeInTheDocument();
  });

  it('renders Stevens Ridge trail', () => {
    renderHome();
    expect(screen.getByText('Stevens Ridge')).toBeInTheDocument();
  });

  it('renders FilterPanel', () => {
    renderHome();
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
  });

  it('shows trail count', () => {
    renderHome();
    expect(screen.getByText(/\d+ of \d+ trails/)).toBeInTheDocument();
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

  it('renders Easy Path trail', () => {
    renderHome();
    expect(screen.getByText('Easy Path Trail')).toBeInTheDocument();
  });
});
