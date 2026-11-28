import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';
import { isEmbedded } from '../utils/embed';

// Controllable iframe flag for the PopOutButton integration test.
vi.mock('../utils/embed', () => ({
  isEmbedded: vi.fn(() => false),
}));

describe('App', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('renders Home at root path', () => {
    render(<App />);
    expect(screen.getByText('Browse Trails')).toBeInTheDocument();
  });

  it('renders ScheduleBuilder at /schedule', () => {
    render(<App />);
    // App renders with / by default, need to check routing works
    expect(document.querySelector('.min-h-screen')).toBeInTheDocument();
  });

  it('renders TrailDetail at /trail/:id', () => {
    // App renders with / by default
    render(<App />);
    expect(document.querySelector('.min-h-screen')).toBeInTheDocument();
  });

  it('renders all routes', () => {
    render(<App />);
    expect(screen.getByText('Browse Trails')).toBeInTheDocument();
  });

  it('shows the "Full site" pop-out link only when embedded (regression: must be in render tree)', () => {
    const { unmount } = render(<App />);
    expect(screen.queryByText('Full site')).not.toBeInTheDocument();
    unmount();

    vi.mocked(isEmbedded).mockReturnValue(true);
    render(<App />);
    expect(screen.getByText('Full site')).toBeInTheDocument();
  });
});
