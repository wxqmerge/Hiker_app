import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToast, getToastListeners } from '../../hooks/useToast';

describe('useToast', () => {
  beforeEach(() => {
    const listeners = getToastListeners();
    listeners.clear();
  });

  it('returns a function', () => {
    const { result } = renderHook(() => useToast());
    expect(typeof result.current).toBe('function');
  });

  it('notifies listeners when called', () => {
    const listener = vi.fn();
    getToastListeners().add(listener);

    const { result } = renderHook(() => useToast());

    act(() => {
      result.current('Test message');
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0]).toMatchObject({
      message: 'Test message',
      type: 'info',
    });
  });

  it('uses default type info', () => {
    const listener = vi.fn();
    getToastListeners().add(listener);

    const { result } = renderHook(() => useToast());

    act(() => {
      result.current('Test');
    });

    expect(listener.mock.calls[0][0].type).toBe('info');
  });

  it('accepts custom type', () => {
    const listener = vi.fn();
    getToastListeners().add(listener);

    const { result } = renderHook(() => useToast());

    act(() => {
      result.current('Error!', 'error');
    });

    expect(listener.mock.calls[0][0].type).toBe('error');
  });

  it('accepts success type', () => {
    const listener = vi.fn();
    getToastListeners().add(listener);

    const { result } = renderHook(() => useToast());

    act(() => {
      result.current('Success!', 'success');
    });

    expect(listener.mock.calls[0][0].type).toBe('success');
  });

  it('generates unique IDs', () => {
    const listener = vi.fn();
    getToastListeners().add(listener);

    const { result } = renderHook(() => useToast());

    act(() => {
      result.current('First');
      result.current('Second');
    });

    const id1 = listener.mock.calls[0][0].id;
    const id2 = listener.mock.calls[1][0].id;
    expect(id1).not.toBe(id2);
  });

  it('notifies multiple listeners', () => {
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    getToastListeners().add(listener1);
    getToastListeners().add(listener2);

    const { result } = renderHook(() => useToast());

    act(() => {
      result.current('Test');
    });

    expect(listener1).toHaveBeenCalledTimes(1);
    expect(listener2).toHaveBeenCalledTimes(1);
  });
});
