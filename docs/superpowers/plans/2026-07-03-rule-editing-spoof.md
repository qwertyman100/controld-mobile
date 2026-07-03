# Rule Editing + Spoof Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix rule action reading (nested `action`), add the Spoof action with a validated IP/hostname target, and let users edit an existing rule's action + target via a pencil→sheet.

**Architecture:** Three TDD'd pure functions in `src/lib/rules.js` (normalise, validate, build payload); a shared `RuleActionTarget` editor used by both the add bar and a new `RuleEditSheet`; `CustomRules.jsx` wires them in. Follows existing sheet/optimistic patterns.

**Tech Stack:** React 18, Vite 6, Vitest 3 (+ jsdom/Testing Library), Tailwind 4, lucide-react.

## Global Constraints

- `RULE_ACTION` (from `src/api/controld.js`): `BLOCK=0, BYPASS=1, SPOOF=2, REDIRECT=3`.
- Live rule shape nests the action: `{ PK, order, group, action: { do, status, via, via_v6 } }`. Read `action.*` first, top-level as fallback (optimistic-prepend shape is flat).
- Input hardening: Spoof target goes through `validateSpoofTarget` (allowlist; rejects anything with metacharacters/spaces). No `dangerouslySetInnerHTML`. API path params already `encodeURIComponent`'d; rule bodies form-encoded.
- Pure functions TDD'd; React components verified by `npm run build` + jsdom component tests. No new dependencies.
- Branch `feat/rule-editing-spoof`; commit locally per task; do NOT push. Commit messages end with:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` and
  `Claude-Session: https://claude.ai/code/session_01RqL4sGJWQAjcU7Q3mt7n9z`.

---

### Task 1: Move + fix `normaliseRule` → `src/lib/rules.js`

**Files:**
- Create: `src/lib/rules.js`, `src/lib/rules.test.js`
- Modify: `src/components/CustomRules.jsx` (remove local `normaliseRule`, import from lib)
- Delete: `src/components/CustomRules.normaliseRule.test.js`

**Interfaces:**
- Produces: `normaliseRule(rule) => { hostname: string, do: number, status: number, group, via: string|null, via_v6: string|null, _raw }`.

- [ ] **Step 1: Write the failing test**

```js
// src/lib/rules.test.js
import { describe, it, expect } from 'vitest';
import { normaliseRule } from './rules.js';

describe('normaliseRule', () => {
  it('reads the NESTED action (regression: was read from top level → always Bypass)', () => {
    const r = normaliseRule({ PK: 'samsungacr.com', order: 1, group: 0, action: { do: 0, status: 1 } });
    expect(r).toMatchObject({ hostname: 'samsungacr.com', do: 0, status: 1, group: 0, via: null, via_v6: null });
  });
  it('falls back to the flat optimistic-prepend shape', () => {
    expect(normaliseRule({ hostname: 'x.com', do: 1, status: 1 })).toMatchObject({ hostname: 'x.com', do: 1, status: 1 });
  });
  it('reads a spoof rule’s via / via_v6 from the action', () => {
    const r = normaliseRule({ PK: 'a.com', action: { do: 2, status: 1, via: '1.2.3.4', via_v6: '2001:db8::1' } });
    expect(r).toMatchObject({ do: 2, via: '1.2.3.4', via_v6: '2001:db8::1' });
  });
  it('coerces a numeric PK to a string (the "1688" class)', () => {
    expect(normaliseRule({ PK: 1688 }).hostname).toBe('1688');
  });
  it('defaults to Bypass/enabled on an empty object', () => {
    expect(normaliseRule({})).toMatchObject({ hostname: '', do: 1, status: 1 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/rules.test.js`
Expected: FAIL — cannot resolve `./rules.js`.

- [ ] **Step 3: Write minimal implementation**

```js
// src/lib/rules.js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/rules.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Point CustomRules at the lib and drop the old copy/test**

In `src/components/CustomRules.jsx`: delete the local `function normaliseRule(...) {...}` (currently near the top), and add to the imports:
```jsx
import { normaliseRule } from '../lib/rules';
```
Then remove the now-stale test file:
```bash
git rm src/components/CustomRules.normaliseRule.test.js
```

- [ ] **Step 6: Verify build + full suite**

Run: `npm run build && npm test`
Expected: build succeeds; all tests pass (new `rules.test.js` included).

- [ ] **Step 7: Commit**

```bash
git add src/lib/rules.js src/lib/rules.test.js src/components/CustomRules.jsx
git commit -m "fix(rules): normaliseRule reads nested action (+ move to lib) + tests"
```

---

### Task 2: `validateSpoofTarget`

**Files:**
- Modify: `src/lib/rules.js`, `src/lib/rules.test.js`

**Interfaces:**
- Produces: `validateSpoofTarget(value, { ipv6 } = {}) => { ok: boolean, value?: string, error?: string }`.

- [ ] **Step 1: Write the failing test** (append)

```js
import { validateSpoofTarget } from './rules.js';

describe('validateSpoofTarget', () => {
  it('accepts IPv4 and hostnames (no TLD required)', () => {
    for (const v of ['192.168.1.50', '100.64.1.5', 'myserver.home', 'nas', 'example.com']) {
      expect(validateSpoofTarget(v).ok).toBe(true);
    }
  });
  it('rejects a numeric-dotted string that is not a valid IPv4', () => {
    expect(validateSpoofTarget('999.1.1.1').ok).toBe(false); // octet > 255
  });
  it('rejects empty, whitespace, and metacharacters', () => {
    expect(validateSpoofTarget('').ok).toBe(false);
    expect(validateSpoofTarget('has space').ok).toBe(false);
    expect(validateSpoofTarget('bad;$char').ok).toBe(false);
  });
  it('validates IPv6 only in ipv6 mode', () => {
    expect(validateSpoofTarget('2001:db8::1', { ipv6: true }).ok).toBe(true);
    expect(validateSpoofTarget('::1', { ipv6: true }).ok).toBe(true);
    expect(validateSpoofTarget('1.2.3.4', { ipv6: true }).ok).toBe(false); // no colons
    expect(validateSpoofTarget('nothex!', { ipv6: true }).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/rules.test.js`
Expected: FAIL — `validateSpoofTarget is not a function`.

- [ ] **Step 3: Write minimal implementation** (append to `src/lib/rules.js`)

```js
function isIPv4(s) {
  const parts = s.split('.');
  return parts.length === 4 && parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255);
}
function isHostname(s) {
  if (s.length > 253) return false;
  // Dot-separated labels of letters/digits with internal hyphens; no TLD requirement.
  return /^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)*$/.test(s);
}
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/rules.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/rules.js src/lib/rules.test.js
git commit -m "feat(rules): validateSpoofTarget (IPv4/hostname/IPv6 allowlist) + tests"
```

---

### Task 3: `buildRulePayload`

**Files:**
- Modify: `src/lib/rules.js`, `src/lib/rules.test.js`

**Interfaces:**
- Produces: `buildRulePayload(doCode, { via, viaV6 } = {}) => { do, status, via?, via_v6? }`.

- [ ] **Step 1: Write the failing test** (append)

```js
import { buildRulePayload } from './rules.js';
import { RULE_ACTION } from '../api/controld';

describe('buildRulePayload', () => {
  it('bypass / block carry no target', () => {
    expect(buildRulePayload(RULE_ACTION.BYPASS)).toEqual({ do: 1, status: 1 });
    expect(buildRulePayload(RULE_ACTION.BLOCK)).toEqual({ do: 0, status: 1 });
  });
  it('redirect carries via', () => {
    expect(buildRulePayload(RULE_ACTION.REDIRECT, { via: 'JFK' })).toEqual({ do: 3, status: 1, via: 'JFK' });
  });
  it('spoof carries via and, when given, via_v6', () => {
    expect(buildRulePayload(RULE_ACTION.SPOOF, { via: '1.2.3.4' })).toEqual({ do: 2, status: 1, via: '1.2.3.4' });
    expect(buildRulePayload(RULE_ACTION.SPOOF, { via: '1.2.3.4', viaV6: '2001:db8::1' })).toEqual({
      do: 2, status: 1, via: '1.2.3.4', via_v6: '2001:db8::1',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/rules.test.js`
Expected: FAIL — `buildRulePayload is not a function`.

- [ ] **Step 3: Write minimal implementation** (append to `src/lib/rules.js`)

```js
/** Build the create/update rule body for an action + target (caller adds hostname(s)). */
export function buildRulePayload(doCode, { via, viaV6 } = {}) {
  const payload = { do: doCode, status: 1 };
  if ((doCode === RULE_ACTION.REDIRECT || doCode === RULE_ACTION.SPOOF) && via) payload.via = via;
  if (doCode === RULE_ACTION.SPOOF && viaV6) payload.via_v6 = viaV6;
  return payload;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/rules.test.js`
Expected: PASS (all rules.test.js).

- [ ] **Step 5: Commit**

```bash
git add src/lib/rules.js src/lib/rules.test.js
git commit -m "feat(rules): buildRulePayload action+target → API body + tests"
```

---

### Task 4: `RuleActionTarget` shared editor

**Files:**
- Create: `src/components/RuleActionTarget.jsx`

**Interfaces:**
- Consumes: `RULE_ACTION` from `../api/controld`.
- Produces: `ACTION_META` (export) and `<RuleActionTarget action onActionChange via onViaChange viaV6 onViaV6Change proxies />`.

- [ ] **Step 1: Write the component**

```jsx
// src/components/RuleActionTarget.jsx
import { useState } from 'react';
import { RULE_ACTION } from '../api/controld';

// Shared action metadata (label + colours), incl. Spoof. Imported by CustomRules too.
export const ACTION_META = {
  [RULE_ACTION.BYPASS]:   { label: 'Bypass',   color: 'text-green-500',  bg: 'bg-green-500/10 border-green-500/25' },
  [RULE_ACTION.BLOCK]:    { label: 'Block',    color: 'text-red-500',    bg: 'bg-red-500/10 border-red-500/25' },
  [RULE_ACTION.REDIRECT]: { label: 'Redirect', color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/25' },
  [RULE_ACTION.SPOOF]:    { label: 'Spoof',    color: 'text-purple-500', bg: 'bg-purple-500/10 border-purple-500/25' },
};

const ORDER = [RULE_ACTION.BYPASS, RULE_ACTION.BLOCK, RULE_ACTION.REDIRECT, RULE_ACTION.SPOOF];

export default function RuleActionTarget({
  action, onActionChange, via, onViaChange, viaV6, onViaV6Change, proxies = [],
}) {
  const [showV6, setShowV6] = useState(!!viaV6);

  return (
    <div className="flex flex-col gap-2">
      {/* 4-action selector */}
      <div className="flex gap-2">
        {ORDER.map((val) => {
          const meta = ACTION_META[val];
          const on = action === val;
          return (
            <button
              key={val}
              type="button"
              onClick={() => onActionChange(val)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                on ? `${meta.bg} ${meta.color} border-current` : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500'
              }`}
            >
              {meta.label}
            </button>
          );
        })}
      </div>

      {/* Redirect → proxy picker */}
      {action === RULE_ACTION.REDIRECT && (
        <select
          value={via ?? ''}
          onChange={(e) => onViaChange(e.target.value)}
          className="w-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {proxies.length === 0 && <option value="">Loading proxies…</option>}
          {proxies.map((p) => {
            const id = p.PK ?? p.pk ?? p.id ?? p.name ?? '';
            const label = p.name ?? p.city ?? p.label ?? id;
            const country = p.country ?? p.country_name ?? p.country_code ?? '';
            return <option key={id} value={id}>{country ? `${country} — ${label}` : label}</option>;
          })}
        </select>
      )}

      {/* Spoof → IPv4/hostname target + optional IPv6 */}
      {action === RULE_ACTION.SPOOF && (
        <div className="flex flex-col gap-2">
          <input
            value={via ?? ''}
            onChange={(e) => onViaChange(e.target.value)}
            placeholder="Answer with: IPv4 or hostname (e.g. 100.64.1.5)"
            autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false}
            maxLength={253}
            className="w-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl px-3.5 py-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          {showV6 ? (
            <input
              value={viaV6 ?? ''}
              onChange={(e) => onViaV6Change(e.target.value)}
              placeholder="IPv6 target (e.g. 2001:db8::1)"
              autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false}
              maxLength={45}
              className="w-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl px-3.5 py-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          ) : (
            <button type="button" onClick={() => setShowV6(true)} className="self-start text-xs text-purple-500 font-medium px-1">
              + Add IPv6 target
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/RuleActionTarget.jsx
git commit -m "feat(rules): RuleActionTarget shared action+target editor (adds Spoof)"
```

---

### Task 5: `RuleEditSheet` + component test

**Files:**
- Create: `src/components/RuleEditSheet.jsx`, `src/components/RuleEditSheet.test.jsx`

**Interfaces:**
- Consumes: `RuleActionTarget`, `validateSpoofTarget`/`buildRulePayload` from `../lib/rules`, `RULE_ACTION`.
- Produces: `<RuleEditSheet rule proxies onSave onClose />` where `rule` is a normalised rule; `onSave(payload)` gets `buildRulePayload(...)` output.

- [ ] **Step 1: Write the component**

```jsx
// src/components/RuleEditSheet.jsx
import { useState } from 'react';
import { X } from 'lucide-react';
import { RULE_ACTION } from '../api/controld';
import { validateSpoofTarget, buildRulePayload } from '../lib/rules';
import RuleActionTarget from './RuleActionTarget';

export default function RuleEditSheet({ rule, proxies, onSave, onClose }) {
  const [action, setAction] = useState(rule.do);
  const [via, setVia] = useState(rule.via ?? '');
  const [viaV6, setViaV6] = useState(rule.via_v6 ?? '');
  const [error, setError] = useState(null);

  function handleSave() {
    if (action === RULE_ACTION.SPOOF) {
      const v = validateSpoofTarget(via);
      if (!v.ok) { setError(v.error); return; }
      if (viaV6) {
        const v6 = validateSpoofTarget(viaV6, { ipv6: true });
        if (!v6.ok) { setError(v6.error); return; }
      }
    }
    onSave(buildRulePayload(action, { via, viaV6 }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/45" />
      <div className="relative w-full bg-white dark:bg-slate-800 rounded-t-2xl p-4 pb-6 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate">{String(rule.hostname)}</h4>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 p-1"><X size={18} /></button>
        </div>
        <RuleActionTarget
          action={action}
          onActionChange={(a) => { setAction(a); setError(null); }}
          via={via} onViaChange={(v) => { setVia(v); setError(null); }}
          viaV6={viaV6} onViaV6Change={(v) => { setViaV6(v); setError(null); }}
          proxies={proxies}
        />
        {error ? <p className="text-xs text-red-400 mt-2 px-1">{error}</p> : null}
        <button onClick={handleSave} className="w-full mt-4 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-xl py-3 text-sm">
          Save
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write the component test**

```jsx
// src/components/RuleEditSheet.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RuleEditSheet from './RuleEditSheet';
import { RULE_ACTION } from '../api/controld';

const bypassRule = { hostname: 'x.com', do: RULE_ACTION.BYPASS, status: 1, via: null, via_v6: null };

describe('RuleEditSheet', () => {
  it('reveals the Spoof target input when Spoof is selected', () => {
    render(<RuleEditSheet rule={bypassRule} proxies={[]} onSave={() => {}} onClose={() => {}} />);
    expect(screen.queryByPlaceholderText(/IPv4 or hostname/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Spoof' }));
    expect(screen.getByPlaceholderText(/IPv4 or hostname/)).toBeInTheDocument();
  });

  it('Save with a valid Spoof IP calls onSave with the built payload', () => {
    const onSave = vi.fn();
    render(<RuleEditSheet rule={bypassRule} proxies={[]} onSave={onSave} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Spoof' }));
    fireEvent.change(screen.getByPlaceholderText(/IPv4 or hostname/), { target: { value: '100.64.1.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith({ do: RULE_ACTION.SPOOF, status: 1, via: '100.64.1.5' });
  });

  it('blocks Save on an invalid Spoof target and shows an error', () => {
    const onSave = vi.fn();
    render(<RuleEditSheet rule={bypassRule} proxies={[]} onSave={onSave} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Spoof' }));
    fireEvent.change(screen.getByPlaceholderText(/IPv4 or hostname/), { target: { value: 'bad;$char' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/IPv4 address or hostname/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the test + build**

Run: `npm test -- src/components/RuleEditSheet.test.jsx && npm run build`
Expected: 3 tests pass; build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/RuleEditSheet.jsx src/components/RuleEditSheet.test.jsx
git commit -m "feat(rules): RuleEditSheet (edit action+target, validated) + component tests"
```

---

### Task 6: Wire Spoof + editing into `CustomRules.jsx`

**Files:**
- Modify: `src/components/CustomRules.jsx`

**Interfaces:**
- Consumes: `ACTION_META` from `./RuleActionTarget`; `buildRulePayload` from `../lib/rules`; `RuleActionTarget`, `RuleEditSheet`; `Pencil` from `lucide-react`.

- [ ] **Step 1: Read the current file to anchor the edits**

Run: `sed -n '1,60p;225,340p' src/components/CustomRules.jsx`
Note: it has a local `ACTION_META` (Block/Bypass/Redirect only) near the top; the add-bar `<form>` renders an action-selector `<div>` + a Redirect `<select>` (around lines ~274–322); rule rows render an on/off toggle + a delete button. Match the exact surrounding markup when editing.

- [ ] **Step 2: Swap imports + remove the local ACTION_META**

Replace the local `const ACTION_META = { … }` block with an import, and add the new imports (keep existing ones):
```jsx
import { Plus, Trash2, RefreshCw, Search, ChevronDown, ChevronRight, AlertCircle, Loader2, ToggleLeft, ToggleRight, Pencil } from 'lucide-react';
import { api, toArray, RULE_ACTION, extractDomain } from '../api/controld';
import { normaliseRule, buildRulePayload } from '../lib/rules';
import RuleActionTarget, { ACTION_META } from './RuleActionTarget';
import RuleEditSheet from './RuleEditSheet';
```
(Adjust the lucide import line to whatever icons the file already imports, plus `Pencil`.)

- [ ] **Step 3: Add Spoof target state + replace the add-bar selector with `RuleActionTarget`**

Near the other add-bar state (`const [action, setAction] = useState(RULE_ACTION.BYPASS)` and `const [via, setVia] = ...`), add:
```jsx
const [viaV6, setViaV6] = useState('');
```
Replace the add-bar's action-selector `<div>` **and** the Redirect `<select>` block (the ~`{action === RULE_ACTION.REDIRECT && (…select…)}`) with a single:
```jsx
<RuleActionTarget
  action={action}
  onActionChange={setAction}
  via={via} onViaChange={setVia}
  viaV6={viaV6} onViaV6Change={setViaV6}
  proxies={proxies}
/>
```
Update the Add button's `disabled` guard to require a target for Spoof too:
```jsx
disabled={!domain.trim() || adding
  || (action === RULE_ACTION.REDIRECT && !via)
  || (action === RULE_ACTION.SPOOF && !via.trim())}
```

- [ ] **Step 4: Include the target when adding a Spoof/Redirect rule**

In `addRule`, build the payload with the shared helper. Replace the `createRule` body construction so it uses `buildRulePayload`:
```jsx
const payload = buildRulePayload(doAction, { via, viaV6 });
await api.createRule(token, profileId, { 'hostnames[]': cleaned, ...payload });
```
And update the optimistic-prepend object to carry via/via_v6:
```jsx
setRules((prev) => [
  { hostname: cleaned, do: doAction, status: 1, group: null,
    via: payload.via ?? null, via_v6: payload.via_v6 ?? null },
  ...prev.filter((r) => r.hostname !== cleaned),
]);
```
(`addRule`'s signature already takes `(hostname, doAction, viaProxy)` — the shared `via`/`viaV6` state is in scope; keep the clipboard-banner call working, which passes only hostname+action → via/viaV6 empty → Bypass/Block need no target.)

- [ ] **Step 5: Add the pencil edit affordance + edit sheet**

Add edit state near the other UI state:
```jsx
const [editingRule, setEditingRule] = useState(null);
```
In each rule row's action area (next to the existing toggle + delete buttons), add:
```jsx
<button
  onClick={() => setEditingRule(rule)}
  aria-label={`Edit rule for ${rule.hostname}`}
  className="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5"
>
  <Pencil size={15} />
</button>
```
Add the save handler:
```jsx
async function handleEditSave(rule, payload) {
  setEditingRule(null);
  const prev = rules;
  setRules((rs) => rs.map((r) => (r.hostname === rule.hostname
    ? { ...r, do: payload.do, via: payload.via ?? null, via_v6: payload.via_v6 ?? null } : r)));
  try {
    await api.updateRule(token, profileId, { hostname: rule.hostname, ...payload });
    toast(`Updated ${rule.hostname}`, 'success');
    if (navigator.vibrate) navigator.vibrate(20);
  } catch (err) {
    setRules(prev); // rollback
    toast(err.message, 'error');
  }
}
```
And render the sheet before the component's closing tag:
```jsx
{editingRule && (
  <RuleEditSheet
    rule={editingRule}
    proxies={proxies}
    onSave={(payload) => handleEditSave(editingRule, payload)}
    onClose={() => setEditingRule(null)}
  />
)}
```

- [ ] **Step 6: Verify build + full suite**

Run: `npm run build && npm test`
Expected: build succeeds; all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/CustomRules.jsx
git commit -m "feat(rules): Spoof in add bar + pencil-edit sheet wiring"
```

---

### Task 7: Verify end-to-end

**Files:** none.

- [ ] **Step 1: Build + full suite**

Run: `npm run build && npm test`
Expected: build clean; all tests pass.

- [ ] **Step 2: Live verification note**

Done by the controller (not this task): on an empty profile — add a Spoof rule (e.g. `spooftest.example` → `100.64.1.5`), confirm server-side (`GET /profiles/{id}/rules` shows `action.do:2`, `action.via:"100.64.1.5"`); edit an existing rule's action (e.g. Bypass→Block) and confirm it persisted (and that toggling no longer rewrites the action); then delete the test rule / restore. Do NOT commit anything for this step.

---

## Self-Review

**Spec coverage:** normaliseRule nested-action fix (Task 1) ✓; Spoof action + validated via/via_v6 (Tasks 2,4,5,6) ✓; edit via pencil→sheet (Tasks 5,6) ✓; shared RuleActionTarget (Task 4) ✓; three TDD'd pure fns (Tasks 1–3) ✓; component tests (Task 5) ✓; input hardening/validation (Task 2, sheet Save) ✓; no hostname editing / scope (edit sheet only changes action+target) ✓; live Playwright (Task 7) ✓.

**Placeholders:** none — all steps carry real code/commands. Task 6 instructs reading the file first because CustomRules' exact add-bar/rule-row markup must be matched, not invented; the edits themselves are fully specified.

**Type consistency:** `normaliseRule` output (`do`, `via`, `via_v6`, `hostname`) is consumed by `RuleEditSheet` (seeds `action`/`via`/`viaV6` from `rule.do`/`rule.via`/`rule.via_v6`) and by CustomRules rows. `buildRulePayload(doCode, {via, viaV6})` output (`{do, status, via?, via_v6?}`) is what `onSave`/`handleEditSave` spread into `api.updateRule`, and what `RuleEditSheet.test.jsx` asserts. `ACTION_META` is defined once in `RuleActionTarget` and imported by CustomRules. Consistent.
