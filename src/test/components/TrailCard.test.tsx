import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TrailCard from '../../components/TrailCard';

describe('TrailCard', () => {
  const baseTrail = { ...globalThis.__TEST_MOCK_DATA__.trails[0], distanceExtended: 6.0, elevationMax: 4000, range: 45 };

  beforeEach(() => {
    vi.resetAllMocks();
    delete window.__EMBEDDED_DATA__;
  });

  const renderWithRouter = (trail = baseTrail, isActive = false) => {
    return render(
      <MemoryRouter initialEntries={['/trail/trail-1']}>
        <TrailCard trail={trail} isActive={isActive} />
      </MemoryRouter>
    );
  };

  it('renders trail name', () => {
    renderWithRouter();
    expect(screen.getByText('Mount Rainier')).toBeInTheDocument();
  });

  it('renders difficulty badge', () => {
    renderWithRouter();
    expect(screen.getByText('Moderate')).toBeInTheDocument();
  });

  it('renders distance', () => {
    renderWithRouter();
    expect(screen.getByText('5.5 mi / 6.0 mi')).toBeInTheDocument();
  });

  it('renders elevation', () => {
    renderWithRouter();
    expect(screen.getByText("2,000' - 4,000'")).toBeInTheDocument();
  });

  it('renders parking', () => {
    renderWithRouter();
    expect(screen.getByText('Lot')).toBeInTheDocument();
  });

  it('renders ride cost', () => {
    renderWithRouter();
    expect(screen.getByText('ride-$5')).toBeInTheDocument();
  });

  it('renders seasonal months', () => {
    renderWithRouter();
    expect(screen.getByText('Jan, Feb, Mar')).toBeInTheDocument();
  });

  it('does not render seasonal section when no seasonal data', () => {
    render(
      <MemoryRouter initialEntries={['/trail/trail-1']}>
        <TrailCard trail={{ id: 't1', name: 'Test', fullName: 'Test Trail', distance: 1, difficulty: 'Easy', parking: '', seasonal: {} }} />
      </MemoryRouter>
    );
    expect(screen.queryByText('Year-round')).not.toBeInTheDocument();
    expect(screen.queryByText('Jan, Feb, Mar')).not.toBeInTheDocument();
  });

  it('links to trail detail page', () => {
    renderWithRouter();
    const link = screen.getByRole('link', { name: /Mount Rainier/i });
    expect(link).toHaveAttribute('href', '/trail/trail-1');
  });

  it('renders Copy Report button', () => {
    renderWithRouter();
    expect(screen.getByText('Copy Report')).toBeInTheDocument();
  });

  it('uses fullName when available', () => {
    renderWithRouter();
    expect(screen.getByText('Mount Rainier')).toBeInTheDocument();
  });

  it('uses name when fullName is missing', () => {
    const trailNoFullName = { ...baseTrail, fullName: undefined };
    renderWithRouter(trailNoFullName);
    expect(screen.getByText('Rainier')).toBeInTheDocument();
  });

  it('shows N/A for missing distance', () => {
    const trailNoDistance = { ...baseTrail, distance: null, distanceExtended: null };
    renderWithRouter(trailNoDistance);
    expect(screen.getByText('N/A mi')).toBeInTheDocument();
  });

  it('renders elevation with null values', () => {
    const trailNoElevation = { ...baseTrail, elevationStart: null, elevationMax: null };
    renderWithRouter(trailNoElevation);
    // When elevationStart is null, toLocaleString returns undefined which renders as empty
    expect(screen.getByText(/'/)).toBeInTheDocument();
  });

  it('handles active state styling', () => {
    const { container } = renderWithRouter(baseTrail, true);
    expect(container.firstChild).toHaveClass('border-green-500');
  });

  it('handles missing parking', () => {
    const trailNoParking = { ...baseTrail, parking: '' };
    renderWithRouter(trailNoParking);
    expect(screen.queryByText('Lot')).not.toBeInTheDocument();
  });

  it('handles missing range', () => {
    const trailNoRange = { ...baseTrail, range: null };
    renderWithRouter(trailNoRange);
    expect(screen.queryByText('ride-$5')).not.toBeInTheDocument();
  });
});
