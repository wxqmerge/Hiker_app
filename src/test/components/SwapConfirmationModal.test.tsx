import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SwapConfirmationModal from '../../components/SwapConfirmationModal';

describe('SwapConfirmationModal', () => {
  const pendingSwap = {
    sourceTrailName: 'Trail A',
    targetTrailName: 'Trail B',
    sourceDayLabel: 'Jan 15',
    targetDayLabel: 'Jan 22',
  };

  const onConfirm = vi.fn();
  const onCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when no pending swap', () => {
    const { container } = render(<SwapConfirmationModal pendingSwap={null} onConfirm={onConfirm} onCancel={onCancel} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders swap confirmation title', () => {
    render(<SwapConfirmationModal pendingSwap={pendingSwap} onConfirm={onConfirm} onCancel={onCancel} />);
    expect(screen.getByText('Swap Hikes?')).toBeInTheDocument();
  });

  it('renders source trail swap info', () => {
    render(<SwapConfirmationModal pendingSwap={pendingSwap} onConfirm={onConfirm} onCancel={onCancel} />);
    expect(screen.getByText('Trail A')).toBeInTheDocument();
    expect(screen.getByText((content, element) => content.includes('moves to') && element?.textContent?.includes('Jan 22'))).toBeInTheDocument();
  });

  it('renders target trail swap info', () => {
    render(<SwapConfirmationModal pendingSwap={pendingSwap} onConfirm={onConfirm} onCancel={onCancel} />);
    expect(screen.getByText('Trail B')).toBeInTheDocument();
    expect(screen.getByText((content, element) => content.includes('moves to') && element?.textContent?.includes('Jan 15'))).toBeInTheDocument();
  });

  it('renders Cancel button', () => {
    render(<SwapConfirmationModal pendingSwap={pendingSwap} onConfirm={onConfirm} onCancel={onCancel} />);
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('renders Swap button', () => {
    render(<SwapConfirmationModal pendingSwap={pendingSwap} onConfirm={onConfirm} onCancel={onCancel} />);
    expect(screen.getByText('Swap')).toBeInTheDocument();
  });

  it('calls onCancel when Cancel button clicked', () => {
    render(<SwapConfirmationModal pendingSwap={pendingSwap} onConfirm={onConfirm} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('calls onConfirm when Swap button clicked', () => {
    render(<SwapConfirmationModal pendingSwap={pendingSwap} onConfirm={onConfirm} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Swap'));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('calls onCancel when backdrop clicked', () => {
    render(<SwapConfirmationModal pendingSwap={pendingSwap} onConfirm={onConfirm} onCancel={onCancel} />);
    const backdrop = screen.getByRole('button', { name: 'Cancel' }).closest('.fixed');
    fireEvent.click(backdrop);
    expect(onCancel).toHaveBeenCalled();
  });

  it('does not call onCancel when content clicked', () => {
    render(<SwapConfirmationModal pendingSwap={pendingSwap} onConfirm={onConfirm} onCancel={onCancel} />);
    const content = screen.getByText('Swap Hikes?').parentElement;
    fireEvent.click(content);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('renders step numbers', () => {
    render(<SwapConfirmationModal pendingSwap={pendingSwap} onConfirm={onConfirm} onCancel={onCancel} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('applies modal styling', () => {
    render(<SwapConfirmationModal pendingSwap={pendingSwap} onConfirm={onConfirm} onCancel={onCancel} />);
    const modal = screen.getByText('Swap Hikes?').closest('.fixed');
    expect(modal.className).toContain('bg-black/40');
    expect(modal.className).toContain('z-50');
  });
});
