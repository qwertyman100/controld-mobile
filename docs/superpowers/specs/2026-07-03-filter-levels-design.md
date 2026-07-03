# Filter Levels — Design Spec

**Date:** 2026-07-03
**Status:** Approved (design) — pending implementation plan
**Feature:** 2 of 5 planned additions (Services ✓ → **Filter levels** → Rule editing/Spoof → Default Rule → Devices)

## Context & Goal

`src/components/Filters.jsx` currently renders every native filter as a plain on/off
toggle. But four native filters are graduated — they expose distinct level keys and
`Off / Relaxed / Balanced / Strict` modes. This feature adds a **level selector** for
those, while leaving the other 16 native filters (and all external/3rd-party filters) as
plain toggles.

The four multi-level native filters (confirmed live + against docs.controld.com):

| Filter | Levels (title → key, type) | Semantics |
|---|---|---|
| **Ads & Trackers** (`ads`) | Relaxed→`ads_small`, Balanced→`ads_medium`, Strict→`ads` (all `filter`) | **Mutually-exclusive** |
| **Adult Content** (`porn`) | (from API `levels[].title`) → `porn`, `porn_strict` (`filter`) | **Mutually-exclusive** |
| **New Domains / NRD** (`nrd`) | Relaxed→`nrd_small`, Strict→`nrd` (`filter`) | **Mutually-exclusive** |
| **Malware** (`malware`) | Relaxed→`malware` (`filter`), Balanced→`ip_malware` (`ipfilter`), Strict→`ai_malware` (`option`, value 0.9/0.7/0.5) | **Cumulative** |

## Two level semantics (the core of the design)

- **Mutually-exclusive** (Ads, Adult, NRD): exactly one level key is active. Selecting a
  mode **enables that key and disables its siblings**; Off disables all. One batch call.
- **Cumulative** (Malware only): each level *adds a layer* on top of the previous —
  Relaxed = `malware`; Balanced = `malware` + `ip_malware`; Strict = `malware` +
  `ip_malware` + the `ai_malware` **profile option**. Strict also exposes an **AI-strength**
  sub-value (Minimal 0.9 / Standard 0.7 / Aggressive 0.5). Malware is identified by
  `PK === 'malware'` and special-cased in both reading the current level and writing ops.

## UX (approved: tap-open sheet)

- **Multi-level filter rows** show a colour-coded **level pill** (grey Off · green Relaxed ·
  amber Balanced · red Strict). Tapping opens **`FilterLevelSheet`**: a radio list of the
  filter's modes (`Off` + the API `levels[].title` values) with a one-line description each,
  and — for Malware with **Strict** selected — the **AI-strength** sub-picker (Minimal /
  Standard / Aggressive) appears directly below Strict.
- **Simple filter rows** are unchanged (existing on/off toggle).
- **External / 3rd-party filters** are unchanged (on/off).
- Mode help text: show the filter's plain-text `description` at the sheet top and a short
  hint per mode. The `additional` field is HTML — it is **not** rendered as HTML (no
  `dangerouslySetInnerHTML`); tags are ignored/stripped. (YAGNI: no rich mode docs.)

## API additions (`src/api/controld.js`)

`getFilters` already exists. Add:

- `batchFilters(token, profileId, filters)` → `PUT /profiles/{id}/filters`, body
  `{ filters: [{ filter, status }] }`. Sets multiple filter keys atomically.
- `setOption(token, profileId, name, payload)` → `PUT /profiles/{id}/options/{name}`,
  body `{ status, value }`. Used for the `ai_malware` option (Malware Strict).

Both interpolate path params through `encodeURIComponent` (per the input-hardening rule).

## Pure logic (TDD'd, `src/lib/filterLevels.js`)

Written test-first with the real filter object shapes:

1. **`getFilterLevels(filter)`** → `{ isMultiLevel, isCumulative, options: string[] (['Off', …titles]), currentTitle, aiValue }`.
   - `isMultiLevel` = `Array.isArray(filter.levels) && filter.levels.length > 0`.
   - `isCumulative` = `filter.PK === 'malware'`.
   - `currentTitle`: exclusive → map `filter.action?.lvl` to its level title, else `'Off'`;
     cumulative → highest active layer (ai option on → Strict; else ip_malware on → Balanced;
     else malware on → Relaxed; else Off), derived from `filter.levels[].status`.
   - `aiValue`: for Malware, the current `ai_malware` value (from the Strict level's
     `opt[0].value`) or the Minimal default `0.9`.

2. **`buildFilterLevelOps(filter, targetTitle, aiValue)`** → `{ filters: [{filter, status}], option: {name, status, value} | null }`.
   - **Exclusive:** `filters` = every level → `status = (level.title === targetTitle ? 1 : 0)`; `option: null`.
   - **Cumulative (Malware):** map `targetTitle` to cumulative statuses —
     `Off`→ all 0 + `option {name:'ai_malware', status:0}`;
     `Relaxed`→ `malware:1, ip_malware:0` + option off;
     `Balanced`→ `malware:1, ip_malware:1` + option off;
     `Strict`→ `malware:1, ip_malware:1` + `option {name:'ai_malware', status:1, value: aiValue ?? 0.9}`.

All inputs coerced/guarded before string ops (the numeric-`1688` rule). Level selection is
button-driven (no free-text input), so the input allowlist is N/A here; the AI value is a
fixed enum (0.9 / 0.7 / 0.5).

## Components

- **`Filters.jsx`** (modify): in the native tab, a filter with `getFilterLevels().isMultiLevel`
  renders a level pill that opens the sheet; otherwise the existing toggle. On level change,
  call `buildFilterLevelOps`, apply the resulting `batchFilters` (+ `setOption` when
  `option` is non-null), using the existing **optimistic-update + rollback + toast + haptic**
  pattern. External tab and simple rows unchanged.
- **`FilterLevelSheet.jsx`** (new): bottom sheet — radio mode list + descriptions +
  Malware AI sub-picker. `onChoose(targetTitle, aiValue)` callback; mirrors `ServiceActionSheet`.

## Testing

- **TDD** the two pure functions against the real shapes (ads exclusive, malware cumulative,
  porn/nrd 2-level, a simple filter → `isMultiLevel:false`), on the existing Vitest harness.
- React components: build-verified (`npm run build`), no jsdom (project convention).
- **Live Playwright pass** on an empty profile: set a filter's level (e.g. Ads→Balanced),
  set Malware→Strict with an AI strength, verify server-side, then restore original levels.

## Scope boundaries (YAGNI)

- Only the four multi-level native filters get selectors; simple + external filters untouched.
- No per-source / custom filter-list editing.
- No rich HTML mode documentation (short plain hints only).
- The `ai_malware` value is limited to the three documented strengths (Minimal/Standard/Aggressive).

## Open risk

`getFilterLevels` for **Adult (`porn`)** assumes the API `levels[].title` values (2 levels);
the sheet is data-driven off those titles, so exact wording comes from the API — verified at
implementation start with a live `GET /filters` check (read-only).
