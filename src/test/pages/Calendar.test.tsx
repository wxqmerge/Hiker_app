import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Calendar from '../../pages/Calendar';
import { MonthContextProvider } from '../../contexts/MonthContext';

vi.mock('../../hooks/useTrails', () => ({
  useTrails: () => ({
    trails: [],
    trailDetails: {},
    loading: false,
    lookup: { difficulties: [] },
    schedule: {},
  }),
}));

vi.mock('../../hooks/useTooltips', () => ({
  useTooltips: () => ({ title: vi.fn((s: string) => s) }),
}));

vi.mock('../../hooks/useNextHike', () => ({
  useNextHike: () => null,
}));

vi.mock('../../hooks/useMonthSlotStats', () => ({
  useMonthSlotStats: () => ({}),
}));

vi.mock('../../hooks/useApiKey', () => ({
  useApiKey: () => false,
}));

vi.mock('../../hooks/useScheduleData', () => ({
  useScheduleData: () => ({
    assignedHikes: {},
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

vi.mock('../../utils/scheduleFormat', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    serverScheduleToStore: () => ({}),
    storeToServerSchedule: () => ({}),
  };
});

vi.mock('../../api/client', () => ({
  updateSchedule: vi.fn(),
}));

vi.mock('../../hooks/useTrailStore', () => ({
  setSchedule: vi.fn(),
}));

describe('Calendar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderWithRouter = (ui: React.ReactElement) =>
    render(<MemoryRouter><MonthContextProvider>{ui}</MonthContextProvider></MemoryRouter>);

  it('shows no hikes assigned message when empty', () => {
    renderWithRouter(<Calendar />);
    const text = document.body.textContent || '';
    expect(text).toContain('Assigned Hikes');
  });

  it('renders ScheduledCards', () => {
    renderWithRouter(<Calendar />);
    expect(screen.getByText(/Assigned Hikes/)).toBeInTheDocument();
  });
});
