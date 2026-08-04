import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import GPXHelp from '../../components/GPXHelp';

vi.mock('../../utils/device', () => ({
  getDevicePlatform: vi.fn(() => 'windows'),
}));

describe('GPXHelp', () => {
  it('renders with "Get Maps" text', () => {
    render(<GPXHelp />);
    expect(screen.getByText('Get Maps')).toBeInTheDocument();
  });

  it('has correct link for windows platform', () => {
    render(<GPXHelp />);
    const link = screen.getByText('Get Maps').closest('a');
    expect(link).toHaveAttribute('href', 'https://www.gpxsee.org/');
  });

  it('has target="_blank" and rel attributes', () => {
    render(<GPXHelp />);
    const link = screen.getByText('Get Maps').closest('a');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('uses light variant styles by default', () => {
    render(<GPXHelp />);
    const link = screen.getByText('Get Maps').closest('a');
    expect(link).toHaveClass('bg-gray-100');
  });

  it('uses dark variant styles', () => {
    render(<GPXHelp variant="dark" />);
    const link = screen.getByText('Get Maps').closest('a');
    expect(link).toHaveClass('bg-white/10');
  });

  it('falls back to light variant for unknown variant', () => {
    render(<GPXHelp variant="unknown" />);
    const link = screen.getByText('Get Maps').closest('a');
    expect(link).toHaveClass('bg-gray-100');
  });
});
