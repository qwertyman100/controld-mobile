# Filter Levels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Off/Relaxed/Balanced/Strict level selector for the four multi-level native filters (Ads, Adult, NRD, Malware), while leaving the other 16 native filters and all external filters as plain on/off toggles.

**Architecture:** Two pure functions in `src/lib/filterLevels.js` (TDD'd) read a filter's current level and compute the API operations for a target level; a new `FilterLevelSheet.jsx` (mirroring `ServiceActionSheet.jsx`) drives selection; `Filters.jsx` renders a level pill for multi-level filters and applies changes via two new API-client methods.

**Tech Stack:** React 18, Vite 6, Vitest 3, Tailwind 4, lucide-react. ESM.

## Global Constraints

- No new dependencies. Only add/modify files under `src/`. Match existing patterns in `Filters.jsx` (optimistic + rollback + toast + `navigator.vibrate`) and `ServiceActionSheet.jsx` (bottom-sheet).
- Level **titles are data-driven** from the API `levels[].title` — NEVER hardcode "Relaxed/Balanced/Strict" (NRD's are "Last Week"/"Last Month"). Colour is by position, not title.
- Two semantics: **mutually-exclusive** (Ads/Adult/NRD — one key on, siblings off) and **cumulative** (Malware only, `PK==='malware'` — layered; Strict adds the `ai_malware` option).
- AI strengths (malware Strict `ai_malware` value): Minimal=0.9, Standard=0.7, Aggressive=0.5; default 0.9.
- All API path params via `encodeURIComponent`. Render API text as plain React children (no `dangerouslySetInnerHTML`); the `filter.additional` HTML is not rendered as HTML. Coerce with `String(x ?? '')` before string ops.
- Pure functions are TDD'd; React components verified by `npm run build` (no jsdom). Commit locally per task on branch `feat/filter-levels`; do NOT push. Commit messages end with:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` and
  `Claude-Session: https://claude.ai/code/session_01RqL4sGJWQAjcU7Q3mt7n9z`.

---

### Task 1: `getFilterLevels` pure function

**Files:**
- Create: `src/lib/filterLevels.js`
- Test: `src/lib/filterLevels.test.js`

**Interfaces:**
- Produces: `getFilterLevels(filter) => { isMultiLevel: boolean, isCumulative: boolean, options: string[], currentTitle: string, aiValue: number }`.

- [ ] **Step 1: Write the failing test**

```js
// src/lib/filterLevels.test.js
import { describe, it, expect } from 'vitest';
import { getFilterLevels } from './filterLevels.js';

const ads = {
  PK: 'ads', name: 'Ads & Trackers', action: { lvl: 'ads' },
  levels: [
    { title: 'Relaxed', name: 'ads_small', type: 'filter', status: 0 },
    { title: 'Balanced', name: 'ads_medium', type: 'filter', status: 0 },
    { title: 'Strict', name: 'ads', type: 'filter', status: 1 },
  ],
};
const nrd = {
  PK: 'nrd', name: 'New Domains', action: { lvl: 'nrd_small' },
  levels: [
    { title: 'Last Week', name: 'nrd_small', type: 'filter', status: 1 },
    { title: 'Last Month', name: 'nrd', type: 'filter', status: 0 },
  ],
};
const porn = {
  PK: 'porn', name: 'Adult Content', action: null,
  levels: [
    { title: 'Relaxed', name: 'porn', type: 'filter', status: 0 },
    { title: 'Strict', name: 'porn_strict', type: 'filter', status: 0 },
  ],
};
function malware(mw, ip, ai) {
  return {
    PK: 'malware', name: 'Malware', action: { do: 0, status: 1 },
    levels: [
      { title: 'Relaxed', name: 'malware', type: 'filter', status: mw },
      { title: 'Balanced', name: 'ip_malware', type: 'ipfilter', status: ip },
      { title: 'Strict', name: 'ai_malware', type: 'option', status: ai, opt: [{ PK: 'ai_malware', value: 0.9 }] },
    ],
  };
}
const simple = { PK: 'gambling', name: 'Gambling', status: 0 };

describe('getFilterLevels', () => {
  it('marks a filter with a non-empty levels array as multi-level', () => {
    expect(getFilterLevels(ads).isMultiLevel).toBe(true);
    expect(getFilterLevels(simple).isMultiLevel).toBe(false);
  });
  it('builds options as Off + the data-driven level titles (not hardcoded)', () => {
    expect(getFilterLevels(ads).options).toEqual(['Off', 'Relaxed', 'Balanced', 'Strict']);
    expect(getFilterLevels(nrd).options).toEqual(['Off', 'Last Week', 'Last Month']);
    expect(getFilterLevels(simple).options).toEqual(['Off']);
  });
  it('derives current title from action.lvl for mutually-exclusive filters', () => {
    expect(getFilterLevels(ads).currentTitle).toBe('Strict');
    expect(getFilterLevels(nrd).currentTitle).toBe('Last Week');
    expect(getFilterLevels(porn).currentTitle).toBe('Off');
  });
  it('flags malware as cumulative and derives current from layer statuses', () => {
    expect(getFilterLevels(malware(1, 1, 1)).isCumulative).toBe(true);
    expect(getFilterLevels(malware(1, 1, 1)).currentTitle).toBe('Strict');
    expect(getFilterLevels(malware(1, 1, 0)).currentTitle).toBe('Balanced');
    expect(getFilterLevels(malware(1, 0, 0)).currentTitle).toBe('Relaxed');
    expect(getFilterLevels(malware(0, 0, 0)).currentTitle).toBe('Off');
  });
  it('reads the malware AI value (default 0.9)', () => {
    expect(getFilterLevels(malware(1, 1, 1)).aiValue).toBe(0.9);
  });
  it('does not throw on missing/garbage input', () => {
    expect(() => getFilterLevels({})).not.toThrow();
    expect(getFilterLevels({}).isMultiLevel).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/filterLevels.test.js`
Expected: FAIL — `getFilterLevels is not a function` / cannot resolve module.

- [ ] **Step 3: Write minimal implementation**

```js
// src/lib/filterLevels.js

// AI Malware option strengths (malware Strict). Minimal is Control D's default.
export const AI_STRENGTHS = [
  { label: 'Minimal', value: 0.9 },
  { label: 'Standard', value: 0.7 },
  { label: 'Aggressive', value: 0.5 },
];
const AI_DEFAULT = 0.9;

function levelStatus(filter, name) {
  const l = (filter.levels || []).find((x) => x.name === name);
  return l ? Number(l.status) : 0;
}

/**
 * Read a native filter's level state. Titles come from the API (data-driven) —
 * they differ per filter (NRD uses "Last Week"/"Last Month"). Malware (PK
 * 'malware') is cumulative: its current level is the highest active layer.
 */
export function getFilterLevels(filter) {
  const levels = Array.isArray(filter?.levels) ? filter.levels : [];
  const isMultiLevel = levels.length > 0;
  const isCumulative = filter?.PK === 'malware';
  const options = ['Off', ...levels.map((l) => String(l.title))];

  let currentTitle = 'Off';
  if (isCumulative) {
    if (levelStatus(filter, 'ai_malware') === 1) currentTitle = 'Strict';
    else if (levelStatus(filter, 'ip_malware') === 1) currentTitle = 'Balanced';
    else if (levelStatus(filter, 'malware') === 1) currentTitle = 'Relaxed';
  } else if (isMultiLevel) {
    const active = levels.find((l) => l.name === filter?.action?.lvl);
    if (active) currentTitle = String(active.title);
  }

  const strict = levels.find((l) => l.name === 'ai_malware');
  const aiValue = strict?.opt?.[0]?.value ?? AI_DEFAULT;

  return { isMultiLevel, isCumulative, options, currentTitle, aiValue };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/filterLevels.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/filterLevels.js src/lib/filterLevels.test.js
git commit -m "feat(filters): getFilterLevels reads a filter's level state + tests"
```

---

### Task 2: `buildFilterLevelOps` pure function

**Files:**
- Modify: `src/lib/filterLevels.js`
- Test: `src/lib/filterLevels.test.js`

**Interfaces:**
- Produces: `buildFilterLevelOps(filter, targetTitle, aiValue) => { filters: {filter: string, status: 0|1}[], option: {name: string, status: 0|1, value?: number} | null }`.

- [ ] **Step 1: Write the failing test** (append to `src/lib/filterLevels.test.js`)

```js
import { buildFilterLevelOps } from './filterLevels.js';

describe('buildFilterLevelOps', () => {
  const ads = {
    PK: 'ads',
    levels: [
      { title: 'Relaxed', name: 'ads_small' },
      { title: 'Balanced', name: 'ads_medium' },
      { title: 'Strict', name: 'ads' },
    ],
  };
  const malware = { PK: 'malware', levels: [] }; // cumulative logic is by PK, not levels

  it('exclusive: enables the chosen level key, disables siblings, no option', () => {
    expect(buildFilterLevelOps(ads, 'Balanced')).toEqual({
      filters: [
        { filter: 'ads_small', status: 0 },
        { filter: 'ads_medium', status: 1 },
        { filter: 'ads', status: 0 },
      ],
      option: null,
    });
  });
  it('exclusive: Off disables every level key', () => {
    expect(buildFilterLevelOps(ads, 'Off').filters.every((f) => f.status === 0)).toBe(true);
  });
  it('cumulative malware Off: all layers off + ai option off', () => {
    expect(buildFilterLevelOps(malware, 'Off')).toEqual({
      filters: [{ filter: 'malware', status: 0 }, { filter: 'ip_malware', status: 0 }],
      option: { name: 'ai_malware', status: 0 },
    });
  });
  it('cumulative malware Relaxed / Balanced stack the layers, ai off', () => {
    expect(buildFilterLevelOps(malware, 'Relaxed').filters).toEqual([
      { filter: 'malware', status: 1 }, { filter: 'ip_malware', status: 0 },
    ]);
    expect(buildFilterLevelOps(malware, 'Balanced').filters).toEqual([
      { filter: 'malware', status: 1 }, { filter: 'ip_malware', status: 1 },
    ]);
    expect(buildFilterLevelOps(malware, 'Balanced').option).toEqual({ name: 'ai_malware', status: 0 });
  });
  it('cumulative malware Strict: all layers on + ai option on with the given strength', () => {
    expect(buildFilterLevelOps(malware, 'Strict', 0.7)).toEqual({
      filters: [{ filter: 'malware', status: 1 }, { filter: 'ip_malware', status: 1 }],
      option: { name: 'ai_malware', status: 1, value: 0.7 },
    });
  });
  it('cumulative malware Strict defaults AI strength to 0.9', () => {
    expect(buildFilterLevelOps(malware, 'Strict').option.value).toBe(0.9);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/filterLevels.test.js`
Expected: FAIL — `buildFilterLevelOps is not a function`.

- [ ] **Step 3: Write minimal implementation** (append to `src/lib/filterLevels.js`)

```js
/**
 * Compute the API operations to set `filter` to `targetTitle`.
 * Exclusive filters → one filter-batch (enable chosen, disable siblings).
 * Malware (cumulative) → stacked malware/ip_malware layers + the ai_malware option.
 */
export function buildFilterLevelOps(filter, targetTitle, aiValue) {
  if (filter?.PK === 'malware') {
    const wantMalware = ['Relaxed', 'Balanced', 'Strict'].includes(targetTitle);
    const wantIp = ['Balanced', 'Strict'].includes(targetTitle);
    const wantAi = targetTitle === 'Strict';
    return {
      filters: [
        { filter: 'malware', status: wantMalware ? 1 : 0 },
        { filter: 'ip_malware', status: wantIp ? 1 : 0 },
      ],
      option: wantAi
        ? { name: 'ai_malware', status: 1, value: aiValue ?? AI_DEFAULT }
        : { name: 'ai_malware', status: 0 },
    };
  }
  const levels = Array.isArray(filter?.levels) ? filter.levels : [];
  return {
    filters: levels.map((l) => ({ filter: l.name, status: l.title === targetTitle ? 1 : 0 })),
    option: null,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/filterLevels.test.js`
Expected: PASS (both functions).

- [ ] **Step 5: Commit**

```bash
git add src/lib/filterLevels.js src/lib/filterLevels.test.js
git commit -m "feat(filters): buildFilterLevelOps maps a level to API ops + tests"
```

---

### Task 3: API client methods `batchFilters` + `setOption`

**Files:**
- Modify: `src/api/controld.js` (in the `api` object, near `toggleFilter`)

**Interfaces:**
- Produces: `api.batchFilters(token, profileId, filters)` → `PUT /profiles/{id}/filters` body `{filters}`; `api.setOption(token, profileId, name, payload)` → `PUT /profiles/{id}/options/{name}` body `{status, value}`.

- [ ] **Step 1: Add the methods** (after `toggleFilter`)

```js
  // Batch enable/disable multiple filters (used for filter levels)
  batchFilters: (token, profileId, filters) =>
    request(token, 'PUT', `/profiles/${encodeURIComponent(profileId)}/filters`, { filters }),

  // Set a profile option (e.g. ai_malware for Malware Strict)
  setOption: (token, profileId, name, payload) =>
    request(
      token,
      'PUT',
      `/profiles/${encodeURIComponent(profileId)}/options/${encodeURIComponent(name)}`,
      payload
    ),
```

Note: `request` form-encodes object bodies via `URLSearchParams`, which stringifies each value. `{filters: [...]}` — confirm during Step 2 that the array serializes as Control D expects; if the API rejects it, the batch body must be JSON. (Control D's documented body is `{filters:[{filter,status}]}`; the existing `request` sends `application/x-www-form-urlencoded`. If Step 2's build is fine but a live call later 400s, switch `batchFilters`/`setOption` to send JSON — flag as DONE_WITH_CONCERNS.)

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/api/controld.js
git commit -m "feat(filters): add batchFilters + setOption API methods"
```

---

### Task 4: `FilterLevelSheet` component

**Files:**
- Create: `src/components/FilterLevelSheet.jsx`

**Interfaces:**
- Consumes: `getFilterLevels`, `AI_STRENGTHS` from `../lib/filterLevels`.
- Produces: `<FilterLevelSheet filter onChoose onClose />` where `filter` is the raw API filter object; `onChoose(targetTitle, aiValue)` — `aiValue` supplied only for malware Strict.

- [ ] **Step 1: Write the component**

```jsx
// src/components/FilterLevelSheet.jsx
import { X } from 'lucide-react';
import { getFilterLevels, AI_STRENGTHS } from '../lib/filterLevels';

// Colour by mode position (Off grey, then green→amber→red by intensity).
function dotClass(title) {
  if (title === 'Off') return 'bg-slate-400';
  if (title === 'Strict') return 'bg-red-500';
  if (title === 'Balanced') return 'bg-amber-500';
  return 'bg-green-500'; // Relaxed and any other first-tier title (e.g. "Last Week")
}

export default function FilterLevelSheet({ filter, onChoose, onClose }) {
  const { options, currentTitle, isCumulative, aiValue } = getFilterLevels(filter);

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/45" />
      <div
        className="relative w-full bg-white dark:bg-slate-800 rounded-t-2xl p-4 pb-6 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">{String(filter.name ?? '')}</h4>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 p-1"><X size={18} /></button>
        </div>
        {filter.description ? (
          <p className="text-xs text-slate-400 mb-3">{String(filter.description)}</p>
        ) : null}

        {options.map((title) => {
          const selected = title === currentTitle;
          return (
            <div key={title}>
              <button
                onClick={() => onChoose(title, isCumulative && title === 'Strict' ? (aiValue ?? 0.9) : undefined)}
                className={`w-full flex items-center gap-2 px-4 py-3 rounded-xl font-semibold mb-2 text-slate-800 dark:text-slate-200 ${
                  selected ? 'ring-2 ring-green-500 bg-slate-100 dark:bg-slate-700/50' : 'bg-slate-50 dark:bg-slate-700/30'
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${dotClass(title)}`} />
                {title}
                {selected ? <span className="ml-auto text-xs text-green-500">current</span> : null}
              </button>

              {isCumulative && title === 'Strict' && (
                <div className="ml-6 mb-2 bg-red-50 dark:bg-red-500/10 rounded-lg p-2.5">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-red-700 dark:text-red-400 mb-1.5">AI strength</div>
                  <div className="flex gap-1.5">
                    {AI_STRENGTHS.map((s) => (
                      <button
                        key={s.value}
                        onClick={() => onChoose('Strict', s.value)}
                        className={`flex-1 text-xs font-semibold py-1.5 rounded ${
                          aiValue === s.value && currentTitle === 'Strict'
                            ? 'bg-red-600 text-white'
                            : 'bg-white dark:bg-slate-700 text-slate-500'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/FilterLevelSheet.jsx
git commit -m "feat(filters): FilterLevelSheet (mode radio list + Malware AI sub-picker)"
```

---

### Task 5: Wire level selection into `Filters.jsx`

**Files:**
- Modify: `src/components/Filters.jsx`

**Interfaces:**
- Consumes: `getFilterLevels`, `buildFilterLevelOps` from `../lib/filterLevels`; `FilterLevelSheet`; `api.batchFilters`, `api.setOption`.

- [ ] **Step 1: Read the current file to anchor the edits**

Run: `sed -n '1,120p' src/components/Filters.jsx`
Note the exact shape: `normaliseFilter` returns `{id, name, description, status, category, _raw}` (the raw API object is on `_raw` — levels/action live there). `FilterRow` currently renders a toggle; `Filters` (default export) holds `native`/`external` state and `handleToggle`.

- [ ] **Step 2: Add imports** (top of `src/components/Filters.jsx`, after the existing `api` import)

```jsx
import { getFilterLevels, buildFilterLevelOps } from '../lib/filterLevels';
import FilterLevelSheet from './FilterLevelSheet';
```

- [ ] **Step 3: Make `FilterRow` render a level pill for multi-level filters**

Replace the `FilterRow` function with this version (adds an `onOpenLevels` prop + a `levelTitle` override for optimistic display; falls back to the existing toggle for simple filters):

```jsx
function levelDot(title) {
  if (title === 'Off') return 'bg-slate-300 text-slate-500';
  if (title === 'Strict') return 'bg-red-100 text-red-700';
  if (title === 'Balanced') return 'bg-amber-100 text-amber-700';
  return 'bg-green-100 text-green-700';
}

function FilterRow({ filter, onToggle, toggling, onOpenLevels, levelOverride }) {
  const lv = getFilterLevels(filter._raw || {});
  const enabled = filter.status === 1;

  return (
    <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 dark:border-slate-700/40 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-tight">{filter.name}</p>
        {filter.description ? (
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 leading-snug line-clamp-2">{filter.description}</p>
        ) : null}
      </div>

      {lv.isMultiLevel ? (
        <button
          onClick={() => onOpenLevels(filter)}
          className={`shrink-0 text-[10px] font-bold px-2.5 py-1.5 rounded-full ${levelDot(levelOverride ?? lv.currentTitle)}`}
        >
          {levelOverride ?? lv.currentTitle} ›
        </button>
      ) : (
        <button
          onClick={() => onToggle(filter)}
          disabled={toggling}
          aria-label={enabled ? 'Disable filter' : 'Enable filter'}
          className={`shrink-0 relative w-12 h-6 rounded-full transition-colors duration-200 ${
            enabled ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'
          } ${toggling ? 'opacity-50' : ''}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${enabled ? 'translate-x-[24px]' : 'translate-x-0'}`} />
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Thread the new props through `FilterCategory`**

In `FilterCategory`, accept `onOpenLevels` and `levelOverrides` and pass them to each `FilterRow`:

```jsx
// in FilterCategory's props: ({ name, filters, onToggle, togglingId, onOpenLevels, levelOverrides })
// and where it renders rows:
<FilterRow
  key={f.id}
  filter={f}
  onToggle={onToggle}
  toggling={togglingId === f.id}
  onOpenLevels={onOpenLevels}
  levelOverride={levelOverrides[f.id]}
/>
```

- [ ] **Step 5: Add level state + handler to the `Filters` component**

Inside the default-export `Filters` component, add state and a handler (near `togglingId`):

```jsx
  const [sheetFilter, setSheetFilter] = useState(null);      // raw filter object being edited
  const [levelOverrides, setLevelOverrides] = useState({});  // { [filterId]: title } optimistic pill

  async function handleSetLevel(rawFilter, targetTitle, aiValue) {
    setSheetFilter(null);
    const id = rawFilter.PK ?? rawFilter.pk ?? rawFilter.id;
    const prevOverride = levelOverrides[id];
    setLevelOverrides((o) => ({ ...o, [id]: targetTitle })); // optimistic
    const ops = buildFilterLevelOps(rawFilter, targetTitle, aiValue);
    try {
      await api.batchFilters(token, profileId, ops.filters);
      if (ops.option) {
        await api.setOption(token, profileId, ops.option.name, {
          status: ops.option.status,
          ...(ops.option.value !== undefined ? { value: ops.option.value } : {}),
        });
      }
      toast(`${rawFilter.name} → ${targetTitle}`, 'success');
      if (navigator.vibrate) navigator.vibrate(20);
    } catch (err) {
      setLevelOverrides((o) => ({ ...o, [id]: prevOverride })); // rollback
      toast(err.message, 'error');
    }
  }
```

- [ ] **Step 6: Pass the props to the native `FilterCategory` list and render the sheet**

Where the grouped native filters render, pass `onOpenLevels={setSheetFilter}` (open with the raw object) and `levelOverrides`. `setSheetFilter` must receive the RAW filter, so pass `(f) => setSheetFilter(f._raw)`:

```jsx
<FilterCategory
  key={category}
  name={category}
  filters={filters}
  onToggle={handleToggle}
  togglingId={togglingId}
  onOpenLevels={(f) => setSheetFilter(f._raw)}
  levelOverrides={levelOverrides}
/>
```

Then, before the component's closing tag, render the sheet (native tab only — external filters have no levels):

```jsx
{sheetFilter && (
  <FilterLevelSheet
    filter={sheetFilter}
    onChoose={(title, aiValue) => handleSetLevel(sheetFilter, title, aiValue)}
    onClose={() => setSheetFilter(null)}
  />
)}
```

(The external tab's `FilterCategory` should pass `onOpenLevels={() => {}}` and `levelOverrides={{}}` — external filters are never multi-level, so `FilterRow` renders their toggle regardless.)

- [ ] **Step 7: Verify build + full suite**

Run: `npm run build && npm test`
Expected: build succeeds; tests pass (existing + the new filterLevels tests).

- [ ] **Step 8: Commit**

```bash
git add src/components/Filters.jsx
git commit -m "feat(filters): level pill + sheet wiring for multi-level filters"
```

---

### Task 6: Verify end-to-end

**Files:** none (verification only).

- [ ] **Step 1: Build + full suite**

Run: `npm run build && npm test`
Expected: build clean; all tests pass.

- [ ] **Step 2: Live verification note**

A live Playwright pass is done by the controller (not this task): on an empty profile, open Filters → a multi-level filter shows a level pill; open the sheet; set Ads→Balanced and Malware→Strict (pick an AI strength); confirm server-side via `GET /profiles/{id}/filters`; then restore the profile's original filter levels. Do NOT commit anything for this step.

---

## Self-Review

**Spec coverage:** level selector for the 4 multi-level filters (Tasks 4,5) ✓; mutually-exclusive vs cumulative semantics (Tasks 1,2) ✓; data-driven titles incl. NRD "Last Week/Last Month" (Task 1 tests) ✓; Malware AI sub-picker + option (Tasks 2,4,5) ✓; simple + external filters unchanged (Task 5 FilterRow branch) ✓; API additions (Task 3) ✓; encode path params (Task 3) ✓; no dangerouslySetInnerHTML / plain-text render (Task 4) ✓; optimistic+rollback+toast+haptic (Task 5) ✓; TDD pure logic (Tasks 1,2) ✓.

**Placeholders:** none — all steps carry real code/commands. Task 5 Step 1 instructs reading the file first because the exact surrounding lines of Filters.jsx must be matched, not invented; the edits themselves are fully specified.

**Type consistency:** `getFilterLevels` returns `{isMultiLevel,isCumulative,options,currentTitle,aiValue}` consumed unchanged by `FilterLevelSheet` and `FilterRow`. `buildFilterLevelOps` returns `{filters:[{filter,status}], option}` consumed by `handleSetLevel` → `api.batchFilters(…, ops.filters)` and `api.setOption(…, ops.option.name, {status,value})`. `onChoose(targetTitle, aiValue)` matches `handleSetLevel(rawFilter, targetTitle, aiValue)`. Consistent.

**Open risk (from spec):** the `{filters:[...]}` batch body may need JSON rather than form-encoding — flagged in Task 3 Step 1, to be confirmed at the live-verification step; switch `batchFilters`/`setOption` to JSON if a live call 400s.
