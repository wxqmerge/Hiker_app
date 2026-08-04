import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import MonthSelector from '../../components/MonthSelector';

describe('MonthSelector', () => {
  const monthSlotStats = {
    0: { total: 5, filled: 2 },
    1: { total: 4, filled: 0 },
    2: { total: 4, filled: 4 },
  };

  const props = {
    selectedMonth: 0,
    onChange: vi.fn(),
    monthSlotStats,
    assignedCount: 2,
    hikeDates: [1, 8, 15, 22, 29],
    title: 'Select month',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders select element', () => {
    render(<MonthSelector {...props} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('renders all month options', () => {
    render(<MonthSelector {...props} />);
    const select = screen.getByRole('combobox');
    expect(select.options.length).toBe(12);
  });

  it('sets selected month', () => {
    render(<MonthSelector {...props} />);
    const select = screen.getByRole('combobox');
    expect(select.value).toBe('0');
  });

  it('calls onChange when changed', () => {
    render(<MonthSelector {...props} />);
    const select = screen.getByRole('combobox');
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(props.onChange).toHaveBeenCalled();
  });

  it('shows fill ratio in option label', () => {
    render(<MonthSelector {...props} />);
    expect(screen.getByText('January (2/5)')).toBeInTheDocument();
  });

  it('shows 0/0 for missing stats', () => {
    render(<MonthSelector {...props} />);
    expect(screen.getByText('April (0/0)')).toBeInTheDocument();
  });

  it('shows slots filled text', () => {
    render(<MonthSelector {...props} />);
    expect(screen.getByText('2/5 slots filled')).toBeInTheDocument();
  });

  it('uses assignedCount fallback', () => {
    const emptyStats = {};
    render(<MonthSelector {...props} monthSlotStats={emptyStats} />);
    expect(screen.getByText('2/5 slots filled')).toBeInTheDocument();
  });

  it('applies tooltip title', () => {
    render(<MonthSelector {...props} />);
    const select = screen.getByRole('combobox');
    expect(select).toHaveAttribute('title', 'Select month');
  });

  it('renders paragraph with slot info', () => {
    render(<MonthSelector {...props} />);
    const p = screen.getByText(/slots filled/);
    expect(p.tagName).toBe('P');
  });
});
