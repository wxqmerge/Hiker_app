import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTooltips } from '../../hooks/useTooltips';

describe('useTooltips', () => {
  const TOOLTIPS_KEY = 'hiker-tooltips-enabled';

  beforeEach(() => {
    const storage = {};
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => storage[key] || null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => { storage[key] = value; });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((key) => { delete storage[key]; });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults enabled to true when no localStorage value', () => {
    const { result } = renderHook(() => useTooltips());
    expect(result.current.enabled).toBe(true);
  });

  it('reads enabled=false from localStorage', () => {
    const storage = { [TOOLTIPS_KEY]: 'false' };
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => storage[key] || null);
    const { result } = renderHook(() => useTooltips());
    expect(result.current.enabled).toBe(false);
  });

  it('reads enabled=true from localStorage', () => {
    const storage = { [TOOLTIPS_KEY]: 'true' };
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => storage[key] || null);
    const { result } = renderHook(() => useTooltips());
    expect(result.current.enabled).toBe(true);
  });

  it('toggle() flips enabled from true to false', () => {
    const { result } = renderHook(() => useTooltips());
    expect(result.current.enabled).toBe(true);
    act(() => { result.current.toggle(); });
    expect(result.current.enabled).toBe(false);
  });

  it('toggle() flips enabled from false to true', () => {
    const storage = { [TOOLTIPS_KEY]: 'false' };
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => storage[key] || null);
    const { result } = renderHook(() => useTooltips());
    expect(result.current.enabled).toBe(false);
    act(() => { result.current.toggle(); });
    expect(result.current.enabled).toBe(true);
  });

  it('toggle() persists to localStorage', () => {
    const storage = {};
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => storage[key] || null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => { storage[key] = value; });
    const { result } = renderHook(() => useTooltips());
    act(() => { result.current.toggle(); });
    expect(storage[TOOLTIPS_KEY]).toBe('false');
    act(() => { result.current.toggle(); });
    expect(storage[TOOLTIPS_KEY]).toBe('true');
  });

  it('title(text) returns text when enabled', () => {
    const { result } = renderHook(() => useTooltips());
    expect(result.current.title('hello')).toBe('hello');
    expect(result.current.title('')).toBe('');
  });

  it('title(text) returns undefined when disabled', () => {
    const storage = { [TOOLTIPS_KEY]: 'false' };
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => storage[key] || null);
    const { result } = renderHook(() => useTooltips());
    expect(result.current.title('hello')).toBeUndefined();
  });

  it('title(text) returns undefined when disabled even for empty string', () => {
    const storage = { [TOOLTIPS_KEY]: 'false' };
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => storage[key] || null);
    const { result } = renderHook(() => useTooltips());
    expect(result.current.title('')).toBeUndefined();
  });

  it('handles localStorage setItem throwing gracefully', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage full'); });
    const { result } = renderHook(() => useTooltips());
    expect(() => act(() => { result.current.toggle(); })).not.toThrow();
    expect(result.current.enabled).toBe(false);
  });
});
