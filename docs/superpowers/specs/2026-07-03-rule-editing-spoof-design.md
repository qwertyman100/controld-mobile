# Rule Editing + Spoof — Design Spec

**Date:** 2026-07-03
**Status:** Approved (design) — pending implementation plan
**Feature:** 3 of 5 (Services ✓ → Filter levels ✓ → **Rule editing + Spoof** → Default Rule → Devices)

## Context & Goal

`src/components/CustomRules.jsx` currently supports quick-add (domain + Bypass/Block/
Redirect), status toggle, and delete. Two gaps: the **Spoof** action isn't exposed, and
existing rules can't be **edited** (only toggled/deleted). This feature adds both — on top
of a foundational bug fix.

## 0. Foundational fix — `normaliseRule` reads the nested action (data integrity)

Live rule objects nest the action: `{ PK: "host", order, group, action: { do, status, via } }`.
`normaliseRule` currently reads `r.do`/`r.status`/`r.via` from the **top level** (always
`null`), so it falls back to defaults (`do → Bypass`). Consequences (both real, confirmed live):

- **Every rule is mis-displayed** — a `do:0` (Block) rule shows as Bypass.
- **`toggleRule` corrupts the action** — it sends `do: rule.do` (the mis-read Bypass
  default), so toggling a Block rule rewrites it to Bypass on the server.

**Fix:** read `r.action?.do ?? r.do ?? RULE_ACTION.BYPASS` (and same for `status`, `via`,
`via_v6`), so the nested action wins and the flat optimistic-prepend shape still works.
Coerce with `String()`/`Number()` guards. `normaliseRule` is already exported+tested;
extend its tests with a nested-action case. This is **task 0** — editing depends on it.

## 1. Spoof action

- Add **Spoof** (`RULE_ACTION.SPOOF`, `do:2`) to `ACTION_META` (purple) and the action
  selector (now 4: Bypass / Block / Redirect / Spoof).
- Spoof answers a domain with a user-specified address (unlike Redirect, which routes
  through a ControlD proxy location). When Spoof is selected the UI shows:
  - **Target** (`via`) — a text input accepting an **IPv4 address or a hostname**.
  - **"+ Add IPv6 target"** — an optional revealed field for `via_v6` (an IPv6 address).
- Inputs are **validated** before send (input-hardening rule): see `validateSpoofTarget`.

## 2. Editing (pencil ✎ → edit sheet)

- Each rule row gains a **pencil ✎ icon** (the existing inline on/off toggle + delete stay).
- Tapping it opens **`RuleEditSheet`** (new bottom-sheet, mirrors `ServiceActionSheet`/
  `FilterLevelSheet`): the 4-action selector + the conditional **target editor** (proxy
  picker for Redirect; IPv4/hostname + optional IPv6 for Spoof) + a **Save** button.
- Save calls `api.updateRule(token, profileId, { hostname, do, status, via, via_v6 })`
  (hostname identifies the rule), with the existing optimistic-update + rollback + toast.
- Status toggle and delete remain on the row (not duplicated in the sheet).

## 3. Shared editor (DRY)

Extract **`RuleActionTarget`** — the 4-action selector + conditional target fields (proxy
`<select>` for Redirect, IP/hostname + optional IPv6 for Spoof) — used by **both** the
top add-bar and `RuleEditSheet`, so the Spoof/Redirect target logic lives in one place.

## 4. Pure logic (TDD'd, `src/lib/rules.js`)

Written test-first:

1. **`normaliseRule(rule)`** (moved here from CustomRules, fixed) → `{ hostname, do, status,
   group, via, via_v6, _raw }`, reading `action.*` first, top-level fallback, coerced.
2. **`validateSpoofTarget(value, { ipv6 } = {})`** → `{ ok, value, error }`.
   - Trim + coerce. Empty → error.
   - Main field (`ipv6` false): valid if **IPv4** (four octets 0–255) **or hostname**
     (`[A-Za-z0-9-]` labels, dot-separated, no TLD requirement so `myserver.home`/`nas`
     pass; ≤253 chars). Reject anything with other characters.
   - IPv6 field (`ipv6` true): valid if it matches an IPv6 shape (hex digits + colons,
     contains `::` or ≥2 colons; no other characters).
3. **`buildRulePayload(doCode, { via, viaV6 } = {})`** → `{ do, status: 1, …via, …via_v6 }`
   (`doCode` is a numeric `RULE_ACTION`, matching the app's `action` state):
   - Bypass `1` → `{do:1}`; Block `0` → `{do:0}`; Redirect `3` → `{do:3, via}`;
     Spoof `2` → `{do:2, via, …(viaV6 ? {via_v6: viaV6} : {})}`.
   - `via` included only for Redirect/Spoof; `via_v6` only for Spoof when provided.
   - Caller adds `hostnames[]` (create) or `hostname` (update).

## 5. Components

- **`CustomRules.jsx`** (modify): use `normaliseRule` from the lib; add Spoof to
  `ACTION_META`; render `RuleActionTarget` in the add bar (replacing the inline
  proxy-only selector); add a pencil ✎ to each rule row that opens `RuleEditSheet`;
  hold `editingRule` state.
- **`RuleActionTarget.jsx`** (new): shared action selector + conditional target editor;
  props `{ action, onActionChange, via, onViaChange, viaV6, onViaV6Change, proxies }`.
- **`RuleEditSheet.jsx`** (new): bottom sheet wrapping `RuleActionTarget` + Save; props
  `{ rule, proxies, onSave, onClose }`.

## 6. Security / validation

Spoof target passes `validateSpoofTarget` (allowlist — no shell/code metacharacters, per
[[feedback_input_validation]]); rule bodies are form-encoded (`URLSearchParams`); API path
params are `encodeURIComponent`'d; no `dangerouslySetInnerHTML`. All values rendered as
plain React children.

## 7. Testing

- **TDD** the three pure functions against real shapes (nested-action rule; IPv4/hostname/
  IPv6 targets incl. junk-rejection; each action's payload).
- **Component tests** (jsdom harness): `RuleEditSheet` — selecting Spoof reveals the target
  input, Save calls `onSave` with the built payload; and the normaliseRule regression.
- **Live Playwright pass**: add a Spoof rule (e.g. `spooftest.example` → an IP) on an empty
  profile, verify server-side (`do:2`, `via` set), edit an existing rule's action, then
  delete/restore.

## 8. Scope boundaries (YAGNI)

- No **hostname** editing (rare — delete + re-add). Edit changes **action + target** only.
- No folder/group reassignment in this feature.
- IPv6 target is optional/advanced; single `via_v6` only.

## Open risk

`validateSpoofTarget`'s IPv6 check is a pragmatic "looks like IPv6" allowlist, not full
RFC validation — the ControlD API does final validation. Flagged; the tests encode the
accepted/rejected cases explicitly.
