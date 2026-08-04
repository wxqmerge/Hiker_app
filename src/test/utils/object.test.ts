import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deepEqual } from '../../utils/object';

describe('deepEqual', () => {
  it('returns true for identical primitives', () => {
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual('hello', 'hello')).toBe(true);
    expect(deepEqual(true, true)).toBe(true);
  });

  it('returns false for different primitives', () => {
    expect(deepEqual(1, 2)).toBe(false);
    expect(deepEqual('hello', 'world')).toBe(false);
    expect(deepEqual(true, false)).toBe(false);
  });

  it('returns true for same object reference', () => {
    const obj = { a: 1 };
    expect(deepEqual(obj, obj)).toBe(true);
  });

  it('returns true for equal objects', () => {
    expect(deepEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
  });

  it('returns false for objects with different keys', () => {
    expect(deepEqual({ a: 1 }, { b: 1 })).toBe(false);
    expect(deepEqual({ a: 1, b: 2 }, { a: 1 })).toBe(false);
  });

  it('returns false for objects with different values', () => {
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
  });

  it('handles nested objects', () => {
    expect(deepEqual({ a: { b: 1 } }, { a: { b: 1 } })).toBe(true);
    expect(deepEqual({ a: { b: 1 } }, { a: { b: 2 } })).toBe(false);
  });

  it('handles arrays', () => {
    expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
    expect(deepEqual([1, 2], [2, 1])).toBe(false);
  });

  it('handles nested arrays', () => {
    expect(deepEqual([[1, 2], [3]], [[1, 2], [3]])).toBe(true);
    expect(deepEqual([[1]], [[2]])).toBe(false);
  });

  it('handles null and undefined', () => {
    expect(deepEqual(null, null)).toBe(true);
    expect(deepEqual(undefined, undefined)).toBe(true);
    expect(deepEqual(null, undefined)).toBe(false);
    expect(deepEqual({ a: null }, { a: undefined })).toBe(false);
    expect(deepEqual({ a: null }, { a: 1 })).toBe(false);
  });

  it('handles mixed types', () => {
    expect(deepEqual(1, '1')).toBe(false);
    expect(deepEqual({}, [])).toBe(true);
    expect(deepEqual([], {})).toBe(true);
  });

  it('handles empty objects and arrays', () => {
    expect(deepEqual({}, {})).toBe(true);
    expect(deepEqual([], [])).toBe(true);
    expect(deepEqual({}, [])).toBe(true);
  });

  it('handles complex nested structures', () => {
    const a = { arr: [{ x: 1, y: [2, 3] }], obj: { a: { b: { c: 4 } } } };
    const b = { arr: [{ x: 1, y: [2, 3] }], obj: { a: { b: { c: 4 } } } };
    expect(deepEqual(a, b)).toBe(true);
  });
});
