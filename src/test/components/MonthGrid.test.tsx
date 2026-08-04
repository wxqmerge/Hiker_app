import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import MonthGrid from '../../components/MonthGrid';

describe('MonthGrid', () => {
  const months = ['Jan', 'Feb', 'Mar'];
  const renderMonth = vi.fn((month: string, idx: number) => (
    <div key={idx} data-testid={`month-${idx}`}>{month}</div>
  ));

  it('renders all months', () => {
    render(<MonthGrid months={months} renderMonth={renderMonth} />);
    expect(screen.getByTestId('month-0')).toBeInTheDocument();
    expect(screen.getByTestId('month-1')).toBeInTheDocument();
    expect(screen.getByTestId('month-2')).toBeInTheDocument();
  });

  it('calls renderMonth with month and index', () => {
    render(<MonthGrid months={months} renderMonth={renderMonth} />);
    expect(renderMonth).toHaveBeenCalledWith('Jan', 0);
    expect(renderMonth).toHaveBeenCalledWith('Feb', 1);
    expect(renderMonth).toHaveBeenCalledWith('Mar', 2);
  });

  it('renders month content', () => {
    render(<MonthGrid months={months} renderMonth={renderMonth} />);
    expect(screen.getByText('Jan')).toBeInTheDocument();
    expect(screen.getByText('Feb')).toBeInTheDocument();
    expect(screen.getByText('Mar')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <MonthGrid months={months} renderMonth={renderMonth} className="custom-class" />
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('renders empty when no months', () => {
    const { container } = render(
      <MonthGrid months={[]} renderMonth={renderMonth} />
    );
    expect(container.firstChild?.childElementCount).toBe(0);
  });

  it('renders with default empty className', () => {
    const { container } = render(
      <MonthGrid months={months} renderMonth={renderMonth} />
    );
    expect(container.firstChild?.getAttribute('class')).toBe('');
  });
});
