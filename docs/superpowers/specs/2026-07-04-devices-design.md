# Devices — Design Spec

**Date:** 2026-07-04
**Status:** Approved (design) — pending implementation plan
**Feature:** 5 of 5 (Services ✓ → Filter levels ✓ → Rule editing + Spoof ✓ → Default Rule ✓ → **Devices**)

## Context & Goal

The app manages profiles/rules/filters/services but never surfaces the account's **devices**
(ControlD endpoints/resolvers) — the things that actually point at ControlD and get a profile
enforced on them. This feature adds a **Devices** screen to view every device (its profile
chain, online status, clients, and connection info) and to **reassign** which profile(s) a
device uses. It also relocates **Settings** off the bottom nav (to a header gear) to make room.

**Out of scope (blocked, not a choice):** per-device activity/query logs and the "block-log →
one-tap Allow" queue. The `/queries` endpoint returns 403 to **both** the read-only and
read/write API tokens (it's dashboard-session-only), and device `stats` is a scalar, not query
data. A feature request has been filed to ControlD (`docs/controld-api-feature-request.md`).

## API contract (verified live)

- **Read:** `GET /devices` → `{ devices: [ … ] }`. Each device:
  `{ PK, name, status, client_count, ip_count, icon, profile:{PK,name}, profile2?:{PK,name},
     resolvers:{uid, doh, dot, v6:[…]} }`. `status===1` = online. `profile2` present only when chained.
  Resolvers: `doh` = `https://dns.controld.com/{uid}`, `dot` = `{uid}.dns.controld.com`,
  `v6` = array of IPv6 strings.
- **Write:** **`PUT /devices/{id}`**, **form-encoded, partial update**
  (only sent fields change). Params used: `profile_id` (primary profile PK),
  `profile_id2` (chained profile PK, or the literal **`-1` to remove** the chain).
  Verified live: a no-op `profile_id=current` PUT returned 200 and left the device unchanged.
- Profiles for the pickers come from the existing `GET /profiles` (`api.getProfiles`).

## 1. Nav / Settings restructure

The bottom nav is full (5 tabs). To add Devices without crowding, Settings moves out:

- **Bottom nav (5):** Profiles · Rules · Filters · Services · **Devices** (Devices replaces Settings).
- **Settings → header gear** (top-right, beside the existing theme toggle), visible on every screen.
- **Settings screen gets a back-arrow (top-left)** that returns to the page the user opened it
  from. `App.jsx` records the origin page when the gear is tapped and restores it on back.
- No unsaved-changes prompt — Settings changes auto-apply as today (theme toggles instantly;
  everything else is read-only or the Disconnect action). (Reverses the earlier gear removal,
  but now with a working back path — which was the missing piece that made the old gear a dead end.)

## 2. Devices screen (`DeviceList.jsx`)

- Fetches `api.getDevices()` on mount (loading skeleton + error+retry, mirroring `ProfileList`).
- One **row per device**: an icon, the **name**, an **online dot** (`status===1` → green, else grey),
  the **profile chain** as a subtitle (`profile.name → profile2.name`, or just `profile.name`
  when unchained), and a small **client count** (`{client_count} client(s)`).
- Tapping a row opens **`DeviceEditSheet`** for that device.
- Device `icon` is a ControlD name string (e.g. `mobile-android`, `router-firewalla`,
  `desktop-linux`); map known prefixes to a lucide icon (`Smartphone`/`Router`/`Monitor`/
  fallback `HardDrive`) via a small `deviceIcon()` helper — no external icon assets.

## 3. `DeviceEditSheet.jsx` (view + reassign)

Bottom sheet (same overlay pattern as `FilterLevelSheet`/`DefaultRuleSheet`). Props
`{ device, profiles, onSave, onClose }`. Sections:

- **Header:** device name + online status; a line of meta (`{client_count} clients · {ip_count} IPs`).
- **Connection info** (read-only): DoH URL, DoT hostname, and IPv6 addresses from `resolvers`,
  each rendered as selectable text (plain React children — no `dangerouslySetInnerHTML`). This is
  the "how to point something at ControlD" reference.
- **Reassign editor:**
  - **Primary profile** — `<select>` of `profiles` (required), seeded from `device.profileId`.
  - **Chained profile** — `<select>` of `profiles` plus a leading **"None"** option, seeded from
    `device.profile2Id`. Choosing None maps to removing the chain.
- **Save** button → `onSave(buildDeviceProfilePayload({ profileId, profile2Id }))`. The banner/
  screen performs the `PUT` with optimistic update + rollback + toast.

## 4. Pure logic (TDD'd, `src/lib/devices.js`)

1. **`normaliseDevice(device)`** → `{ id, name, status, online:boolean, clients:number,
   ipCount:number, icon, profileId, profileName, profile2Id, profile2Name, resolvers }`.
   Coerce with `String()`/`Number()`; `online = Number(status) === 1`; `profile2Id/Name` are
   `null` when unchained. Guard missing `profile`/`resolvers`.
2. **`deviceChainLabel(device)`** → `"A → B"` when chained, else `"A"`, else `""` (no profile).
3. **`deviceIcon(iconName)`** → a lucide component chosen by prefix (`mobile`→Smartphone,
   `router`→Router, `desktop`→Monitor, else HardDrive). Pure mapping (returns the component).
4. **`buildDeviceProfilePayload({ profileId, profile2Id })`** → form body object:
   - always `{ profile_id: profileId }`;
   - if `profile2Id` is set → add `profile_id2: profile2Id`;
   - if `profile2Id` is null/empty (None chosen) → add `profile_id2: '-1'` (removes the chain).
   - Tests: primary-only → `{profile_id}` + `{profile_id2:'-1'}`; primary+chain →
     `{profile_id, profile_id2}`; changing primary keeps/removes chain per the picker.

## 5. Components & files

- **`src/lib/devices.js`** + `devices.test.js` (pure logic above).
- **`src/api/controld.js`** (modify): add
  `updateDevice: (token, deviceId, payload) => request(token,'PUT',\`/devices/${encodeURIComponent(deviceId)}\`, payload)`.
  (`getDevices` already exists.)
- **`src/components/DeviceList.jsx`** (new): the screen — fetch, rows, opens the sheet, holds
  `devices` + `editingDevice`; loads `profiles` (via `getProfiles`) for the sheet; `handleSave`
  does the optimistic `updateDevice` + rollback + toast.
- **`src/components/DeviceEditSheet.jsx`** (new): the view+reassign sheet (§3).
- **Nav wiring:** `src/components/BottomNav.jsx` (swap Settings → Devices), `src/App.jsx`
  (add `'devices'` page → `<DeviceList/>`; track `settingsOrigin` page; render `<Settings/>` with
  an `onBack` that returns to the origin), `src/components/Layout.jsx` (header **gear** button that
  navigates to Settings, remembering the origin; Settings screen shows a **back-arrow** instead of
  the gear).

## 6. Security / validation

Both profile pickers are controlled `<select>`s over the account's own profile PKs — no free
text reaches `profile_id`/`profile_id2` (per [[feedback_input_validation]]). API path uses
`encodeURIComponent(deviceId)`. Bodies are form-encoded via the existing `request()`. Resolver
strings render as plain React children.

## 7. Testing

- **TDD** the four pure functions in `devices.test.js` (normalise nested profile/profile2/
  resolvers; chain label with/without chain; icon mapping; payload incl. the `-1` remove case).
- **Component test** (`DeviceEditSheet.test.jsx`, jsdom): pickers populate from `profiles`;
  selecting a new primary + a chain and Save calls `onSave` with `{profile_id, profile_id2}`;
  choosing **None** for the chain yields `profile_id2:'-1'`; connection info (DoH/DoT) renders.
- **Live Playwright pass:** open Devices, confirm the list + chains render; open one device
  (least-disruptive — **IoT**), **add a chain then remove it** (or change primary and restore),
  verifying `profile2` server-side each step and restoring to the exact original within the pass.

## 8. Scope boundaries (YAGNI)

- No activity/query log, no allow-queue (API-blocked — see Context).
- No device rename/delete/create, no DDNS or ctrld-config editing, no `stats`/`status`/
  `restricted` toggles — reassignment is the only write (edit **profile + chain** only).
- Connection info is **read-only** (display, not a QR generator or copy-all bundle).
- Settings relocation carries no new settings — it's purely the nav move + back-arrow.

## Open risk

Reassigning a device changes live DNS for that device. The UI writes only the two profile
fields (partial update), and live verification restores the test device immediately. Household
disruption is minimal (one device, seconds, reversible) but real — the live pass uses the IoT
device and restores within the same pass.
