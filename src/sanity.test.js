// Smoke test — proves the test harness itself is wired up before any real tests
// exist. If this is green we know: (1) Vitest runs, (2) ESM imports resolve, and
// (3) the source module under test loads without throwing. This is the
// "ground-truth check" the test-writing loop keeps re-running each iteration.
import { describe, it, expect } from 'vitest';
import { extractDomain, toArray } from './api/controld.js';

describe('test harness sanity', () => {
  it('loads the source module and exposes its pure functions', () => {
    expect(typeof extractDomain).toBe('function');
    expect(typeof toArray).toBe('function');
  });
});
