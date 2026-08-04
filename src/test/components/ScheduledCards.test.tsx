import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ScheduledCards from '../../components/ScheduledCards';
import { getTrailName } from '../../utils/data';

vi.mock('../../utils/dateUtils', () => ({
  getDaysInMonth: vi.fn((year, month) => {
    const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return days[month];
  }),
  createDate: vi.fn((year, month, day) => {
    return new Date(year, month, day);
  }),
}));

vi.mock('../../utils/config', () => ({
  getHikeDays: vi.fn(() => [1]),
  getDayLabel: vi.fn(() => 'Mon'),
}));

vi.mock('../../components/TrailCard', () => ({
  default: function MockTrailCard({ trail, leader }) {
    return (
      <div data-testid="trail-card">
        <span>{getTrailName(trail)}</span>
        {leader && <span data-testid="leader">{leader}</span>}
      </div>
    );
  },
}));

describe('ScheduledCards', () => {
  const trail = {
    id: 'trail-1',
    name: 'Test Trail',
    fullName: 'Test Trail Full',
    difficulty: 'Moderate',
    distance: 5,
    elevationStart: 1000,
  };

  const findTrailById = vi.fn((id) => id === 'trail-1' ? trail : null);
  const trailIndexToId = { 0: 'trail-1' };
  const handleDragStart = vi.fn();
  const handleDragEnd = vi.fn();
  const onLeaderChange = vi.fn();
  const tt = vi.fn((s) => s);

  const props = {
    assignedHikes: {},
    trailIndexToId,
    findTrailById,
    year: 2024,
    selectedMonth: 0,
    hasApiKey: true,
    dragData: null,
    handleDragStart,
    handleDragEnd,
    onLeaderChange,
    tt,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows empty state when no hikes assigned', () => {
    render(<ScheduledCards {...props} />);
    expect(screen.getByText(/No hikes assigned for January/)).toBeInTheDocument();
  });

  it('shows assigned hikes count', () => {
    const hikeProps = {
      ...props,
      assignedHikes: { 1: [{ trail_id: 'trail-1', early_start: false, leader: null }] },
    };
    render(<ScheduledCards {...hikeProps} />);
    expect(screen.getByText('Assigned Hikes (1)')).toBeInTheDocument();
  });

  it('renders trail card for assigned hike', () => {
    const hikeProps = {
      ...props,
      assignedHikes: { 1: [{ trail_id: 'trail-1', early_start: false, leader: null }] },
    };
    render(<ScheduledCards {...hikeProps} />);
    expect(screen.getByText('Test Trail Full')).toBeInTheDocument();
  });

  it('renders day badge', () => {
    const hikeProps = {
      ...props,
      assignedHikes: { 1: [{ trail_id: 'trail-1', early_start: false, leader: null }] },
    };
    render(<ScheduledCards {...hikeProps} />);
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('renders early start badge', () => {
    const hikeProps = {
      ...props,
      assignedHikes: { 1: [{ trail_id: 'trail-1', early_start: true, leader: null }] },
    };
    render(<ScheduledCards {...hikeProps} />);
    expect(screen.getByText('⏰')).toBeInTheDocument();
  });

  it('renders leader info', () => {
    const hikeProps = {
      ...props,
      assignedHikes: { 1: [{ trail_id: 'trail-1', early_start: false, leader: 'John' }] },
    };
    render(<ScheduledCards {...hikeProps} />);
    expect(screen.getByTestId('leader')).toHaveTextContent('John');
  });

  it('handles multiple hikes on same day', () => {
    const hikeProps = {
      ...props,
      assignedHikes: {
        1: [
          { trail_id: 'trail-1', early_start: false, leader: null },
          { trail_id: 'trail-1', early_start: false, leader: null },
        ],
      },
    };
    render(<ScheduledCards {...hikeProps} />);
    expect(screen.getByText('Assigned Hikes (2)')).toBeInTheDocument();
  });

  it('skips entries without trail_id', () => {
    const hikeProps = {
      ...props,
      assignedHikes: { 1: [{ trail_id: null, early_start: false, leader: null }] },
    };
    render(<ScheduledCards {...hikeProps} />);
    expect(screen.getByText(/No hikes assigned/)).toBeInTheDocument();
  });

  it('skips entries with unknown trail', () => {
    const hikeProps = {
      ...props,
      assignedHikes: { 1: [{ trail_id: 'unknown', early_start: false, leader: null }] },
    };
    render(<ScheduledCards {...hikeProps} />);
    expect(screen.getByText(/No hikes assigned/)).toBeInTheDocument();
  });

  it('sets draggable when hasApiKey', () => {
    const hikeProps = {
      ...props,
      assignedHikes: { 1: [{ trail_id: 'trail-1', early_start: false, leader: null }] },
    };
    const { container } = render(<ScheduledCards {...hikeProps} />);
    const dragEl = container.querySelector('[draggable="true"]');
    expect(dragEl).toBeInTheDocument();
  });

  it('does not set draggable without apiKey', () => {
    const hikeProps = {
      ...props,
      hasApiKey: false,
      assignedHikes: { 1: [{ trail_id: 'trail-1', early_start: false, leader: null }] },
    };
    const { container } = render(<ScheduledCards {...hikeProps} />);
    const dragEl = container.querySelector('[draggable="true"]');
    expect(dragEl).not.toBeInTheDocument();
  });
});
