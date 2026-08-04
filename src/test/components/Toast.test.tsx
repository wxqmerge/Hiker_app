import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import ToastContainer from '../../components/Toast';
import { getToastListeners } from '../../hooks/useToast';

vi.mock('../../hooks/useToast', () => ({
  getToastListeners: vi.fn(() => new Set()),
}));

describe('ToastContainer', () => {
  const listeners = new Set();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getToastListeners).mockReturnValue(listeners);
    listeners.clear();
  });

  it('returns null when no toasts', () => {
    const { container } = render(<ToastContainer />);
    expect(container.firstChild).toBeNull();
  });

  it('renders toast message', async () => {
    render(<ToastContainer />);

    await act(async () => {
      listeners.forEach(listener => listener({ id: 1, message: 'Test toast', type: 'info' }));
    });

    expect(screen.getByText('Test toast')).toBeInTheDocument();
  });

  it('renders success toast with green background', async () => {
    render(<ToastContainer />);

    await act(async () => {
      listeners.forEach(listener => listener({ id: 1, message: 'Success!', type: 'success' }));
    });

    const toast = screen.getByText('Success!');
    expect(toast.className).toContain('bg-green-600');
  });

  it('renders error toast with red background', async () => {
    render(<ToastContainer />);

    await act(async () => {
      listeners.forEach(listener => listener({ id: 1, message: 'Error!', type: 'error' }));
    });

    const toast = screen.getByText('Error!');
    expect(toast.className).toContain('bg-red-600');
  });

  it('renders info toast with gray background', async () => {
    render(<ToastContainer />);

    await act(async () => {
      listeners.forEach(listener => listener({ id: 1, message: 'Info', type: 'info' }));
    });

    const toast = screen.getByText('Info');
    expect(toast.className).toContain('bg-gray-800');
  });

  it('removes toast after timeout', async () => {
    vi.useFakeTimers();
    render(<ToastContainer />);

    await act(async () => {
      listeners.forEach(listener => listener({ id: 1, message: 'Auto remove', type: 'info' }));
    });

    expect(screen.getByText('Auto remove')).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.queryByText('Auto remove')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('renders multiple toasts', async () => {
    render(<ToastContainer />);

    await act(async () => {
      listeners.forEach(listener => listener({ id: 1, message: 'Toast 1', type: 'info' }));
      listeners.forEach(listener => listener({ id: 2, message: 'Toast 2', type: 'success' }));
    });

    expect(screen.getByText('Toast 1')).toBeInTheDocument();
    expect(screen.getByText('Toast 2')).toBeInTheDocument();
  });

  it('positions toasts at bottom right', async () => {
    render(<ToastContainer />);

    await act(async () => {
      listeners.forEach(listener => listener({ id: 1, message: 'Positioned', type: 'info' }));
    });

    const container = screen.getByText('Positioned').parentElement;
    expect(container.className).toContain('bottom-4');
    expect(container.className).toContain('right-4');
  });

  it('registers and unregisters listener', () => {
    const { unmount } = render(<ToastContainer />);
    expect(listeners.size).toBe(1);
    unmount();
    expect(listeners.size).toBe(0);
  });
});
