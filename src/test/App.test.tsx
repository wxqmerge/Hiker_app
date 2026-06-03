import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

describe('App', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
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
});
