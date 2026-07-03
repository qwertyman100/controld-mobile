import { describe, it, expect } from 'vitest';
import { normaliseRule } from './rules.js';

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
