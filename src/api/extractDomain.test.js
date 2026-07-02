// Tests for extractDomain(text): pulls a bare domain out of arbitrary clipboard
// text, or returns null. Behavior verified against the implementation:
//   - guards falsy input and text longer than 2000 chars
//   - tries URL parsing first (prepending https:// if no scheme), lowercases the
//     hostname, strips a leading "www.", validates against VALID_DOMAIN_RE
//   - falls back to treating the trimmed text as a bare domain
import { describe, it, expect } from 'vitest';
import { extractDomain } from './controld.js';

describe('extractDomain', () => {
  describe('rejects invalid input', () => {
    it('returns null for empty / falsy input', () => {
      expect(extractDomain('')).toBeNull();
      expect(extractDomain(null)).toBeNull();
      expect(extractDomain(undefined)).toBeNull();
    });

    it('returns null for over-long input (> 2000 chars)', () => {
      expect(extractDomain('a'.repeat(2001) + '.com')).toBeNull();
    });

    it('returns null for text that is not a domain', () => {
      expect(extractDomain('notadomain')).toBeNull(); // no TLD
      expect(extractDomain('not a domain')).toBeNull(); // whitespace inside
      expect(extractDomain('hello world')).toBeNull();
    });

    it('returns null for an IP address (TLD is not alphabetic)', () => {
      expect(extractDomain('192.168.1.1')).toBeNull();
    });
  });

  describe('extracts bare domains', () => {
    it('accepts a plain domain', () => {
      expect(extractDomain('example.com')).toBe('example.com');
    });

    it('preserves subdomains other than www', () => {
      expect(extractDomain('blog.example.com')).toBe('blog.example.com');
    });

    it('accepts multi-label TLDs', () => {
      expect(extractDomain('example.co.uk')).toBe('example.co.uk');
    });
  });

  describe('normalizes input', () => {
    it('strips a leading www.', () => {
      expect(extractDomain('www.example.com')).toBe('example.com');
    });

    it('lowercases the domain', () => {
      expect(extractDomain('EXAMPLE.COM')).toBe('example.com');
    });

    it('trims surrounding whitespace', () => {
      expect(extractDomain('  example.com  ')).toBe('example.com');
    });
  });

  describe('extracts the host from full URLs', () => {
    it('handles https URLs with path and query', () => {
      expect(extractDomain('https://www.example.com/path?x=1')).toBe('example.com');
    });

    it('handles http URLs', () => {
      expect(extractDomain('http://example.com')).toBe('example.com');
    });
  });
});
