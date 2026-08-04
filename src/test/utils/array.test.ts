import { describe, it, expect } from 'vitest';
import { ensureArray } from '../../utils/array';

describe('ensureArray', () => {
  it('returns array as-is', () => {
    const arr = [1, 2, 3];
    expect(ensureArray(arr)).toBe(arr);
  });

  it('wraps non-array truthy value in array', () => {
    expect(ensureArray('hello')).toEqual(['hello']);
    expect(ensureArray(42)).toEqual([42]);
    expect(ensureArray({ a: 1 })).toEqual([{ a: 1 }]);
  });

  it('returns empty array for falsy values', () => {
    expect(ensureArray(null)).toEqual([]);
    expect(ensureArray(undefined)).toEqual([]);
    expect(ensureArray(false)).toEqual([]);
    expect(ensureArray(0)).toEqual([]);
    expect(ensureArray('')).toEqual([]);
  });
});
