import { describe, it, expect } from 'vitest';
import { deepEqual } from '../../utils/object.js';

describe('deepEqual', () => {
  it('returns true for identical primitives', () => {
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual('a', 'a')).toBe(true);
    expect(deepEqual(true, true)).toBe(true);
    expect(deepEqual(false, false)).toBe(true);
  });

  it('returns false for different primitives', () => {
    expect(deepEqual(1, 2)).toBe(false);
    expect(deepEqual('a', 'b')).toBe(false);
    expect(deepEqual(true, false)).toBe(false);
  });

  it('returns false for null vs non-null', () => {
    expect(deepEqual(null, {})).toBe(false);
    expect(deepEqual(undefined, {})).toBe(false);
    expect(deepEqual(null, undefined)).toBe(false);
  });

  it('returns true for identical empty objects', () => {
    expect(deepEqual({}, {})).toBe(true);
  });

  it('returns true for identical simple objects', () => {
    expect(deepEqual({ a: 1 }, { a: 1 })).toBe(true);
    expect(deepEqual({ a: 'x', b: 2 }, { a: 'x', b: 2 })).toBe(true);
  });

  it('returns false for different values in identical keys', () => {
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(deepEqual({ a: 'x' }, { a: 'y' })).toBe(false);
  });

  it('returns false for different key counts', () => {
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(deepEqual({ a: 1, b: 2 }, { a: 1 })).toBe(false);
  });

  it('returns false for missing keys', () => {
    expect(deepEqual({ a: 1, b: 2 }, { a: 1, c: 2 })).toBe(false);
  });

  it('returns true for identical nested objects', () => {
    const obj1 = { a: { b: { c: 1 } } };
    const obj2 = { a: { b: { c: 1 } } };
    expect(deepEqual(obj1, obj2)).toBe(true);
  });

  it('returns false for different nested values', () => {
    const obj1 = { a: { b: { c: 1 } } };
    const obj2 = { a: { b: { c: 2 } } };
    expect(deepEqual(obj1, obj2)).toBe(false);
  });

  it('returns true for identical arrays of primitives', () => {
    expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
  });

  it('returns false for different arrays', () => {
    expect(deepEqual([1, 2, 3], [1, 2, 4])).toBe(false);
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
  });

  it('returns true for identical schedule data', () => {
    const schedule1 = {
      Jun: [{ day: 1, hike: 'Hike 1', trail_id: 'trail-1', early_start: false }],
      Jul: [{ day: 8, hike: 'Hike 2', trail_id: 'trail-2', early_start: true }],
    };
    const schedule2 = {
      Jun: [{ day: 1, hike: 'Hike 1', trail_id: 'trail-1', early_start: false }],
      Jul: [{ day: 8, hike: 'Hike 2', trail_id: 'trail-2', early_start: true }],
    };
    expect(deepEqual(schedule1, schedule2)).toBe(true);
  });

  it('returns false when early_start differs', () => {
    const schedule1 = {
      Jun: [{ day: 1, hike: 'Hike 1', trail_id: 'trail-1', early_start: false }],
    };
    const schedule2 = {
      Jun: [{ day: 1, hike: 'Hike 1', trail_id: 'trail-1', early_start: true }],
    };
    expect(deepEqual(schedule1, schedule2)).toBe(false);
  });

  it('returns false when day number differs', () => {
    const schedule1 = {
      Jun: [{ day: 1, hike: 'Hike 1', trail_id: 'trail-1' }],
    };
    const schedule2 = {
      Jun: [{ day: 2, hike: 'Hike 1', trail_id: 'trail-1' }],
    };
    expect(deepEqual(schedule1, schedule2)).toBe(false);
  });

  it('returns false when trail_id differs', () => {
    const schedule1 = {
      Jun: [{ day: 1, hike: 'Hike 1', trail_id: 'trail-1' }],
    };
    const schedule2 = {
      Jun: [{ day: 1, hike: 'Hike 1', trail_id: 'trail-2' }],
    };
    expect(deepEqual(schedule1, schedule2)).toBe(false);
  });

  it('returns true for identical empty arrays', () => {
    expect(deepEqual([], [])).toBe(true);
  });

  it('returns true for identical empty nested objects in array', () => {
    expect(deepEqual([{ a: {} }], [{ a: {} }])).toBe(true);
  });
});
