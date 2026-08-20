import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import YearSelector from '../../components/YearSelector';
import { CURRENT_YEAR } from '../../utils/constants';

describe('YearSelector', () => {
  const props = {
    selectedYear: CURRENT_YEAR,
    onChange: vi.fn(),
    title: 'Select year',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders select element', () => {
    render(<YearSelector {...props} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('renders current year plus/minus one using two-digit labels', () => {
    render(<YearSelector {...props} />);
    const select = screen.getByRole('combobox');
    expect(select.options.length).toBe(3);
    expect(select.options[0].value).toBe(String(CURRENT_YEAR - 1));
    expect(select.options[0].textContent).toBe(String(CURRENT_YEAR - 1).slice(-2));
    expect(select.options[1].value).toBe(String(CURRENT_YEAR));
    expect(select.options[1].textContent).toBe(String(CURRENT_YEAR).slice(-2));
    expect(select.options[2].value).toBe(String(CURRENT_YEAR + 1));
    expect(select.options[2].textContent).toBe(String(CURRENT_YEAR + 1).slice(-2));
  });

  it('sets selected year', () => {
    render(<YearSelector {...props} />);
    const select = screen.getByRole('combobox');
    expect(select.value).toBe(String(CURRENT_YEAR));
  });

  it('calls onChange when changed', () => {
    render(<YearSelector {...props} />);
    const select = screen.getByRole('combobox');
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(props.onChange).toHaveBeenCalled();
  });

  it('applies tooltip title', () => {
    render(<YearSelector {...props} />);
    const select = screen.getByRole('combobox');
    expect(select).toHaveAttribute('title', 'Select year');
  });
});
