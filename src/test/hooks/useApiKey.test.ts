import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useApiKey } from '../../hooks/useApiKey';
import { storeApiKey } from '../../utils/apiKey';

describe('useApiKey', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('returns false when no API key', () => {
    const { result } = renderHook(() => useApiKey());
    expect(result.current).toBe(false);
  });

  it('returns true when API key exists', () => {
    localStorage.setItem('hiker-api-key', 'test-key-123');
    const { result } = renderHook(() => useApiKey());
    expect(result.current).toBe(true);
  });

  it('returns false for empty string key', () => {
    localStorage.setItem('hiker-api-key', '');
    const { result } = renderHook(() => useApiKey());
    expect(result.current).toBe(false);
  });

  it('returns false for other localStorage keys', () => {
    localStorage.setItem('other-key', 'value');
    const { result } = renderHook(() => useApiKey());
    expect(result.current).toBe(false);
  });

  it('updates to true when storeApiKey saves a key after mount', () => {
    const { result } = renderHook(() => useApiKey());
    expect(result.current).toBe(false);
    act(() => {
      storeApiKey('new-key');
    });
    expect(result.current).toBe(true);
  });

  it('updates to false when storeApiKey clears the key after mount', () => {
    localStorage.setItem('hiker-api-key', 'existing-key');
    const { result } = renderHook(() => useApiKey());
    expect(result.current).toBe(true);
    act(() => {
      storeApiKey('');
    });
    expect(result.current).toBe(false);
  });

  it('updates on storage event from another tab', () => {
    const { result } = renderHook(() => useApiKey());
    expect(result.current).toBe(false);
    act(() => {
      localStorage.setItem('hiker-api-key', 'other-tab-key');
      window.dispatchEvent(new StorageEvent('storage', { key: 'hiker-api-key' }));
    });
    expect(result.current).toBe(true);
  });

  it('ignores storage events for unrelated keys', () => {
    const { result } = renderHook(() => useApiKey());
    expect(result.current).toBe(false);
    act(() => {
      localStorage.setItem('other-key', 'value');
      window.dispatchEvent(new StorageEvent('storage', { key: 'other-key' }));
    });
    expect(result.current).toBe(false);
  });

  it('stops listening after unmount', () => {
    const { result, unmount } = renderHook(() => useApiKey());
    unmount();
    act(() => {
      storeApiKey('after-unmount-key');
    });
    expect(result.current).toBe(false);
  });
});
