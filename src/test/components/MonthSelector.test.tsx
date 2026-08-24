import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import MonthSelector from '../../components/MonthSelector';
import { CURRENT_YEAR } from '../../utils/constants';
import { getMonthKey } from '../../utils/dateUtils';

describe('MonthSelector', () => {
  const selectedMonthKey = getMonthKey(CURRENT_YEAR, 0);
  const props = {
    selectedMonthKey,
    onChange: vi.fn(),
    title: 'Select month',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders select element', () => {
    render(<MonthSelector {...props} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('renders 25 month options (±1 year)', () => {
    render(<MonthSelector {...props} />);
    const select = screen.getByRole('combobox');
    expect(select.options.length).toBe(25);
  });

  it('sets selected month key', () => {
    render(<MonthSelector {...props} />);
    const select = screen.getByRole('combobox');
    expect(select.value).toBe(selectedMonthKey);
  });

  it('calls onChange when changed', () => {
    render(<MonthSelector {...props} />);
    const select = screen.getByRole('combobox');
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(props.onChange).toHaveBeenCalled();
  });

  it('applies tooltip title', () => {
    render(<MonthSelector {...props} />);
    const select = screen.getByRole('combobox');
    expect(select).toHaveAttribute('title', 'Select month');
  });

  it('covers ±1 year from current month', () => {
    render(<MonthSelector {...props} />);
    const select = screen.getByRole('combobox');
    const values = Array.from(select.options).map(option => option.value);
    const now = new Date();
    const startMonth = now.getMonth();
    expect(values[0]).toBe(getMonthKey(CURRENT_YEAR - 1, startMonth));
    expect(values[values.length - 1]).toBe(getMonthKey(CURRENT_YEAR + 1, startMonth));
  });

  it('includes the year in month labels', () => {
    render(<MonthSelector {...props} />);
    const select = screen.getByRole('combobox');
    const option = Array.from(select.options).find(o => o.value === getMonthKey(CURRENT_YEAR, 6));
    expect(option?.textContent).toContain(`July ${CURRENT_YEAR}`);
  });
});
