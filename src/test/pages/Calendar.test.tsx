import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Calendar from '../../pages/Calendar';

vi.mock('../../hooks/useTrails', () => ({
  useTrails: () => ({
    trails: [],
    trailDetails: {},
    loading: false,
    lookup: { difficulties: [] },
    schedule: {},
  }),
}));

vi.mock('../../hooks/useSchedulePolling', () => ({
  useSchedulePolling: vi.fn(),
}));

vi.mock('../../hooks/useTooltips', () => ({
  useTooltips: () => ({ title: vi.fn((s: string) => s) }),
}));

vi.mock('../../hooks/useNextHike', () => ({
  useNextHike: () => null,
}));

vi.mock('../../hooks/useMonthSlotStats', () => ({
  useMonthSlotStats: () => [],
}));

vi.mock('../../hooks/useApiKey', () => ({
  useApiKey: () => false,
}));

vi.mock('../../hooks/useScheduleData', () => ({
  useScheduleData: () => ({
    assignedHikes: {},
    assignedCount: 0,
    hikeDates: [],
    findTrailById: vi.fn(),
    trailIndexToId: {},
    dragData: null,
    setDragData: vi.fn(),
    handleDragStart: vi.fn(),
    handleDragEnd: vi.fn(),
  }),
}));

vi.mock('../../hooks/useScheduleDragDrop', () => ({
  useScheduleDragDrop: () => ({
    confirmSwap: vi.fn(),
    cancelSwap: vi.fn(),
  }),
}));

vi.mock('../../utils/scheduleFormat', () => ({
  serverScheduleToStore: () => ({}),
  storeToServerSchedule: () => ({}),
}));

vi.mock('../../api/client', () => ({
  updateSchedule: vi.fn(),
}));

vi.mock('../../hooks/useTrailStore', () => ({
  setSchedule: vi.fn(),
}));

describe('Calendar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).__APP_VERSION = '1.0.0';
  });

  const renderWithRouter = (ui: React.ReactElement) =>
    render(<MemoryRouter>{ui}</MemoryRouter>);

  it('renders PageNav', () => {
    renderWithRouter(<Calendar />);
    expect(screen.getByText('Calendar')).toBeInTheDocument();
  });

  it('renders MonthSelector', () => {
    renderWithRouter(<Calendar />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('shows no hikes assigned message when empty', () => {
    renderWithRouter(<Calendar />);
    const text = document.body.textContent || '';
    expect(text).toContain('Assigned Hikes');
  });

  it('renders main container', () => {
    const { container } = renderWithRouter(<Calendar />);
    expect(container.querySelector('.min-h-screen')).toBeInTheDocument();
  });

  it('renders ScheduledCards', () => {
    renderWithRouter(<Calendar />);
    expect(screen.getByText(/Assigned Hikes/)).toBeInTheDocument();
  });
});
