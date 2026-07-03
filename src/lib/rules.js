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
