import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import DaySelector from '../../components/DaySelector';

describe('DaySelector', () => {
  const props = {
    selectedDay: '',
    onChange: vi.fn(),
    month: 0,
    title: 'Select day',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders select element', () => {
    render(<DaySelector {...props} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('renders days in the selected month plus placeholder', () => {
    render(<DaySelector {...props} />);
    const select = screen.getByRole('combobox');
    expect(select.options.length).toBe(32);
  });

  it('renders February days for February', () => {
    render(<DaySelector {...props} month={1} />);
    const select = screen.getByRole('combobox');
    expect(select.options.length).toBe(29);
  });

  it('includes a placeholder option with empty value', () => {
    render(<DaySelector {...props} />);
    const select = screen.getByRole('combobox');
    expect(select.options[0].value).toBe('');
    expect(select.options[0].textContent).toBe('Day');
  });

  it('sets selected day', () => {
    render(<DaySelector {...props} selectedDay="15" />);
    const select = screen.getByRole('combobox');
    expect(select.value).toBe('15');
  });

  it('calls onChange when changed', () => {
    render(<DaySelector {...props} />);
    const select = screen.getByRole('combobox');
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(props.onChange).toHaveBeenCalled();
  });

  it('applies tooltip title', () => {
    render(<DaySelector {...props} />);
    const select = screen.getByRole('combobox');
    expect(select).toHaveAttribute('title', 'Select day');
  });
});
