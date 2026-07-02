// Control D action codes -> UI action names. Only these three apply to services.
const DO_TO_ACTION = { 0: 'block', 1: 'bypass', 3: 'redirect' };

/**
 * Merge the (large) global catalog with the (sparse) per-profile configured
 * services so each app carries its current action. Only status===1 entries
 * count as "set"; a disabled entry (status 0) reads as no action.
 */
export function mergeServiceState(catalog, configured) {
  const byPk = new Map((configured ?? []).map((c) => [c.PK, c]));
  return (catalog ?? []).map((s) => {
    const c = byPk.get(s.PK);
    const active = c && c.status === 1;
    return {
      ...s,
      action: active ? (DO_TO_ACTION[c.do] ?? null) : null,
      via: active ? (c.via ?? null) : null,
      status: active ? 1 : 0,
    };
  });
}
