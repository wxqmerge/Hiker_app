import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import DualRangeSlider from '../../components/DualRangeSlider';

vi.mock('../../hooks/useTooltips', () => ({
  useTooltips: () => ({ title: (s: string) => s }),
}));

describe('DualRangeSlider', () => {
  const props = {
    min: 0,
    max: 20,
    step: 0.5,
    value: { min: 2, max: 15 },
    onChange: vi.fn(),
    unit: 'mi',
    tooltip: 'Distance range',
    label: 'Dist',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders label', () => {
    render(<DualRangeSlider {...props} />);
    expect(screen.getByText('Dist')).toBeInTheDocument();
  });

  it('renders value range', () => {
    render(<DualRangeSlider {...props} />);
    expect(screen.getByText('2mi – 15mi')).toBeInTheDocument();
  });

  it('renders with different units', () => {
    render(<DualRangeSlider {...props} unit="ft" />);
    expect(screen.getByText('2ft – 15ft')).toBeInTheDocument();
  });

  it('applies tooltip', () => {
    render(<DualRangeSlider {...props} />);
    const label = screen.getByText('Dist').parentElement;
    expect(label).toHaveAttribute('title', 'Distance range');
  });

  it('renders slider container', () => {
    const { container } = render(<DualRangeSlider {...props} />);
    const slider = container.querySelector('.cursor-grab');
    expect(slider).toBeInTheDocument();
  });

  it('renders min handle', () => {
    const { container } = render(<DualRangeSlider {...props} />);
    const minHandle = container.querySelector('.bg-green-500');
    expect(minHandle).toBeInTheDocument();
  });

  it('renders max handle', () => {
    const { container } = render(<DualRangeSlider {...props} />);
    const maxHandle = container.querySelector('.bg-blue-500');
    expect(maxHandle).toBeInTheDocument();
  });

  it('renders gradient fill', () => {
    const { container } = render(<DualRangeSlider {...props} />);
    const fill = container.querySelector('[style*="linear-gradient"]');
    expect(fill).toBeInTheDocument();
  });

  it('calculates correct percentage for min value', () => {
    const { container } = render(<DualRangeSlider {...props} />);
    const minHandle = container.querySelector('.bg-green-500');
    const expectedPct = ((2 - 0) / (20 - 0)) * 100;
    expect(minHandle).toHaveStyle({ left: `calc(${expectedPct}% - 8px)` });
  });

  it('calculates correct percentage for max value', () => {
    const { container } = render(<DualRangeSlider {...props} />);
    const maxHandle = container.querySelector('.bg-blue-500');
    const expectedPct = ((15 - 0) / (20 - 0)) * 100;
    expect(maxHandle).toHaveStyle({ left: `calc(${expectedPct}% - 8px)` });
  });

  it('renders background bar', () => {
    const { container } = render(<DualRangeSlider {...props} />);
    const bar = container.querySelector('.bg-gray-200');
    expect(bar).toBeInTheDocument();
  });
});
