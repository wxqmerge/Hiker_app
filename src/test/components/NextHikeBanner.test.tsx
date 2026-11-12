import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NextHikeBanner from '../../components/NextHikeBanner';

const { mockHandleGpxShare } = vi.hoisted(() => ({ mockHandleGpxShare: vi.fn() }));

vi.mock('react-router-dom', () => ({
  Link: ({ to, children }) => <a href={to}>{children}</a>,
}));

vi.mock('../../api/client', () => ({
  getGpx: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../utils/io', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/io')>();
  return {
    ...actual,
    openWeatherUrl: vi.fn(),
    fetchWeatherAndTide: vi.fn(() => Promise.resolve(null)),
  };
});

vi.mock('../../hooks/useGpxActions', () => ({
  useGpxActions: vi.fn(() => ({
    handleGpxDownload: vi.fn(),
    handleGpxShare: mockHandleGpxShare,
    handleTrailhead: vi.fn(),
  })),
}));

vi.mock('../../components/GPXHelp', () => ({
  default: function MockGpxHelp() {
    return <div data-testid="gpx-help">GPX Help</div>;
  },
}));

describe('NextHikeBanner', () => {
  const trail = {
    id: 'trail-1',
    name: 'Test Trail',
    fullName: 'Test Trail Full',
    difficulty: 'Moderate',
    distance: 5.5,
    elevationStart: 1000,
    elevationMax: 2000,
    parking: 'Trailhead',
    range: 30,
    hasGpx: true,
    trailHeadLat: 47.0,
    trailHeadLon: -121.0,
  };

  const nextHikes = [
    {
      trailId: 'trail-1',
      trail,
      date: new Date(2024, 0, 15),
      monthIndex: 0,
      day: 15,
      leader: 'John',
      earlyStart: false,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when no next hikes', () => {
    const { container } = render(<NextHikeBanner nextHikes={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null for empty array', () => {
    const { container } = render(<NextHikeBanner nextHikes={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders trail name', () => {
    render(<NextHikeBanner nextHikes={nextHikes} />);
    expect(screen.getByText('Test Trail Full')).toBeInTheDocument();
  });

  it('renders difficulty badge', () => {
    render(<NextHikeBanner nextHikes={nextHikes} />);
    expect(screen.getByText('Moderate')).toBeInTheDocument();
  });

  it('renders day', () => {
    render(<NextHikeBanner nextHikes={nextHikes} />);
    expect(screen.getByText('15')).toBeInTheDocument();
  });

  it('renders leader info', () => {
    render(<NextHikeBanner nextHikes={nextHikes} />);
    expect(screen.getByText(/John/)).toBeInTheDocument();
  });

  it('renders early start badge', () => {
    const hikesWithEarly = [{ ...nextHikes[0], earlyStart: true }];
    render(<NextHikeBanner nextHikes={hikesWithEarly} />);
    expect(screen.getByText('8:00 AM (30m early)')).toBeInTheDocument();
  });

  it('renders distance', () => {
    render(<NextHikeBanner nextHikes={nextHikes} />);
    expect(screen.getByText('5.5 mi')).toBeInTheDocument();
  });

  it('renders low-tide chip when the day has an in-window low tide', async () => {
    const io = await import('../../utils/io');
    (io.fetchWeatherAndTide as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ temp: 60, rain: 10, tide: 0.5, tideTime: '10:53a', tideMode: 'low' });
    render(<NextHikeBanner nextHikes={nextHikes} />);
    await waitFor(() =>
      expect(screen.getByText('Low tide 10:53a · 0.5 ft')).toBeInTheDocument());
  });

  it('renders turnaround level chip with falling arrow on no-low-tide days', async () => {
    const io = await import('../../utils/io');
    (io.fetchWeatherAndTide as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ temp: 60, rain: 10, tide: 8.3, tideTime: '10:19a', tideMode: 'level', tideRising: false });
    render(<NextHikeBanner nextHikes={nextHikes} />);
    await waitFor(() =>
      expect(screen.getByText('Tide ~10:19a · 8.3 ft ↓')).toBeInTheDocument());
    expect(screen.queryByText(/^Low tide/)).not.toBeInTheDocument();
  });

  it('renders rising arrow for rising turnaround level', async () => {
    const io = await import('../../utils/io');
    (io.fetchWeatherAndTide as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ temp: 60, rain: 10, tide: 1.3, tideTime: '9:30a', tideMode: 'level', tideRising: true });
    render(<NextHikeBanner nextHikes={nextHikes} />);
    await waitFor(() =>
      expect(screen.getByText('Tide ~9:30a · 1.3 ft ↑')).toBeInTheDocument());
  });

  it('renders elevation', () => {
    render(<NextHikeBanner nextHikes={nextHikes} />);
    expect(screen.getByText('1000 ft - 2000 ft')).toBeInTheDocument();
  });

  it('renders parking info', () => {
    render(<NextHikeBanner nextHikes={nextHikes} />);
    expect(screen.getByText('Trailhead')).toBeInTheDocument();
  });

  it('renders GPX download button when available', () => {
    render(<NextHikeBanner nextHikes={nextHikes} />);
    expect(screen.getByText('GPX')).toBeInTheDocument();
  });

  it('renders GPX share button when available', () => {
    render(<NextHikeBanner nextHikes={nextHikes} />);
    expect(screen.getByText('Share')).toBeInTheDocument();
  });

  it('calls handleGpxShare when share button clicked', () => {
    render(<NextHikeBanner nextHikes={nextHikes} />);
    fireEvent.click(screen.getByText('Share'));
    expect(mockHandleGpxShare).toHaveBeenCalledTimes(1);
  });

  it('does not render share button when trail has no GPX', () => {
    const noGpxTrail = { ...trail, hasGpx: false };
    const hikes = [{ ...nextHikes[0], trail: noGpxTrail }];
    render(<NextHikeBanner nextHikes={hikes} />);
    expect(screen.queryByText('Share')).not.toBeInTheDocument();
  });

  it('renders trailhead button when GPX available', () => {
    render(<NextHikeBanner nextHikes={nextHikes} />);
    expect(screen.getByText('TH')).toBeInTheDocument();
  });

  it('renders weather button when GPX available', () => {
    render(<NextHikeBanner nextHikes={nextHikes} />);
    expect(screen.getByText('W')).toBeInTheDocument();
  });

  it('renders GPX help', () => {
    render(<NextHikeBanner nextHikes={nextHikes} />);
    expect(screen.getByTestId('gpx-help')).toBeInTheDocument();
  });

  it('renders day of week', () => {
    render(<NextHikeBanner nextHikes={nextHikes} />);
    expect(screen.getByText('Mon')).toBeInTheDocument();
  });
});
