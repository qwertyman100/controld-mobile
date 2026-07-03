import { describe, it, expect } from 'vitest';
import { normaliseRule, validateSpoofTarget } from './rules.js';

describe('normaliseRule', () => {
  it('reads the NESTED action (regression: was read from top level → always Bypass)', () => {
    const r = normaliseRule({ PK: 'samsungacr.com', order: 1, group: 0, action: { do: 0, status: 1 } });
    expect(r).toMatchObject({ hostname: 'samsungacr.com', do: 0, status: 1, group: 0, via: null, via_v6: null });
  });
  it('falls back to the flat optimistic-prepend shape', () => {
    expect(normaliseRule({ hostname: 'x.com', do: 1, status: 1 })).toMatchObject({ hostname: 'x.com', do: 1, status: 1 });
  });
  it("reads a spoof rule's via / via_v6 from the action", () => {
    const r = normaliseRule({ PK: 'a.com', action: { do: 2, status: 1, via: '1.2.3.4', via_v6: '2001:db8::1' } });
    expect(r).toMatchObject({ do: 2, via: '1.2.3.4', via_v6: '2001:db8::1' });
  });
  it('coerces a numeric PK to a string (the "1688" class)', () => {
    expect(normaliseRule({ PK: 1688 }).hostname).toBe('1688');
  });
  it('defaults to Bypass/enabled on an empty object', () => {
    expect(normaliseRule({})).toMatchObject({ hostname: '', do: 1, status: 1 });
  });
});

describe('validateSpoofTarget', () => {
  it('accepts IPv4 and hostnames (no TLD required)', () => {
    for (const v of ['192.168.1.50', '100.64.1.5', 'myserver.home', 'nas', 'example.com']) {
      expect(validateSpoofTarget(v).ok).toBe(true);
    }
  });
  it('rejects a numeric-dotted string that is not a valid IPv4', () => {
    expect(validateSpoofTarget('999.1.1.1').ok).toBe(false); // octet > 255
  });
  it('rejects empty, whitespace, and metacharacters', () => {
    expect(validateSpoofTarget('').ok).toBe(false);
    expect(validateSpoofTarget('has space').ok).toBe(false);
    expect(validateSpoofTarget('bad;$char').ok).toBe(false);
  });
  it('validates IPv6 only in ipv6 mode', () => {
    expect(validateSpoofTarget('2001:db8::1', { ipv6: true }).ok).toBe(true);
    expect(validateSpoofTarget('::1', { ipv6: true }).ok).toBe(true);
    expect(validateSpoofTarget('1.2.3.4', { ipv6: true }).ok).toBe(false); // no colons
    expect(validateSpoofTarget('nothex!', { ipv6: true }).ok).toBe(false);
  });
});
