// Central input-hardening policy. ALLOWLIST-based: permit only the characters a
// field legitimately needs and drop/reject everything else. Dev/shell
// metacharacters ({ } [ ] | < > ; $ & ( ) ` ' " \ etc.) are never needed in these
// fields and their presence is an injection signal — an allowlist excludes them by
// construction, so there's no denylist to keep exhaustive.

const SEARCH_MAXLEN = 128;
const TOKEN_MIN = 16;
const TOKEN_MAX = 256;
// English letters, digits, and the only punctuation a ControlD token uses.
const TOKEN_RE = /^[A-Za-z0-9._-]+$/;

/**
 * Free-text / search policy. Coerce to string (guards the numeric-name crash),
 * keep English letters, digits, spaces, and the punctuation that appears in real
 * service names (& . + / - — e.g. "A&E TV", "Last.fm", "AMC+", "Edgio / Edgecast",
 * "D-Link"); strip everything else, including shell/code metacharacters. Strips
 * rather than rejects so live-search stays smooth while enforcing the allowlist.
 * (Safe: this value only feeds a client-side substring filter + React-escaped
 * render — no SQL/shell/DOM sink — so the allowlist here is hygiene, not the
 * injection defense.)
 */
export function sanitizeSearchQuery(raw) {
  return String(raw ?? '')
    .replace(/[^A-Za-z0-9 &.+/-]/g, '')
    .slice(0, SEARCH_MAXLEN);
}

/**
 * Semantic-field policy for the API token. Strict allowlist [A-Za-z0-9._-] plus
 * length bounds (the live token is 68 chars of this set). Returns
 * { ok: true, value } (trimmed) or { ok: false, error }. Rejects rather than
 * strips — a malformed token must fail loudly, never be silently mangled and sent.
 */
export function validateToken(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return { ok: false, error: 'Enter your API token.' };
  if (value.length < TOKEN_MIN || value.length > TOKEN_MAX) {
    return { ok: false, error: 'That doesn’t look like a valid token length.' };
  }
  if (!TOKEN_RE.test(value)) {
    return { ok: false, error: 'Token contains invalid characters.' };
  }
  return { ok: true, value };
}
