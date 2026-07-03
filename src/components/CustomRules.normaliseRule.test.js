import { describe, it, expect } from 'vitest';
import { normaliseRule } from './CustomRules.jsx';

// Regression: the rules filter does `r.hostname.toLowerCase()`. If the API returns a
// numeric hostname/PK (the "1688" class that already crashed the Services search),
// an unguarded call throws and white-screens the Rules tab. normaliseRule must
// guarantee a string.
describe('normaliseRule', () => {
  it('coerces a numeric hostname to a string so .toLowerCase() is safe', () => {
    const r = normaliseRule({ hostname: 1688, do: 1, status: 1 });
    expect(typeof r.hostname).toBe('string');
    expect(r.hostname).toBe('1688');
    expect(() => r.hostname.toLowerCase()).not.toThrow();
  });

  it('falls back through PK/pk and defaults to an empty string', () => {
    expect(normaliseRule({ PK: 'example.com' }).hostname).toBe('example.com');
    expect(normaliseRule({ PK: 42 }).hostname).toBe('42');
    expect(normaliseRule({}).hostname).toBe('');
  });
});
