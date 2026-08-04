import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useApiKey } from '../../hooks/useApiKey';

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
});
