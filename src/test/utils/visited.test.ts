import { describe, it, expect, vi, afterEach } from 'vitest';
import { hasVisited, markVisited } from '../../utils/visited';

describe('visited', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('is false by default and true after markVisited', () => {
    expect(hasVisited()).toBe(false);
    markVisited();
    expect(hasVisited()).toBe(true);
  });

  it('hasVisited survives blocked localStorage (private mode)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(hasVisited()).toBe(false);
  });

  it('markVisited survives blocked localStorage (private mode)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => markVisited()).not.toThrow();
  });
});
