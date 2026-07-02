# Services Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Services screen to controld-mobile that browses Control D's ~1,010-app catalog with search and sets each app to Block / Bypass / Redirect (with geo-unblock location) per profile.

**Architecture:** Four pure functions in `src/lib/services.js` (TDD'd first) hold all logic; a thin `Services.jsx` wires them to the existing API client and the Filters.jsx UI patterns (optimistic + rollback + toast + haptic). Catalog loads lazily per category on browse, fetch-all-and-cache on first search.

**Tech Stack:** React 18, Vite 6, Vitest 3, Tailwind 4, lucide-react. ESM (`"type": "module"`).

## Global Constraints

- No new dependencies beyond what is installed.
- Only add/modify files under `src/`; match existing patterns in `src/components/Filters.jsx` (skeleton loader, error+retry, toasts, `navigator.vibrate`, `toArray` response normalization).
- Action codes (`do`): 0 = Block, 1 = Bypass, 3 = Redirect. `status`: 1 = active, 0 = off.
- Redirect `via` = proxy `PK` (e.g. `"SYD"`); a service's `unlock_location` equals the proxy `PK` directly (verified live).
- Pure functions are TDD'd (failing test first). React components have no unit tests this feature (no jsdom) — verify with `npm run build`.
- Every commit message ends with the two trailers:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` and
  `Claude-Session: https://claude.ai/code/session_01RqL4sGJWQAjcU7Q3mt7n9z`.
- Do not `git push` (local commits only unless told otherwise).

---

### Task 1: `mergeServiceState` pure function

**Files:**
- Create: `src/lib/services.js`
- Test: `src/lib/services.test.js`

**Interfaces:**
- Consumes: catalog service `{PK, name, category, unlock_location, warning}`; configured service `{PK, do, status, via}`.
- Produces: `mergeServiceState(catalog: Service[], configured: Configured[]) => Array<Service & {action: 'block'|'bypass'|'redirect'|null, via: string|null, status: 0|1}>`.

- [ ] **Step 1: Write the failing test**

```js
// src/lib/services.test.js
import { describe, it, expect } from 'vitest';
import { mergeServiceState } from './services.js';

const catalog = [
  { PK: 'netflix', name: 'Netflix', category: 'video', unlock_location: 'JFK', warning: '' },
  { PK: 'youtube', name: 'YouTube', category: 'video', unlock_location: 'JFK', warning: '' },
  { PK: 'disneyplus', name: 'Disney+', category: 'video', unlock_location: 'JFK', warning: '' },
];

describe('mergeServiceState', () => {
  it('annotates each catalog app with its configured action, via, and status', () => {
    const configured = [
      { PK: 'netflix', do: 1, status: 1, via: null },
      { PK: 'disneyplus', do: 3, status: 1, via: 'SYD' },
    ];
    const merged = mergeServiceState(catalog, configured);
    expect(merged.find((s) => s.PK === 'netflix')).toMatchObject({ action: 'bypass', status: 1 });
    expect(merged.find((s) => s.PK === 'disneyplus')).toMatchObject({ action: 'redirect', via: 'SYD', status: 1 });
  });

  it('leaves unconfigured apps with action null and status 0', () => {
    const merged = mergeServiceState(catalog, []);
    expect(merged.every((s) => s.action === null && s.status === 0)).toBe(true);
    expect(merged).toHaveLength(3);
  });

  it('treats a configured-but-disabled app (status 0) as action null', () => {
    const merged = mergeServiceState(catalog, [{ PK: 'youtube', do: 0, status: 0, via: null }]);
    expect(merged.find((s) => s.PK === 'youtube')).toMatchObject({ action: null, status: 0 });
  });

  it('maps do code 0 to block', () => {
    const merged = mergeServiceState(catalog, [{ PK: 'netflix', do: 0, status: 1, via: null }]);
    expect(merged.find((s) => s.PK === 'netflix').action).toBe('block');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/services.test.js`
Expected: FAIL — `mergeServiceState is not a function` / cannot resolve `./services.js`.

- [ ] **Step 3: Write minimal implementation**

```js
// src/lib/services.js

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/services.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/services.js src/lib/services.test.js
git commit -m "feat(services): mergeServiceState pure function + tests"
```

---

### Task 2: `filterServices` pure function

**Files:**
- Modify: `src/lib/services.js`
- Test: `src/lib/services.test.js`

**Interfaces:**
- Produces: `filterServices(catalog: Service[], query: string) => Service[]` — case-insensitive substring match on `name` or `PK`; empty/whitespace query returns the input unchanged.

- [ ] **Step 1: Write the failing test** (append to `src/lib/services.test.js`)

```js
import { filterServices } from './services.js';

describe('filterServices', () => {
  const catalog = [
    { PK: 'netflix', name: 'Netflix' },
    { PK: 'youtube', name: 'YouTube' },
    { PK: 'tiktok', name: 'TikTok' },
  ];

  it('matches on name, case-insensitively', () => {
    expect(filterServices(catalog, 'net').map((s) => s.PK)).toEqual(['netflix']);
    expect(filterServices(catalog, 'YOU').map((s) => s.PK)).toEqual(['youtube']);
  });

  it('matches on PK too', () => {
    expect(filterServices(catalog, 'tiktok').map((s) => s.PK)).toEqual(['tiktok']);
  });

  it('returns the full list unchanged for empty or whitespace query', () => {
    expect(filterServices(catalog, '')).toHaveLength(3);
    expect(filterServices(catalog, '   ')).toHaveLength(3);
  });

  it('returns [] when nothing matches', () => {
    expect(filterServices(catalog, 'zzzz')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/services.test.js`
Expected: FAIL — `filterServices is not a function`.

- [ ] **Step 3: Write minimal implementation** (append to `src/lib/services.js`)

```js
/** Case-insensitive substring search over name and PK. Blank query = passthrough. */
export function filterServices(catalog, query) {
  const q = (query ?? '').trim().toLowerCase();
  if (!q) return catalog ?? [];
  return (catalog ?? []).filter(
    (s) => s.name.toLowerCase().includes(q) || s.PK.toLowerCase().includes(q)
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/services.test.js`
Expected: PASS (all Task 1 + Task 2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/services.js src/lib/services.test.js
git commit -m "feat(services): filterServices search helper + tests"
```

---

### Task 3: `buildServicePayload` pure function

**Files:**
- Modify: `src/lib/services.js`
- Test: `src/lib/services.test.js`

**Interfaces:**
- Produces: `buildServicePayload(action: 'block'|'bypass'|'redirect'|'off', viaLocation?: string) => object` — the PUT body for `api.updateService`. Throws on unknown action.

- [ ] **Step 1: Write the failing test** (append)

```js
import { buildServicePayload } from './services.js';

describe('buildServicePayload', () => {
  it('block -> {do:0,status:1}', () => {
    expect(buildServicePayload('block')).toEqual({ do: 0, status: 1 });
  });
  it('bypass -> {do:1,status:1}', () => {
    expect(buildServicePayload('bypass')).toEqual({ do: 1, status: 1 });
  });
  it('redirect -> {do:3,status:1,via}', () => {
    expect(buildServicePayload('redirect', 'SYD')).toEqual({ do: 3, status: 1, via: 'SYD' });
  });
  it('off -> {status:0}', () => {
    expect(buildServicePayload('off')).toEqual({ status: 0 });
  });
  it('throws on an unknown action', () => {
    expect(() => buildServicePayload('spoof')).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/services.test.js`
Expected: FAIL — `buildServicePayload is not a function`.

- [ ] **Step 3: Write minimal implementation** (append)

```js
/** Build the PUT body for updateService from a UI action choice. */
export function buildServicePayload(action, viaLocation) {
  switch (action) {
    case 'block': return { do: 0, status: 1 };
    case 'bypass': return { do: 1, status: 1 };
    case 'redirect': return { do: 3, status: 1, via: viaLocation };
    case 'off': return { status: 0 };
    default: throw new Error(`Unknown service action: ${action}`);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/services.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services.js src/lib/services.test.js
git commit -m "feat(services): buildServicePayload action->body mapper + tests"
```

---

### Task 4: `resolveDefaultLocation` pure function

**Files:**
- Modify: `src/lib/services.js`
- Test: `src/lib/services.test.js`

**Interfaces:**
- Produces: `resolveDefaultLocation(service: {unlock_location?: string}, proxies: Proxy[]) => Proxy | null` — the proxy whose `PK` equals the service's `unlock_location`, or null. (`unlock_location` === proxy `PK`, verified live.)

- [ ] **Step 1: Write the failing test** (append)

```js
import { resolveDefaultLocation } from './services.js';

describe('resolveDefaultLocation', () => {
  const proxies = [
    { PK: 'JFK', city: 'New York', country_name: 'United States' },
    { PK: 'SYD', city: 'Sydney', country_name: 'Australia' },
  ];

  it('returns the proxy whose PK matches the service unlock_location', () => {
    expect(resolveDefaultLocation({ unlock_location: 'SYD' }, proxies))
      .toMatchObject({ PK: 'SYD', city: 'Sydney' });
  });
  it('returns null when unlock_location is empty', () => {
    expect(resolveDefaultLocation({ unlock_location: '' }, proxies)).toBeNull();
  });
  it('returns null when no proxy matches', () => {
    expect(resolveDefaultLocation({ unlock_location: 'ZZZ' }, proxies)).toBeNull();
  });
  it('returns null for a service with no unlock_location', () => {
    expect(resolveDefaultLocation({}, proxies)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/services.test.js`
Expected: FAIL — `resolveDefaultLocation is not a function`.

- [ ] **Step 3: Write minimal implementation** (append)

```js
/** A service's unlock_location IS a proxy PK; find that proxy for the default redirect target. */
export function resolveDefaultLocation(service, proxies) {
  const code = service?.unlock_location;
  if (!code) return null;
  return (proxies ?? []).find((p) => p.PK === code) ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/services.test.js`
Expected: PASS (all four pure functions covered).

- [ ] **Step 5: Commit**

```bash
git add src/lib/services.js src/lib/services.test.js
git commit -m "feat(services): resolveDefaultLocation proxy lookup + tests"
```

---

### Task 5: Add catalog endpoints to the API client

**Files:**
- Modify: `src/api/controld.js` (the `api` object, near the existing `getServices`/`updateService` at lines ~117-127)

**Interfaces:**
- Produces: `api.getServiceCategories(token)` → `GET /services/categories`; `api.getServiceCategory(token, category)` → `GET /services/categories/{category}`.

- [ ] **Step 1: Add the two methods** (inside the `api` object, next to `getServices`)

```js
  // Services catalog (global, not per-profile)
  getServiceCategories: (token) => request(token, 'GET', '/services/categories'),

  getServiceCategory: (token, category) =>
    request(token, 'GET', `/services/categories/${category}`),
```

- [ ] **Step 2: Verify the build still compiles**

Run: `npm run build`
Expected: build succeeds (no import/syntax errors).

- [ ] **Step 3: Commit**

```bash
git add src/api/controld.js
git commit -m "feat(services): add catalog endpoints to API client"
```

---

### Task 6: `ServiceActionSheet` component (sheet + location picker)

**Files:**
- Create: `src/components/ServiceActionSheet.jsx`

**Interfaces:**
- Consumes: `buildServicePayload`, `resolveDefaultLocation` from `../lib/services.js`; proxies list.
- Produces: `<ServiceActionSheet service proxies onChoose onClose />` where `onChoose(action, via)` is called with `action ∈ {block,bypass,redirect,off}` and `via` (proxy PK) when action is redirect.

- [ ] **Step 1: Write the component**

```jsx
// src/components/ServiceActionSheet.jsx
import { useState } from 'react';
import { X } from 'lucide-react';
import { resolveDefaultLocation } from '../lib/services';

const ACTIONS = [
  { key: 'block', label: 'Block', cls: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400' },
  { key: 'bypass', label: 'Bypass', cls: 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400' },
  { key: 'redirect', label: 'Redirect', cls: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' },
];

export default function ServiceActionSheet({ service, proxies, onChoose, onClose }) {
  const def = resolveDefaultLocation(service, proxies);
  const [via, setVia] = useState(service.via || def?.PK || (proxies[0]?.PK ?? ''));
  const [picking, setPicking] = useState(false);
  const [q, setQ] = useState('');

  const chosen = proxies.find((p) => p.PK === via);
  const list = q
    ? proxies.filter(
        (p) =>
          p.city.toLowerCase().includes(q.toLowerCase()) ||
          p.country_name.toLowerCase().includes(q.toLowerCase()) ||
          p.PK.toLowerCase().includes(q.toLowerCase())
      )
    : proxies;

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/45" />
      <div
        className="relative w-full bg-white dark:bg-slate-800 rounded-t-2xl p-4 pb-6 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">{service.name}</h4>
            <p className="text-xs text-slate-400 capitalize">{service.category} · choose an action</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 p-1">
            <X size={18} />
          </button>
        </div>

        {picking ? (
          <div>
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search locations…"
              className="w-full mb-2 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent text-sm"
            />
            {list.map((p) => (
              <button
                key={p.PK}
                onClick={() => { setVia(p.PK); setPicking(false); setQ(''); }}
                className="w-full text-left px-3 py-2.5 text-sm border-b border-slate-100 dark:border-slate-700/40"
              >
                {p.city}, {p.country_name} <span className="text-slate-400">({p.PK})</span>
              </button>
            ))}
          </div>
        ) : (
          <>
            {ACTIONS.map((a) => (
              <div key={a.key}>
                <button
                  onClick={() => (a.key === 'redirect' ? onChoose('redirect', via) : onChoose(a.key))}
                  className={`w-full flex items-center gap-2 px-4 py-3 rounded-xl font-semibold mb-2 ${a.cls}`}
                >
                  <span className="w-2 h-2 rounded-full bg-current" />
                  {a.label}
                </button>
                {a.key === 'redirect' && (
                  <button
                    onClick={() => setPicking(true)}
                    className="ml-8 mb-2 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-3 py-2 rounded-lg"
                  >
                    📍 {chosen ? `${chosen.city} (${chosen.PK})` : 'Pick location'} · change ›
                  </button>
                )}
              </div>
            ))}
            {service.action && (
              <button onClick={() => onChoose('off')} className="w-full text-center text-sm text-slate-400 pt-2">
                Remove / turn off
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the build compiles**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/ServiceActionSheet.jsx
git commit -m "feat(services): action sheet with Block/Bypass/Redirect + location picker"
```

---

### Task 7: `Services.jsx` main screen

**Files:**
- Create: `src/components/Services.jsx`

**Interfaces:**
- Consumes: `api.getServices`, `api.getServiceCategories`, `api.getServiceCategory`, `api.getProxies`, `api.updateService`, `toArray` from `../api/controld`; `mergeServiceState`, `filterServices`, `buildServicePayload` from `../lib/services`; `ServiceActionSheet`.
- Produces: `<Services profile />` (same prop contract as `Filters`).

- [ ] **Step 1: Write the component**

```jsx
// src/components/Services.jsx
import { useEffect, useState, useCallback, useMemo } from 'react';
import { RefreshCw, AlertCircle, ChevronDown, ChevronRight, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api, toArray } from '../api/controld';
import { mergeServiceState, filterServices, buildServicePayload } from '../lib/services';
import ServiceActionSheet from './ServiceActionSheet';

const PILL = {
  block: 'bg-red-100 text-red-700',
  bypass: 'bg-green-100 text-green-700',
  redirect: 'bg-blue-100 text-blue-700',
};

export default function Services({ profile }) {
  const { token } = useAuth();
  const toast = useToast();
  const profileId = profile?.PK ?? profile?.pk ?? profile?.id;

  const [categories, setCategories] = useState([]);        // {PK,name,count}
  const [configured, setConfigured] = useState([]);        // per-profile set services
  const [proxies, setProxies] = useState([]);
  const [catCache, setCatCache] = useState({});            // { [catPK]: Service[] }
  const [openCats, setOpenCats] = useState({});
  const [query, setQuery] = useState('');
  const [allLoaded, setAllLoaded] = useState(false);       // full catalog cached (for search)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sheet, setSheet] = useState(null);                // service being edited

  const load = useCallback(async () => {
    if (!profileId) return;
    setLoading(true);
    setError(null);
    try {
      const [catsBody, cfgBody, proxBody] = await Promise.all([
        api.getServiceCategories(token),
        api.getServices(token, profileId),
        api.getProxies(token).catch(() => []),
      ]);
      setCategories(toArray(catsBody, 'categories'));
      setConfigured(toArray(cfgBody, 'services'));
      setProxies(toArray(proxBody, 'proxies'));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, profileId]);

  useEffect(() => { load(); }, [load]);

  const loadCategory = useCallback(async (catPK) => {
    if (catCache[catPK]) return;
    try {
      const body = await api.getServiceCategory(token, catPK);
      setCatCache((c) => ({ ...c, [catPK]: toArray(body, 'services') }));
    } catch (err) {
      toast(err.message, 'error');
    }
  }, [token, catCache, toast]);

  async function toggleCat(catPK) {
    const willOpen = !openCats[catPK];
    setOpenCats((o) => ({ ...o, [catPK]: willOpen }));
    if (willOpen) await loadCategory(catPK);
  }

  // On first search, fetch every category once and cache it.
  useEffect(() => {
    if (!query || allLoaded || !categories.length) return;
    (async () => {
      const entries = await Promise.all(
        categories.map(async (c) => {
          if (catCache[c.PK]) return [c.PK, catCache[c.PK]];
          const body = await api.getServiceCategory(token, c.PK).catch(() => ({}));
          return [c.PK, toArray(body, 'services')];
        })
      );
      setCatCache((prev) => ({ ...Object.fromEntries(entries), ...prev }));
      setAllLoaded(true);
    })();
  }, [query, allLoaded, categories, catCache, token]);

  const withState = useCallback(
    (list) => mergeServiceState(list, configured),
    [configured]
  );

  const searchResults = useMemo(() => {
    if (!query) return null;
    const all = Object.values(catCache).flat();
    return withState(filterServices(all, query));
  }, [query, catCache, withState]);

  async function choose(service, action, via) {
    setSheet(null);
    const prev = configured;
    // optimistic: reflect the change locally
    const payload = buildServicePayload(action, via);
    const next = configured.filter((c) => c.PK !== service.PK);
    if (action !== 'off') next.push({ PK: service.PK, do: payload.do, status: 1, via: via ?? null });
    setConfigured(next);
    try {
      await api.updateService(token, profileId, service.PK, payload);
      toast(`${service.name} → ${action}`, 'success');
      if (navigator.vibrate) navigator.vibrate(20);
    } catch (err) {
      setConfigured(prev); // rollback
      toast(err.message, 'error');
    }
  }

  if (!profileId) {
    return <div className="flex items-center justify-center p-8"><p className="text-slate-400 text-sm">Select a profile first.</p></div>;
  }

  function Row({ s }) {
    return (
      <button
        onClick={() => setSheet(s)}
        className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 dark:border-slate-700/40 text-left"
      >
        <span className="flex-1 text-sm text-slate-800 dark:text-slate-200">{s.name}</span>
        <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${s.action ? PILL[s.action] : 'bg-slate-200 text-slate-400'}`}>
          {s.action ? s.action[0].toUpperCase() + s.action.slice(1) : 'Set'} ›
        </span>
      </button>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 p-3 flex gap-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800">
          <Search size={15} className="text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search apps…"
            className="flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        <button onClick={load} aria-label="Refresh" className="text-slate-400 px-2"><RefreshCw size={15} /></button>
      </div>

      <div className="flex-1 overflow-y-auto scroll-area">
        {loading ? (
          <div className="p-4 flex flex-col gap-3">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-14 rounded-xl bg-slate-200 dark:bg-slate-800" />)}</div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
            <AlertCircle className="w-8 h-8 text-red-400" />
            <p className="text-sm text-slate-500">{error}</p>
            <button onClick={load} className="flex items-center gap-2 text-green-500 font-medium text-sm"><RefreshCw size={14} /> Retry</button>
          </div>
        ) : query ? (
          <div>
            {searchResults && searchResults.length ? searchResults.map((s) => <Row key={s.PK} s={s} />)
              : <div className="text-center py-12 text-slate-400 text-sm">No apps match "{query}".</div>}
          </div>
        ) : (
          <div className="p-2">
            {categories.map((c) => (
              <div key={c.PK} className="mb-2">
                <button onClick={() => toggleCat(c.PK)} className="w-full flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800/50 rounded-lg">
                  {openCats[c.PK] ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 flex-1 text-left">{c.name}</span>
                  <span className="text-xs text-slate-400">{c.count}</span>
                </button>
                {openCats[c.PK] && (
                  <div className="bg-white dark:bg-slate-800/40 rounded-b-xl overflow-hidden">
                    {(withState(catCache[c.PK] || [])).map((s) => <Row key={s.PK} s={s} />)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {sheet && (
        <ServiceActionSheet
          service={sheet}
          proxies={proxies}
          onChoose={(action, via) => choose(sheet, action, via)}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify the build compiles**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/Services.jsx
git commit -m "feat(services): Services screen (browse + search + optimistic writes)"
```

---

### Task 8: Wire the Services tab into navigation

**Files:**
- Modify: `src/components/BottomNav.jsx` (add a 5th tab)
- Modify: `src/App.jsx` (render `Services` when its tab is active)

**Interfaces:**
- Consumes: `Services` from `./components/Services`.

- [ ] **Step 1: Read both files to match their existing tab/render pattern**

Run: `sed -n '1,60p' src/components/BottomNav.jsx; sed -n '1,160p' src/App.jsx`
(Do not guess the tab-key names or icon import style — copy the existing pattern for Profiles/Rules/Filters/Settings.)

- [ ] **Step 2: Add the Services tab to `BottomNav.jsx`**

Insert a Services entry (icon: `Blocks` or `Layers` from lucide-react) into the nav items array, positioned between Filters and Settings, using the same object shape the existing items use (key/label/icon).

- [ ] **Step 3: Render `Services` in `App.jsx`**

Import `Services` and add its branch to the screen switch, passing the active `profile` prop exactly as `Filters` receives it.

- [ ] **Step 4: Verify the build compiles**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Manual smoke check**

Run: `npm run dev`, open the app, enter the token, select a profile, tap the **Services** tab. Verify: categories list, expanding one loads apps, search finds an app, tapping an app opens the sheet, choosing Bypass shows a success toast. (Read-only verification is fine; a live write will actually change the profile.)

- [ ] **Step 6: Commit**

```bash
git add src/components/BottomNav.jsx src/App.jsx
git commit -m "feat(services): wire Services tab into navigation"
```

---

## Self-Review

**Spec coverage:** browse+search (Task 7) ✓; tap-open action sheet + location picker (Task 6) ✓; Block/Bypass/Redirect + geo-unblock (Tasks 3, 6) ✓; data flow lazy/cache (Task 7) ✓; optimistic+rollback+toast+haptic (Task 7) ✓; four pure functions TDD'd (Tasks 1-4) ✓; catalog endpoints (Task 5) ✓; 5th nav tab (Task 8) ✓; unlock_location→via mapping resolved and tested (Task 4) ✓.

**Placeholders:** none — all steps carry real code/commands. Task 8 steps 2-3 intentionally instruct reading the existing files first because BottomNav/App tab-key names must match the established pattern rather than be invented.

**Type consistency:** `mergeServiceState` output fields (`action`, `via`, `status`) are consumed unchanged by `Services.jsx` (`s.action`, `s.via`) and `ServiceActionSheet` (`service.action`, `service.via`). `buildServicePayload` return shape matches what `api.updateService` sends. `resolveDefaultLocation` returns a proxy object whose `.PK` is used as `via`. Consistent.
