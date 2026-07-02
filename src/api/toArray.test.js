// Tests for toArray(value, ...keys): normalizes API responses that may be a raw
// array, an object wrapping the array under a known key, or an object with a
// single array-valued property. Falls back to [] when it can't decide.
import { describe, it, expect } from 'vitest';
import { toArray } from './controld.js';

describe('toArray', () => {
  it('returns an array argument unchanged', () => {
    const arr = [1, 2, 3];
    expect(toArray(arr)).toBe(arr); // same reference, not a copy
  });

  it('extracts the array under a named key', () => {
    expect(toArray({ rules: [1, 2] }, 'rules')).toEqual([1, 2]);
  });

  it('checks named keys in order and returns the first array match', () => {
    expect(toArray({ a: [1], b: [2] }, 'b', 'a')).toEqual([2]);
  });

  it('a named-key match wins over the single-array heuristic', () => {
    expect(toArray({ rules: [1], other: [2] }, 'rules')).toEqual([1]);
  });

  it('falls back to the sole array-valued property when no key matches', () => {
    expect(toArray({ data: [1, 2] })).toEqual([1, 2]);
    expect(toArray({ rules: [1, 2], count: 5 }, 'missing')).toEqual([1, 2]);
  });

  it('returns [] when multiple array properties are ambiguous', () => {
    expect(toArray({ a: [1], b: [2] })).toEqual([]);
  });

  it('returns [] for objects with no array properties', () => {
    expect(toArray({ a: 1, b: 'x' })).toEqual([]);
  });

  it('returns [] for non-object, non-array values', () => {
    expect(toArray('string')).toEqual([]);
    expect(toArray(42)).toEqual([]);
    expect(toArray(null)).toEqual([]);
    expect(toArray(undefined)).toEqual([]);
  });
});
