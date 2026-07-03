import { RULE_ACTION } from '../api/controld';

/**
 * Normalize a rule to a flat shape. The API nests do/status/via under `action`
 * (top-level are null); the optimistic-prepend shape is flat — read action first,
 * fall back to flat. Numeric hostname/PK coerced to string (the "1688" crash class).
 */
export function normaliseRule(r) {
  const a = (r && r.action) || {};
  return {
    hostname: String(r?.hostname ?? r?.PK ?? r?.pk ?? ''),
    do: Number(a.do ?? r?.do ?? RULE_ACTION.BYPASS),
    status: Number(a.status ?? r?.status ?? 1),
    group: r?.group ?? null,
    via: a.via ?? r?.via ?? null,
    via_v6: a.via_v6 ?? r?.via_v6 ?? null,
    _raw: r,
  };
}

// Helper: Check if a string is a valid IPv4 address.
function isIPv4(s) {
  const parts = s.split('.');
  return parts.length === 4 && parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255);
}

// Helper: Check if a string is a valid hostname (dot-separated labels of alphanumerics+hyphens; no TLD required).
function isHostname(s) {
  if (s.length > 253) return false;
  // Dot-separated labels of letters/digits with internal hyphens; no TLD requirement.
  return /^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)*$/.test(s);
}

// Helper: Check if a string looks like IPv6 (hex and colons, with :: or multiple : separators).
function isIPv6(s) {
  if (!/^[0-9A-Fa-f:]+$/.test(s)) return false;
  return s.includes('::') || (s.match(/:/g) || []).length >= 2;
}

/**
 * Validate a Spoof target. Main field: an IPv4 address OR a hostname (no TLD needed).
 * ipv6 mode: a "looks like IPv6" address (hex+colons) — final validation is the API's.
 * A numeric-dotted string is checked strictly as IPv4 so "999.1.1.1" can't slip through
 * as a hostname.
 */
export function validateSpoofTarget(value, { ipv6 = false } = {}) {
  const v = String(value ?? '').trim();
  if (!v) return { ok: false, error: 'Enter a target address.' };
  if (ipv6) {
    return isIPv6(v) ? { ok: true, value: v } : { ok: false, error: 'Not a valid IPv6 address.' };
  }
  if (/^[0-9.]+$/.test(v)) {
    return isIPv4(v) ? { ok: true, value: v } : { ok: false, error: 'Not a valid IP address.' };
  }
  return isHostname(v) ? { ok: true, value: v } : { ok: false, error: 'Enter an IPv4 address or hostname.' };
}

/** Build the create/update rule body for an action + target (caller adds hostname(s)). */
export function buildRulePayload(doCode, { via, viaV6 } = {}) {
  const payload = { do: doCode, status: 1 };
  if ((doCode === RULE_ACTION.REDIRECT || doCode === RULE_ACTION.SPOOF) && via) payload.via = via;
  if (doCode === RULE_ACTION.SPOOF && viaV6) payload.via_v6 = viaV6;
  return payload;
}
