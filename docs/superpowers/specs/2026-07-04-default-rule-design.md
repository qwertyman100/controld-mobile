# Default Rule — Design Spec

**Date:** 2026-07-04
**Status:** Approved (design) — pending implementation plan
**Feature:** 4 of 5 (Services ✓ → Filter levels ✓ → Rule editing + Spoof ✓ → **Default Rule** → Devices)

## Context & Goal

Every DNS query that isn't caught by a custom rule, a service, or a filter falls through to
the profile's **default rule** (the ControlD `profile.da` field — a catch-all). Today every
profile is `da:{do:1}` = **Bypass** (unmatched domains resolve normally), and the app never
surfaces this. This feature exposes the default rule on the Rules screen and lets the user set
it per profile — enabling, notably, a **default-deny allowlist** lockdown on IoT/Media profiles
(default Block + explicit Bypass rules = only allowed domains resolve).

## API contract (verified live, undocumented — discovered by probing)

- **Read:** `profile.da = {do, status, via?}`, returned inside each profile by `GET /profiles`.
- **Write:** `PUT /profiles/{id}/default`, **form-encoded** body `{do, status, via?}`.
- **Actions (`do`):** `0` = Block, `1` = Bypass, `3` = Redirect. **No Spoof** — the default
  rule supports only these three (confirmed by ControlD docs and the API).
- **Redirect (`do:3`) requires `via`** = a ControlD location code (3-letter city, e.g. `DFW`;
  103 available via `GET /proxies`). `do:3` with **no** `via` → **HTTP 400 "Invalid default
  action rule"**. So "Auto / nearest" is **not** settable through this endpoint — Redirect is
  **location-only** in this feature (Auto deferred; flagged as out of scope below).
- `status` is `1` in practice; we always send `status:1`.

## 1. UI — banner on the Rules screen (approved placement)

A pinned **"When nothing matches"** banner at the **top of the Rules screen**
(`CustomRules.jsx`), above the add bar and rule list. It shows the current default action with
its semantic color (Block red / Bypass green / Redirect blue) and a **"Change ›"** affordance.
Tapping it opens the **`DefaultRuleSheet`** bottom sheet (mirrors `FilterLevelSheet` /
`ServiceActionSheet`).

Rationale (vs a Profiles-screen card): the default rule *is* the rule for everything the
explicit rules don't cover, so it belongs with the rules; and it adds no new nav tab.

## 2. `DefaultRuleSheet` — the action picker

Bottom sheet titled **"Default Rule"**, subtitle *"Applies to any domain that doesn't match a
rule, service, or filter."* Contents:

- **Three action options**, each with a plain-language description (so the lockdown one is
  obviously the odd one out):
  - **Block** — *"Nothing resolves unless you've allowed it with a Bypass rule."*
  - **Bypass** — *"Resolve normally — the standard default."*
  - **Redirect** — *"Route everything else through a location."*
- **Block guardrail:** when Block is selected, show an inline warning:
  *"Block makes this profile an allowlist — only domains you've allowed with a Bypass rule will
  resolve. Everything else, including brand-new domains, is denied."*
  (Generic + accurate for all profiles. A chain-aware variant — "this profile chains to Base…" —
  needs device/chain data the app doesn't have yet; **out of scope**, revisit with feature #5.)
- **Redirect location:** when Redirect is selected, reveal a location `<select>` populated from
  `getProxies()` (same list custom redirect rules use). A location is **required** for Redirect.
- **Save** button. On Save: validate (Redirect ⇒ a location is chosen), then
  `onSave(buildDefaultRulePayload(...))`; the banner performs the API write + optimistic update.

No free-text inputs in this feature — the location is a controlled `<select>` of proxy PKs, so
the only user-chosen value is allowlisted by construction (per [[feedback_input_validation]]).

## 3. Pure logic (TDD'd, `src/lib/defaultRule.js`)

Written test-first:

1. **`DEFAULT_ACTIONS`** — ordered metadata array for the 3 actions:
   `[{do:0, key:'block', label:'Block', color:…, desc:…}, {do:1, key:'bypass', …},
   {do:3, key:'redirect', …}]`. (No Spoof entry.)
2. **`normaliseDefaultAction(da)`** → `{do, status, via}`.
   - `do = Number(da?.do ?? RULE_ACTION.BYPASS)` (fallback Bypass=1);
     `status = Number(da?.status ?? 1)`; `via = da?.via ?? null`.
   - Guards a missing/null `da` (new/blank profile) → Bypass default.
   - Tests: `{do:0,status:1}`→block; `{do:1}`→bypass; `{do:3,status:1,via:'DFW'}`→redirect+via;
     `null`/`undefined`→bypass default; string `do:"0"`→coerced Number 0.
3. **`buildDefaultRulePayload(doCode, { via } = {})`** → `{do, status:1, …(doCode===3 ? {via} : {})}`.
   - `via` included **only** for Redirect. Bypass/Block → `{do, status:1}` (no via).
   - Tests: block→`{do:0,status:1}`; bypass→`{do:1,status:1}`;
     redirect(`{via:'DFW'}`)→`{do:3,status:1,via:'DFW'}`.
4. **`validateDefaultRule(doCode, { via } = {})`** → `{ ok, error }`.
   - Redirect with no `via` → `{ok:false, error:'Choose a location to redirect to.'}`.
   - Block/Bypass → always `{ok:true}`. Redirect with a `via` → `{ok:true}`.
   - Tests: each action; redirect-without-location rejected.

## 4. Components & API

- **`src/api/controld.js`** (add):
  `setDefaultRule: (token, profileId, payload) => request(token, 'PUT',
  \`/profiles/${encodeURIComponent(profileId)}/default\`, payload)` (form-encoded, like other
  scalar mutations).
- **`src/components/DefaultRuleBanner.jsx`** (new): props `{ profile }`. On mount, fetches the
  authoritative current default via `getProfiles()` → find by PK → `profile.da`
  (seeded instantly from `profile.profile?.da` while loading so there's no flash). Holds
  `da` state; renders the banner (label + colored current action + "Change ›"); opens
  `DefaultRuleSheet`. On sheet Save: optimistic set `da`, `api.setDefaultRule(...)`, rollback +
  error toast on failure, success toast on success (mirrors the CustomRules optimistic pattern).
- **`src/components/DefaultRuleSheet.jsx`** (new): props `{ da, proxies, onSave, onClose }`.
  Local state seeded from `da` (action + via). Renders the 3 options + Block warning +
  conditional location `<select>` + Save. Validates via `validateDefaultRule` on Save; shows an
  inline `role="alert"` error if Redirect has no location.
- **`src/components/CustomRules.jsx`** (modify): render `<DefaultRuleBanner profile={profile} />`
  at the top of the screen (above the add bar). Also load `proxies` (already loaded there for
  redirect rules) — pass down or let the banner fetch its own.

## 5. Testing

- **TDD** the four pure functions in `src/lib/defaultRule.test.js` (cases above).
- **Component test** (`DefaultRuleSheet.test.jsx`, jsdom): selecting Redirect reveals the
  location `<select>`; selecting Block shows the allowlist warning; Save with Redirect + no
  location is blocked (error shown, `onSave` not called); Save with Bypass calls `onSave` with
  `{do:1,status:1}`.
- **Live Playwright pass** (empty **Phone Extras** `499929sjcgpis`, restore to `da:{do:1}`):
  banner shows "Bypass"; set **Block** → verify `da.do:0` server-side + banner updates + Block
  warning was shown; set **Redirect** + a location → verify `da:{do:3,via:…}`; restore to Bypass.

## 6. Scope boundaries (YAGNI)

- **No Spoof** (API doesn't support it for the default rule).
- **No "Auto / nearest" redirect** (API rejects `do:3` without `via`) — location-only. Revisit
  if a special "auto" `via` value is found.
- **No chain-aware warning** (needs device→profile chain data; feature #5 territory). The
  generic allowlist warning covers the safety message accurately.
- Per-profile only (the default rule is a profile property; "per-device" = per-profile, which is
  per-device only when a device has its own profile — a user-side setup choice, not app scope).

## Open risk

The write endpoint (`PUT /profiles/{id}/default`) is undocumented; it was verified live against
a blank profile and behaves consistently. Redirect location codes come straight from
`getProxies()`, so they're always valid values the API accepts.
