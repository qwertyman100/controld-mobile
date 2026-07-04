import { RULE_ACTION } from '../api/controld';

// The profile default rule ("da") supports only three actions — no Spoof.
// Ordered for display in the sheet. Colors match the app's action palette.
export const DEFAULT_ACTIONS = [
  {
    do: RULE_ACTION.BLOCK,
    key: 'block',
    label: 'Block',
    color: 'text-red-500',
    bg: 'bg-red-500/10 border-red-500/25',
    desc: "Nothing resolves unless you've allowed it with a Bypass rule.",
  },
  {
    do: RULE_ACTION.BYPASS,
    key: 'bypass',
    label: 'Bypass',
    color: 'text-green-500',
    bg: 'bg-green-500/10 border-green-500/25',
    desc: 'Resolve normally — the standard default.',
  },
  {
    do: RULE_ACTION.REDIRECT,
    key: 'redirect',
    label: 'Redirect',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/25',
    desc: 'Route everything else through a location.',
  },
];

// Read a profile's default action (profile.da) into a stable shape. A missing
// or null `da` (e.g. a brand-new profile) falls back to Bypass. Numeric fields
// are coerced (the API sometimes returns them as strings).
export function normaliseDefaultAction(da) {
  return {
    do: Number(da?.do ?? RULE_ACTION.BYPASS),
    status: Number(da?.status ?? 1),
    via: da?.via ?? null,
  };
}

// Build the PUT /profiles/{id}/default body. `via` is included ONLY for
// Redirect; Block/Bypass carry just {do, status}.
export function buildDefaultRulePayload(doCode, { via } = {}) {
  const payload = { do: doCode, status: 1 };
  if (doCode === RULE_ACTION.REDIRECT && via) payload.via = via;
  return payload;
}

// Validate before saving. Redirect must have a location (the API rejects
// do:3 with no via as 400 "Invalid default action rule").
export function validateDefaultRule(doCode, { via } = {}) {
  if (doCode === RULE_ACTION.REDIRECT && !via) {
    return { ok: false, error: 'Choose a location to redirect to.' };
  }
  return { ok: true };
}
