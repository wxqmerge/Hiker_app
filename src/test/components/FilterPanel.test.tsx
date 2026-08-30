import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FilterPanel from '../../components/FilterPanel';

describe('FilterPanel', () => {
  const mockLookup = {
    difficulties: [
      { code: 'Easy', label: 'Easy' },
      { code: 'Moderate', label: 'Moderate' },
      { code: 'Difficult', label: 'Difficult' },
    ],
    months: [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ],
  };

  const baseFilters = {
    search: '',
    distance: { min: 0, max: 100 },
    elevation: { min: 0, max: 15000 },
    difficulties: [],
    months: [],
    sortBy: 'name',
    wilderness: false,
    gpx: 'all',
    tide: 'all',
  };

  const mockSetFilters = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    mockSetFilters.mockClear();
  });

  it('renders search input', () => {
    render(<FilterPanel filters={baseFilters} setFilters={mockSetFilters} lookup={mockLookup} resetFilters={vi.fn()} />);
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
  });

  it('renders distance and elevation sliders', () => {
    render(<FilterPanel filters={baseFilters} setFilters={mockSetFilters} lookup={mockLookup} resetFilters={vi.fn()} />);
    expect(screen.getByText('Dist')).toBeInTheDocument();
    expect(screen.getByText('Elev')).toBeInTheDocument();
    expect(screen.getByText('0mi – 100mi')).toBeInTheDocument();
    expect(screen.getByText('0ft – 15000ft')).toBeInTheDocument();
  });

  it('renders elevation slider', () => {
    render(<FilterPanel filters={baseFilters} setFilters={mockSetFilters} lookup={mockLookup} resetFilters={vi.fn()} />);
    expect(screen.getByText('Elev')).toBeInTheDocument();
  });

  it('renders difficulty buttons', () => {
    render(<FilterPanel filters={baseFilters} setFilters={mockSetFilters} lookup={mockLookup} resetFilters={vi.fn()} />);
    expect(screen.getByText('Easy')).toBeInTheDocument();
    expect(screen.getByText('Moderate')).toBeInTheDocument();
    expect(screen.getByText('Difficult')).toBeInTheDocument();
  });

  it('renders month buttons', () => {
    render(<FilterPanel filters={baseFilters} setFilters={mockSetFilters} lookup={mockLookup} resetFilters={vi.fn()} />);
    expect(screen.getByText('Jan')).toBeInTheDocument();
    expect(screen.getByText('Jun')).toBeInTheDocument();
    expect(screen.getByText('Dec')).toBeInTheDocument();
  });

  it('renders sort buttons', () => {
    render(<FilterPanel filters={baseFilters} setFilters={mockSetFilters} lookup={mockLookup} resetFilters={vi.fn()} />);
    expect(screen.getByText('A-Z')).toBeInTheDocument();
    expect(screen.getByText('Pop')).toBeInTheDocument();
    expect(screen.getByText('Elev ↑')).toBeInTheDocument();
    expect(screen.getByText('Elev ↓')).toBeInTheDocument();
    expect(screen.getByText('Dist ↑')).toBeInTheDocument();
    expect(screen.getByText('Dist ↓')).toBeInTheDocument();
  });

  it('renders wilderness toggle', () => {
    render(<FilterPanel filters={baseFilters} setFilters={mockSetFilters} lookup={mockLookup} resetFilters={vi.fn()} />);
    expect(screen.getByText('◆')).toBeInTheDocument();
  });

  it('hides reset button when no filters active', () => {
    render(<FilterPanel filters={baseFilters} setFilters={mockSetFilters} lookup={mockLookup} resetFilters={vi.fn()} />);
    expect(screen.queryByText('✕')).not.toBeInTheDocument();
  });

  it('shows reset button when search is active', () => {
    render(
      <FilterPanel
        filters={{ ...baseFilters, search: 'test' }}
        setFilters={mockSetFilters}
        lookup={mockLookup}
        resetFilters={vi.fn()}
      />
    );
    expect(screen.getByText('✕')).toBeInTheDocument();
  });

  it('calls setFilters on search input change', () => {
    render(<FilterPanel filters={baseFilters} setFilters={mockSetFilters} lookup={mockLookup} resetFilters={vi.fn()} />);
    const input = screen.getByPlaceholderText('Search...');
    fireEvent.change(input, { target: { value: 'Rainier' } });
    expect(mockSetFilters).toHaveBeenCalled();
  });

  it('calls setFilters on difficulty toggle', () => {
    render(<FilterPanel filters={baseFilters} setFilters={mockSetFilters} lookup={mockLookup} resetFilters={vi.fn()} />);
    const button = screen.getByText('Easy');
    fireEvent.click(button);
    expect(mockSetFilters).toHaveBeenCalled();
  });

  it('calls setFilters on month toggle', () => {
    render(<FilterPanel filters={baseFilters} setFilters={mockSetFilters} lookup={mockLookup} resetFilters={vi.fn()} />);
    const button = screen.getByText('Jan');
    fireEvent.click(button);
    expect(mockSetFilters).toHaveBeenCalled();
  });

  it('calls setFilters on sort button click', () => {
    render(<FilterPanel filters={baseFilters} setFilters={mockSetFilters} lookup={mockLookup} resetFilters={vi.fn()} />);
    const button = screen.getByText('Pop');
    fireEvent.click(button);
    expect(mockSetFilters).toHaveBeenCalled();
  });

  it('calls setFilters on wilderness toggle', () => {
    render(<FilterPanel filters={baseFilters} setFilters={mockSetFilters} lookup={mockLookup} resetFilters={vi.fn()} />);
    const button = screen.getByText('◆');
    fireEvent.click(button);
    expect(mockSetFilters).toHaveBeenCalled();
  });

  it('calls resetFilters on reset button click', () => {
    const mockReset = vi.fn();
    render(
      <FilterPanel
        filters={{ ...baseFilters, search: 'test' }}
        setFilters={mockSetFilters}
        lookup={mockLookup}
        resetFilters={mockReset}
      />
    );
    fireEvent.click(screen.getByText('✕'));
    expect(mockReset).toHaveBeenCalled();
  });

  it('uses abbreviated months from MONTH_ABBR not lookup full names', () => {
    render(<FilterPanel filters={baseFilters} setFilters={mockSetFilters} lookup={mockLookup} resetFilters={vi.fn()} />);
    expect(screen.getByText('Jan')).toBeInTheDocument();
    expect(screen.queryByText('January')).not.toBeInTheDocument();
  });

  it('disables reset button when no filters active', () => {
    render(<FilterPanel filters={baseFilters} setFilters={mockSetFilters} lookup={mockLookup} resetFilters={vi.fn()} />);
    expect(screen.queryByText('✕')).not.toBeInTheDocument();
  });

  it('displays current distance range value', () => {
    render(<FilterPanel filters={baseFilters} setFilters={mockSetFilters} lookup={mockLookup} resetFilters={vi.fn()} />);
    expect(screen.getByText('0mi – 100mi')).toBeInTheDocument();
  });

  it('displays current elevation range value', () => {
    render(<FilterPanel filters={baseFilters} setFilters={mockSetFilters} lookup={mockLookup} resetFilters={vi.fn()} />);
    expect(screen.getByText('0ft – 15000ft')).toBeInTheDocument();
  });
});
