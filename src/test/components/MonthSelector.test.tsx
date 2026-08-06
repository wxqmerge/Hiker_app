import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import MonthSelector from '../../components/MonthSelector';

describe('MonthSelector', () => {
  const props = {
    selectedMonth: 0,
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

  it('applies tooltip title', () => {
    render(<MonthSelector {...props} />);
    const select = screen.getByRole('combobox');
    expect(select).toHaveAttribute('title', 'Select month');
  });
});
