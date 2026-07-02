# Services Screen — Design Spec

**Date:** 2026-07-02
**Status:** Approved (design) — pending implementation plan
**Feature:** 1 of 5 planned additions to controld-mobile (Services → Filter levels → Rule editing/Spoof → Default Rule → Devices)

## Context & Goal

controld-mobile is a personal mobile PWA for quickly adjusting the user's Control D
DNS settings on the fly — the Control D website is a poor mobile experience. The app
already does token auth, profile selection, custom-rule CRUD, and filter view+toggle.

This feature adds a **Services** screen. A Control D "Service" is a named shortcut for
an entire app/site and all the domains behind it (~1,010 services across 12 categories,
maintained by Control D). Setting a service applies one action — Block / Bypass /
Redirect — to that whole bundle, at a precedence level **above filters** (evaluation
order: Custom Rules → Services → Filters → Default Rule), scoped to the current profile.
This makes "search an app → Bypass" a clean fix when a filter is over-blocking, and
**Redirect + a proxy location** provides geo-unblocking of region-locked content.

The `api.getServices` / `api.updateService` methods already exist in `src/api/controld.js`
(marked "Phase 2") but have no UI.

## UX Decisions (settled via visual brainstorming)

1. **Layout: browse + search.** Mirror the website's category-expand structure (12
   collapsible categories) **plus a sticky search box** on top. With 318 apps in Video
   alone, search is required for the "fix it fast" use case. Search spans all categories.
2. **Action control: tap-open bottom sheet.** Rows stay clean (app name + a status
   pill). Tapping an app opens a bottom sheet with large Block / Bypass / Redirect
   buttons plus a "Remove / off" option. Choosing **Redirect** reveals a **location
   picker** inline, defaulting to Control D's suggested location for that app, with
   "change ›" to pick any of the user's 103 proxy locations.
3. **Nav placement:** a 5th bottom-nav tab — `Profiles · Rules · Filters · Services · Settings`.

## API Surface (all confirmed against the live account)

| Purpose | Endpoint | Shape |
|---|---|---|
| Configured services for a profile (sparse — only set ones) | `GET /profiles/{id}/services` | `services[]` of `{PK, do, status, via}` |
| Global catalog — category list | `GET /services/categories` | `categories[]` of `{PK, name, count}` (12 total) |
| Catalog — one category's apps | `GET /services/categories/{category}` | `services[]` of `{PK, name, category, unlock_location, warning}` |
| Set/change/remove a service | `PUT /profiles/{id}/services/{service}` | body `{do, status, via}` (form-encoded) |
| Proxy locations (for Redirect) | `GET /proxies` | `proxies[]` of `{PK, city, country, country_name, ...}` (103) |

**Action codes (`do`):** 0 = Block, 1 = Bypass, 3 = Redirect (`via` = proxy code).
2 = Spoof exists but is not used for services. `status` 1 = active, 0 = removed/off.

## Data Flow

- **On screen open:** fetch (a) configured services for the current profile (small,
  sparse) and (b) the proxy list once (for the location picker).
- **Browse:** each category's apps are lazy-loaded when the category is expanded
  (`GET /services/categories/{cat}`). The 1,010-item catalog is never pulled upfront.
- **Search:** on the first keystroke, fetch all 12 categories once and cache them in
  memory (~1,010 tiny records, ~100 KB), then filter client-side. There is no server
  search endpoint. Cache lives for the session.
- **Current action per app:** derived by merging the catalog entry with the configured
  (set) services, keyed by service `PK`.

## Write Path

Tap app → sheet → pick action → `api.updateService(token, profileId, servicePK, payload)`.
Follow the **existing optimistic-update + rollback + toast + haptic** pattern from
`Filters.jsx`: apply the new state immediately, call the API, roll back and toast the
error on failure. "Remove / off" sends `{status: 0}`.

## Pure Logic (TDD'd test-first, in `src/lib/services.js`, tests `src/lib/services.test.js`)

Four pure functions hold the real logic so the React component stays thin. Each is
written test-first (true TDD — failing test before implementation):

1. **`mergeServiceState(catalogServices, configuredServices)`**
   → catalog items annotated with `{action: 'block'|'bypass'|'redirect'|null, via, status}`
   based on the configured map keyed by `PK`. Apps with no configured entry → `action: null`.

2. **`filterServices(catalogServices, query)`**
   → case-insensitive substring match on service `name` (and `PK`). Empty/whitespace
   query returns the input unchanged (caller decides browse-vs-search view).

3. **`buildServicePayload(action, viaLocation)`**
   → maps a UI action to the API body:
   `block → {do:0, status:1}`, `bypass → {do:1, status:1}`,
   `redirect → {do:3, status:1, via: viaLocation}`, `off → {status:0}`.

4. **`resolveDefaultLocation(service, proxies)`**
   → map a service's suggested `unlock_location` (e.g. `"SYD"`) to a proxy `via` code,
   with a sensible fallback when there's no match.
   **⚠️ RISK / VERIFY-DURING-BUILD:** the exact relationship between `unlock_location`
   codes and proxy `PK` values must be confirmed against live data before finalizing
   this function. If they don't map 1:1, this function absorbs the translation and its
   tests encode the confirmed mapping.

## Components

- **`Services.jsx`** — screen: sticky search bar, category list, session catalog cache,
  loading/error/empty states. Owns data fetching + optimistic writes.
- **`ServiceCategory`** — collapsible section; lazy-loads its apps on first expand.
- **`ServiceRow`** — app name + current-action status pill; tap opens the action sheet.
- **`ServiceActionSheet`** — bottom sheet: Block / Bypass / Redirect / Remove; reveals
  the location picker when Redirect is selected.
- **`LocationPicker`** — searchable list of the 103 proxy locations; defaults to the
  service's resolved default location.

Match existing style/patterns from `Filters.jsx` (skeleton loader, error+retry, toasts,
haptics, `toArray` response normalization).

## States

- **Loading:** skeleton (reuse Filters skeleton pattern).
- **Error:** message + Retry (reuse Filters pattern).
- **Empty search:** "No apps match '<query>'".
- **No profile selected:** "Select a profile first." (reuse existing guard.)

## Testing

- Unit tests (Vitest, on the existing test harness) for the four pure functions above —
  written before their implementations.
- The React component is intentionally thin (wires tested functions to the existing API
  client + UI patterns); no component-level test infra (jsdom/Testing Library) is added
  for this feature — that's deferred to a later feature that needs it.

## Scope Boundaries (YAGNI)

Explicitly **not** in this feature:
- No category-level bulk actions / "block entire category" toggle.
- No editing of Control D's service catalog.
- No component/integration test framework (jsdom) — pure-function tests only.
- Spoof action is out (services use Block/Bypass/Redirect); Spoof belongs to feature #3.

## Open Risk

The `unlock_location` → proxy `via` mapping (function #4) is the one unknown; it will be
resolved with a live API check at the start of implementation, and the confirmed mapping
encoded in that function's tests.
