import { describe, it, expect } from 'vitest';
import {
  DEFAULT_ACTIONS,
  normaliseDefaultAction,
  buildDefaultRulePayload,
  validateDefaultRule,
} from './defaultRule';

describe('DEFAULT_ACTIONS', () => {
  it('offers exactly Block, Bypass, Redirect (no Spoof)', () => {
    expect(DEFAULT_ACTIONS.map((a) => a.label)).toEqual(['Block', 'Bypass', 'Redirect']);
    expect(DEFAULT_ACTIONS.map((a) => a.do)).toEqual([0, 1, 3]);
  });
});

describe('normaliseDefaultAction', () => {
  it('reads a Block default', () => {
    expect(normaliseDefaultAction({ do: 0, status: 1 })).toEqual({ do: 0, status: 1, via: null });
  });
  it('reads a Redirect default with via', () => {
    expect(normaliseDefaultAction({ do: 3, status: 1, via: 'DFW' })).toEqual({ do: 3, status: 1, via: 'DFW' });
  });
  it('falls back to Bypass for null/undefined da', () => {
    expect(normaliseDefaultAction(null)).toEqual({ do: 1, status: 1, via: null });
    expect(normaliseDefaultAction(undefined)).toEqual({ do: 1, status: 1, via: null });
  });
  it('coerces string numerics', () => {
    expect(normaliseDefaultAction({ do: '0', status: '1' })).toEqual({ do: 0, status: 1, via: null });
  });
});

describe('buildDefaultRulePayload', () => {
  it('block → {do:0,status:1}', () => {
    expect(buildDefaultRulePayload(0)).toEqual({ do: 0, status: 1 });
  });
  it('bypass → {do:1,status:1}', () => {
    expect(buildDefaultRulePayload(1)).toEqual({ do: 1, status: 1 });
  });
  it('redirect with via → includes via', () => {
    expect(buildDefaultRulePayload(3, { via: 'DFW' })).toEqual({ do: 3, status: 1, via: 'DFW' });
  });
  it('never adds via for block/bypass', () => {
    expect(buildDefaultRulePayload(0, { via: 'DFW' })).toEqual({ do: 0, status: 1 });
  });
});

describe('validateDefaultRule', () => {
  it('rejects redirect with no location', () => {
    expect(validateDefaultRule(3, {})).toEqual({ ok: false, error: 'Choose a location to redirect to.' });
  });
  it('accepts redirect with a location', () => {
    expect(validateDefaultRule(3, { via: 'DFW' })).toEqual({ ok: true });
  });
  it('accepts block and bypass', () => {
    expect(validateDefaultRule(0)).toEqual({ ok: true });
    expect(validateDefaultRule(1)).toEqual({ ok: true });
  });
});
