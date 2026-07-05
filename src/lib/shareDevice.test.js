import { describe, it, expect } from 'vitest';
import { buildShareUrl } from './shareDevice';

describe('buildShareUrl', () => {
  it('returns a normal origin unchanged', () => {
    expect(buildShareUrl('https://controld-mobile.pages.dev')).toBe('https://controld-mobile.pages.dev');
  });
  it('strips trailing slash(es)', () => {
    expect(buildShareUrl('https://x.pages.dev/')).toBe('https://x.pages.dev');
    expect(buildShareUrl('https://x.pages.dev///')).toBe('https://x.pages.dev');
  });
  it('trims whitespace', () => {
    expect(buildShareUrl('  https://x.pages.dev  ')).toBe('https://x.pages.dev');
  });
  it('returns empty string for empty/nullish', () => {
    expect(buildShareUrl('')).toBe('');
    expect(buildShareUrl(null)).toBe('');
    expect(buildShareUrl(undefined)).toBe('');
  });
});
