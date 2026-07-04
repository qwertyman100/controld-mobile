# Default Rule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user view and set a profile's default rule (the catch-all for unmatched DNS queries) — Block / Bypass / Redirect — from a banner on the Rules screen.

**Architecture:** A pinned banner at the top of the Rules screen (`CustomRules.jsx`) shows the current default (`profile.da`) and opens a `DefaultRuleSheet` bottom sheet. Pure logic (normalise/build/validate) lives in `src/lib/defaultRule.js`, TDD'd. The write goes through a new `api.setDefaultRule` → `PUT /profiles/{id}/default`, with the same optimistic-update + rollback + toast pattern as custom rules.

**Tech Stack:** React 18, Vite 6, Vitest 3 + jsdom + @testing-library/react, Tailwind v4, lucide-react.

## Global Constraints

- Default-rule actions are **Block (do:0), Bypass (do:1), Redirect (do:3) only — NO Spoof**.
- Write endpoint: **`PUT /profiles/{id}/default`**, form-encoded body `{do, status, via?}`. Always send `status: 1`.
- **Redirect requires a `via`** (a proxy/location PK from `getProxies()`); Redirect with no location must be blocked client-side (API returns 400 otherwise). Block/Bypass send no `via`.
- Reuse existing action colors verbatim: Bypass `text-green-500`, Block `text-red-500`, Redirect `text-blue-400`.
- Reuse the existing bottom-sheet overlay pattern (`fixed inset-0 z-50 flex items-end` + `bg-slate-900/45` scrim + `rounded-t-2xl` panel) from `FilterLevelSheet.jsx`.
- No free-text inputs in this feature (location is a controlled `<select>`); the Block guardrail warning copy is fixed (see Task 2).
- `RULE_ACTION` is imported from `../api/controld` (`BLOCK:0, BYPASS:1, SPOOF:2, REDIRECT:3`).

---

### Task 1: Pure logic — `src/lib/defaultRule.js`

**Files:**
- Create: `src/lib/defaultRule.js`
- Test: `src/lib/defaultRule.test.js`

**Interfaces:**
- Consumes: `RULE_ACTION` from `src/api/controld.js`.
- Produces:
  - `DEFAULT_ACTIONS`: ordered array `[{do, key, label, color, bg, desc}]` for Block, Bypass, Redirect.
  - `normaliseDefaultAction(da) → {do:number, status:number, via:string|null}`
  - `buildDefaultRulePayload(doCode, {via}={}) → {do, status:1, via?}`
  - `validateDefaultRule(doCode, {via}={}) → {ok:boolean, error?:string}`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/defaultRule.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_ACTIONS,
  normaliseDefaultAction,
  buildDefaultRulePayload,
  validateDefaultRule,
} from './defaultRule';

describe('DEFAULT_ACTIONS', () => {
  it('offers exactly Block, Bypass, Redirect (no Spoof)', () => {
    expect(DEFAULT_ACTIONS.map((a) => a.label)).toEqual(['Block', 'Bypass', 'Redirect']);
    expect(DEFAULT_ACTIONS.map((a) => a.do)).toEqual([0, 1, 3]);
  });
});

describe('normaliseDefaultAction', () => {
  it('reads a Block default', () => {
    expect(normaliseDefaultAction({ do: 0, status: 1 })).toEqual({ do: 0, status: 1, via: null });
  });
  it('reads a Redirect default with via', () => {
    expect(normaliseDefaultAction({ do: 3, status: 1, via: 'DFW' })).toEqual({ do: 3, status: 1, via: 'DFW' });
  });
  it('falls back to Bypass for null/undefined da', () => {
    expect(normaliseDefaultAction(null)).toEqual({ do: 1, status: 1, via: null });
    expect(normaliseDefaultAction(undefined)).toEqual({ do: 1, status: 1, via: null });
  });
  it('coerces string numerics', () => {
    expect(normaliseDefaultAction({ do: '0', status: '1' })).toEqual({ do: 0, status: 1, via: null });
  });
});

describe('buildDefaultRulePayload', () => {
  it('block → {do:0,status:1}', () => {
    expect(buildDefaultRulePayload(0)).toEqual({ do: 0, status: 1 });
  });
  it('bypass → {do:1,status:1}', () => {
    expect(buildDefaultRulePayload(1)).toEqual({ do: 1, status: 1 });
  });
  it('redirect with via → includes via', () => {
    expect(buildDefaultRulePayload(3, { via: 'DFW' })).toEqual({ do: 3, status: 1, via: 'DFW' });
  });
  it('never adds via for block/bypass', () => {
    expect(buildDefaultRulePayload(0, { via: 'DFW' })).toEqual({ do: 0, status: 1 });
  });
});

describe('validateDefaultRule', () => {
  it('rejects redirect with no location', () => {
    expect(validateDefaultRule(3, {})).toEqual({ ok: false, error: 'Choose a location to redirect to.' });
  });
  it('accepts redirect with a location', () => {
    expect(validateDefaultRule(3, { via: 'DFW' })).toEqual({ ok: true });
  });
  it('accepts block and bypass', () => {
    expect(validateDefaultRule(0)).toEqual({ ok: true });
    expect(validateDefaultRule(1)).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/defaultRule.test.js`
Expected: FAIL — "Failed to resolve import './defaultRule'" / functions undefined.

- [ ] **Step 3: Write the implementation**

Create `src/lib/defaultRule.js`:

```js
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/defaultRule.test.js`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/defaultRule.js src/lib/defaultRule.test.js
git commit -m "feat(default-rule): pure logic (normalise/build/validate) + tests"
```

---

### Task 2: `DefaultRuleSheet` component

**Files:**
- Create: `src/components/DefaultRuleSheet.jsx`
- Test: `src/components/DefaultRuleSheet.test.jsx`

**Interfaces:**
- Consumes: `RULE_ACTION` from `../api/controld`; `DEFAULT_ACTIONS`, `validateDefaultRule`, `buildDefaultRulePayload` from `../lib/defaultRule` (Task 1).
- Produces: `default export DefaultRuleSheet({ da, proxies=[], onSave, onClose })`.
  `da` is `{do, status, via}` (Task 1 shape). Calls `onSave(payload)` with a `buildDefaultRulePayload` result. Calls `onClose()` on scrim/close.

- [ ] **Step 1: Write the failing component tests**

Create `src/components/DefaultRuleSheet.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DefaultRuleSheet from './DefaultRuleSheet';

const proxies = [{ PK: 'DFW', city: 'Dallas', country: 'US' }];

function renderSheet(overrides = {}) {
  const props = {
    da: { do: 1, status: 1, via: null },
    proxies,
    onSave: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  render(<DefaultRuleSheet {...props} />);
  return props;
}

describe('DefaultRuleSheet', () => {
  it('selecting Redirect reveals the location select', () => {
    renderSheet();
    expect(screen.queryByText('Redirect location')).toBeNull();
    fireEvent.click(screen.getByText('Redirect'));
    expect(screen.getByText('Redirect location')).toBeInTheDocument();
  });

  it('selecting Block shows the allowlist warning', () => {
    renderSheet();
    fireEvent.click(screen.getByText('Block'));
    expect(screen.getByText(/allowlist/i)).toBeInTheDocument();
  });

  it('blocks saving Redirect with no location and does not call onSave', () => {
    const { onSave } = renderSheet();
    fireEvent.click(screen.getByText('Redirect'));
    fireEvent.click(screen.getByText('Save'));
    expect(screen.getByRole('alert')).toHaveTextContent(/choose a location/i);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('saving Bypass calls onSave with {do:1,status:1}', () => {
    const { onSave } = renderSheet({ da: { do: 0, status: 1, via: null } });
    fireEvent.click(screen.getByText('Bypass'));
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledWith({ do: 1, status: 1 });
  });

  it('saving Redirect with a location calls onSave with the via', () => {
    const { onSave } = renderSheet();
    fireEvent.click(screen.getByText('Redirect'));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'DFW' } });
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledWith({ do: 3, status: 1, via: 'DFW' });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/DefaultRuleSheet.test.jsx`
Expected: FAIL — cannot resolve `./DefaultRuleSheet`.

- [ ] **Step 3: Write the component**

Create `src/components/DefaultRuleSheet.jsx`:

```jsx
import { useState } from 'react';
import { X } from 'lucide-react';
import { RULE_ACTION } from '../api/controld';
import { DEFAULT_ACTIONS, validateDefaultRule, buildDefaultRulePayload } from '../lib/defaultRule';

export default function DefaultRuleSheet({ da, proxies = [], onSave, onClose }) {
  const [action, setAction] = useState(da.do);
  const [via, setVia] = useState(da.via ?? '');
  const [error, setError] = useState(null);

  function handleSave() {
    const check = validateDefaultRule(action, { via });
    if (!check.ok) {
      setError(check.error);
      return;
    }
    onSave(buildDefaultRulePayload(action, { via }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/45" />
      <div
        className="relative w-full bg-white dark:bg-slate-800 rounded-t-2xl p-4 pb-6 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">Default Rule</h4>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 p-1"><X size={18} /></button>
        </div>
        <p className="text-xs text-slate-400 mb-3">
          Applies to any domain that doesn't match a rule, service, or filter.
        </p>

        <div className="flex flex-col gap-2">
          {DEFAULT_ACTIONS.map((a) => {
            const on = action === a.do;
            return (
              <button
                key={a.key}
                type="button"
                onClick={() => { setAction(a.do); setError(null); }}
                className={`text-left p-3 rounded-xl border transition-colors ${
                  on ? `${a.bg} border-current ${a.color}` : 'bg-transparent border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className={`text-sm font-semibold ${on ? a.color : 'text-slate-700 dark:text-slate-200'}`}>{a.label}</div>
                <div className="text-xs text-slate-400 mt-0.5">{a.desc}</div>
              </button>
            );
          })}
        </div>

        {action === RULE_ACTION.BLOCK && (
          <p className="mt-3 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/25 rounded-lg p-2">
            Block makes this profile an allowlist — only domains you've allowed with a Bypass rule will resolve.
            Everything else, including brand-new domains, is denied.
          </p>
        )}

        {action === RULE_ACTION.REDIRECT && (
          <div className="mt-3">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Redirect location</label>
            <select
              value={via}
              onChange={(e) => { setVia(e.target.value); setError(null); }}
              className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-sm"
            >
              <option value="">Choose a location…</option>
              {proxies.map((p) => {
                const id = p.PK ?? p.pk ?? p.id ?? p.name ?? '';
                const label = p.name ?? p.city ?? p.label ?? id;
                const country = p.country;
                return <option key={id} value={id}>{country ? `${country} — ${label}` : label}</option>;
              })}
            </select>
          </div>
        )}

        {error && <p role="alert" className="mt-2 text-xs text-red-500">{error}</p>}

        <button
          onClick={handleSave}
          className="mt-4 w-full bg-green-500 text-white font-semibold text-sm py-3 rounded-xl"
        >
          Save
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/DefaultRuleSheet.test.jsx`
Expected: PASS (all 5 cases).

- [ ] **Step 5: Commit**

```bash
git add src/components/DefaultRuleSheet.jsx src/components/DefaultRuleSheet.test.jsx
git commit -m "feat(default-rule): DefaultRuleSheet (3 actions, Block warning, location picker) + tests"
```

---

### Task 3: `setDefaultRule` API + `DefaultRuleBanner` + wire into Rules screen

**Files:**
- Modify: `src/api/controld.js` (add `setDefaultRule` to the `api` object)
- Create: `src/components/DefaultRuleBanner.jsx`
- Create: `src/components/DefaultRuleBanner.test.jsx`
- Modify: `src/components/CustomRules.jsx` (render the banner atop the Rules screen)

**Interfaces:**
- Consumes: `api` + `toArray` from `../api/controld`; `useAuth`, `useToast`; `DEFAULT_ACTIONS`, `normaliseDefaultAction` from `../lib/defaultRule` (Task 1); `DefaultRuleSheet` (Task 2).
- Produces: `api.setDefaultRule(token, profileId, payload)`; `default export DefaultRuleBanner({ profile })`.

- [ ] **Step 1: Add the API method**

In `src/api/controld.js`, inside the `api` object, add next to the other profile methods (e.g. right after `setOption`):

```js
  // Default rule (catch-all "da"). Undocumented endpoint, verified live:
  // PUT /profiles/{id}/default with form { do, status, via? }. Redirect (do:3)
  // requires a via (location PK); do:3 with no via is rejected 400.
  setDefaultRule: (token, profileId, payload) =>
    request(token, 'PUT', `/profiles/${encodeURIComponent(profileId)}/default`, payload),
```

- [ ] **Step 2: Write the failing banner tests**

Create `src/components/DefaultRuleBanner.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Hoisted spies — vi.mock is hoisted above top-level consts.
const { getProfiles, getProxies, getUser, setDefaultRule } = vi.hoisted(() => ({
  getProfiles: vi.fn(async () => ({ profiles: [{ PK: 'p1', profile: { da: { do: 0, status: 1 } } }] })),
  getProxies: vi.fn(async () => ({ proxies: [{ PK: 'DFW', city: 'Dallas', country: 'US' }] })),
  getUser: vi.fn(async () => ({})),
  setDefaultRule: vi.fn(async () => ({})),
}));

vi.mock('../api/controld', async (orig) => {
  const actual = await orig();
  return { ...actual, api: { getProfiles, getProxies, getUser, setDefaultRule } };
});

import { AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../context/ToastContext';
import DefaultRuleBanner from './DefaultRuleBanner';

function renderBanner() {
  render(
    <ToastProvider>
      <AuthProvider>
        <DefaultRuleBanner profile={{ PK: 'p1', name: 'Test', profile: { da: { do: 0, status: 1 } } }} />
      </AuthProvider>
    </ToastProvider>
  );
}

describe('DefaultRuleBanner', () => {
  beforeEach(() => {
    localStorage.setItem('cd_token', 'test-token');
    setDefaultRule.mockClear();
  });

  it('shows the current default action', async () => {
    renderBanner();
    await waitFor(() => expect(screen.getByText('Block')).toBeInTheDocument());
  });

  it('saving a new action calls setDefaultRule with the built payload', async () => {
    renderBanner();
    await waitFor(() => expect(screen.getByText('Block')).toBeInTheDocument());
    fireEvent.click(screen.getByText('When nothing matches'));   // open the sheet
    fireEvent.click(screen.getByText('Bypass'));                  // choose Bypass (sheet option)
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(setDefaultRule).toHaveBeenCalledTimes(1));
    expect(setDefaultRule.mock.calls[0][1]).toBe('p1');
    expect(setDefaultRule.mock.calls[0][2]).toEqual({ do: 1, status: 1 });
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/components/DefaultRuleBanner.test.jsx`
Expected: FAIL — cannot resolve `./DefaultRuleBanner`.

- [ ] **Step 4: Write the banner component**

Create `src/components/DefaultRuleBanner.jsx`:

```jsx
import { useState, useEffect, useCallback } from 'react';
import { ChevronRight } from 'lucide-react';
import { api, toArray } from '../api/controld';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { DEFAULT_ACTIONS, normaliseDefaultAction } from '../lib/defaultRule';
import DefaultRuleSheet from './DefaultRuleSheet';

export default function DefaultRuleBanner({ profile }) {
  const { token } = useAuth();
  const toast = useToast();
  const profileId = profile?.PK ?? profile?.pk ?? profile?.id;

  // Seed instantly from the selected profile's cached da (no flash), then
  // refresh from the server so the banner shows the authoritative default.
  const [da, setDa] = useState(() => normaliseDefaultAction(profile?.profile?.da));
  const [proxies, setProxies] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!token || !profileId) return;
    api.getProfiles(token)
      .then((body) => {
        const list = toArray(body, 'profiles');
        const found = list.find((p) => (p.PK ?? p.pk ?? p.id) === profileId);
        if (found) setDa(normaliseDefaultAction(found.profile?.da));
      })
      .catch(() => {}); // keep the seeded value on failure
  }, [token, profileId]);

  useEffect(() => {
    if (!token) return;
    api.getProxies(token)
      .then((body) => setProxies(toArray(body, 'proxies')))
      .catch(() => {});
  }, [token]);

  const handleSave = useCallback(async (payload) => {
    setOpen(false);
    const prev = da;
    setDa(normaliseDefaultAction(payload)); // optimistic
    try {
      await api.setDefaultRule(token, profileId, payload);
      toast('Default rule updated', 'success');
    } catch (err) {
      setDa(prev); // rollback
      toast(err.message, 'error');
    }
  }, [da, token, profileId, toast]);

  const meta = DEFAULT_ACTIONS.find((a) => a.do === da.do) ?? DEFAULT_ACTIONS[1];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-3 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl p-3 text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">When nothing matches</div>
          <div className={`text-sm font-semibold mt-0.5 ${meta.color}`}>{meta.label}</div>
        </div>
        <ChevronRight size={16} className="text-slate-400" />
      </button>
      {open && (
        <DefaultRuleSheet da={da} proxies={proxies} onSave={handleSave} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/components/DefaultRuleBanner.test.jsx`
Expected: PASS (both cases).

- [ ] **Step 6: Wire the banner into the Rules screen**

In `src/components/CustomRules.jsx`:

1. Add the import near the other component imports at the top:

```jsx
import DefaultRuleBanner from './DefaultRuleBanner';
```

2. In the main `return (` (the one that starts `<div className="flex flex-col h-full">`), insert the banner as the **first child**, immediately before the `{/* ── Quick-Add Bar ... */}` block:

```jsx
  return (
    <div className="flex flex-col h-full">
      {/* ── Default rule (catch-all) banner ── */}
      <div className="shrink-0 px-3 pt-3">
        <DefaultRuleBanner profile={profile} />
      </div>

      {/* ── Quick-Add Bar — always visible at top ── */}
      <div className="shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-3">
```

- [ ] **Step 7: Run the full suite + build to verify nothing regressed**

Run: `npm test`
Expected: PASS — previous 93 tests + the new defaultRule/DefaultRuleSheet/DefaultRuleBanner tests, all green.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/api/controld.js src/components/DefaultRuleBanner.jsx src/components/DefaultRuleBanner.test.jsx src/components/CustomRules.jsx
git commit -m "feat(default-rule): setDefaultRule API + banner on Rules screen + wiring"
```

---

## Post-implementation: live verification (controller, after merge)

Not a subagent task — run after the branch merges to master, using the token-relay + Playwright pattern on the **empty Phone Extras** profile (`499929sjcgpis`), restoring to `da:{do:1,status:1}` (Bypass) at the end:

1. Load the Rules screen for Phone Extras → banner shows **Bypass**.
2. Tap the banner → set **Block** → confirm the allowlist warning appeared, Save → verify `GET /profiles` shows `da.do:0` for the profile, and the banner now reads **Block**.
3. Tap again → set **Redirect** + pick a location → Save → verify `da:{do:3, via:<code>}` server-side.
4. Set back to **Bypass** → verify `da:{do:1}` restored.

## Notes for the implementer

- Do **not** add a Spoof option anywhere — the default rule is 3 actions only.
- Do **not** send `via` for Block/Bypass; do **not** allow Redirect to save without a location.
- Match the existing optimistic-update + rollback + toast pattern (see `toggleRule`/`handleEditSave` in `CustomRules.jsx`).
- The `.claude/worktrees/**` vitest exclude is already in `vite.config.js`; run `npm test` from the repo root normally.
