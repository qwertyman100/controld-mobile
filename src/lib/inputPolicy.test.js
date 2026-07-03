import { describe, it, expect } from 'vitest';
import { sanitizeSearchQuery, validateToken } from './inputPolicy.js';

// A realistic ControlD token: [A-Za-z0-9._-], comfortably long (real one is 68).
const GOOD_TOKEN = 'api.a2b3c4d5e6f7g8h9-i0j1k2l3_m4n5o6p7q8r9s0';

describe('sanitizeSearchQuery — allowlist [A-Za-z0-9 space], strip the rest', () => {
  it('coerces non-strings and null/undefined to a string', () => {
    expect(sanitizeSearchQuery(1688)).toBe('1688'); // the exact numeric-field trap that crashed us
    expect(sanitizeSearchQuery(null)).toBe('');
    expect(sanitizeSearchQuery(undefined)).toBe('');
  });

  it('keeps English letters, digits, and spaces (finds any app)', () => {
    expect(sanitizeSearchQuery('9GAG')).toBe('9GAG');
    expect(sanitizeSearchQuery('Amazon Music')).toBe('Amazon Music');
  });

  it('strips dev/shell metacharacters — the injection signal', () => {
    expect(sanitizeSearchQuery('app{}[]|<>;$&()name')).toBe('appname');
    expect(sanitizeSearchQuery("'; DROP TABLE x;--")).toBe(' DROP TABLE x'); // quotes/;/- gone, letters+space remain
    expect(sanitizeSearchQuery('$(whoami)')).toBe('whoami');
  });

  it('strips ASCII control characters (NUL, ESC, DEL, newline, tab)', () => {
    expect(sanitizeSearchQuery('ab\x00\x07\x1b\x7fcd')).toBe('abcd');
    expect(sanitizeSearchQuery('line\nbreak\ttab')).toBe('linebreaktab');
  });

  it('renders injection-shaped input inert (metachars removed, plain string out)', () => {
    expect(sanitizeSearchQuery('<script>alert(1)</script>')).toBe('scriptalert1script');
    expect(typeof sanitizeSearchQuery('`rm -rf /`')).toBe('string');
  });

  it('caps length (boundary) — a 500-char paste is truncated to 128', () => {
    expect(sanitizeSearchQuery('a'.repeat(500))).toHaveLength(128);
  });
});

describe('validateToken — strict allowlist [A-Za-z0-9._-] + length bounds', () => {
  it('accepts a well-formed token and returns the trimmed value', () => {
    expect(validateToken(GOOD_TOKEN)).toEqual({ ok: true, value: GOOD_TOKEN });
    expect(validateToken(`  ${GOOD_TOKEN}  `)).toEqual({ ok: true, value: GOOD_TOKEN });
  });

  it('rejects empty / too-short / non-string input', () => {
    expect(validateToken('').ok).toBe(false);
    expect(validateToken('short').ok).toBe(false);
    expect(validateToken(null).ok).toBe(false);
    expect(validateToken(1688).ok).toBe(false);
  });

  it('rejects any dev/shell metacharacter or whitespace (injection signal)', () => {
    expect(validateToken("api.'; rm -rf /").ok).toBe(false);
    expect(validateToken('api.<script>alert(1)</script>xx').ok).toBe(false);
    expect(validateToken('api.$(whoami).abcdefghijklmno').ok).toBe(false);
    expect(validateToken('api.{abc}[def]|ghijklmnop').ok).toBe(false);
    expect(validateToken('api abc123 def456 ghi789 jkl0').ok).toBe(false);
  });

  it('rejects absurdly long input (boundary)', () => {
    expect(validateToken('a'.repeat(5000)).ok).toBe(false);
  });
});
