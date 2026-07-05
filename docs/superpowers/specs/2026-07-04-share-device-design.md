# Share / Add-a-Device — Design Spec

**Date:** 2026-07-04
**Status:** Approved (design) — pending implementation plan
**Feature:** Quality-of-life add-on (post-roadmap) — onboard a new phone quickly via a QR/share of the app URL.

## Context & Goal

Onboarding the PWA on a new phone means getting to `controld-mobile.pages.dev` and signing in.
This adds a **Share** affordance on the current phone — a **QR code** (plus copy-link and native
share) of the **app URL** — so a new phone can scan and land straight on the app's existing
onboarding. The app is fully serverless (one token in `localStorage`, no accounts), so the
existing sign-in flow (create-token link + clipboard import) handles everything after the URL loads.

**Deliberately NOT sharing the token.** The QR/link carries only the public app URL — no secret,
no account data. (We considered embedding the token for one-scan login and rejected it: the QR
would become a live credential. The new phone signs in itself.)

## No API / no consume-side changes

- No ControlD API calls, no new endpoints, nothing sensitive.
- **The receiving phone needs no new code** — it hits the existing `OnboardingFlow` (guided token
  creation + the existing clipboard-token import on the token-entry screen).
- This feature is purely additive on the sharing side.

## 1. UI — Settings entry

Add a row to **`Settings.jsx`** (its own section, above **Disconnect**): an **"Add another device"**
button (lucide `QrCode` icon, subtitle *"Share the app with a QR code"*, trailing chevron), styled
like the other settings cards. Tapping it opens **`ShareDeviceSheet`**.

## 2. `ShareDeviceSheet.jsx`

Bottom sheet (same overlay pattern as `DefaultRuleSheet`/`DeviceEditSheet`: `fixed inset-0 z-50
flex items-end`, `bg-slate-900/45` scrim, `rounded-t-2xl` panel). Contents:

- Title **"Add another device"** + a **Close** (X) button.
- A **QR code** of the app URL, rendered client-side as inline SVG (`<QRCodeSVG value={url} .../>`
  from `qrcode.react`) — no external service, works offline.
- The **URL** shown as selectable text, with a **"Copy link"** button
  (`navigator.clipboard.writeText(url)` → success toast *"Link copied"*).
- A **"Share…"** button that calls `navigator.share({ title, text, url })` — **rendered only when
  `navigator.share` exists** (progressive enhancement). A user-cancel (`AbortError`) is swallowed
  silently; other errors toast.
- One line of explanatory copy: *"Scan on the new phone to open the app, then follow the prompts to
  sign in. No token or account data is shared here."*

The URL is `buildShareUrl(window.location.origin)` (§3), so the QR/link always reflect the real
host the app is served from.

## 3. Pure logic (TDD'd, `src/lib/shareDevice.js`)

- **`buildShareUrl(origin)`** → a clean app URL string.
  - Trim; strip a single trailing `/`; return `''` for empty/nullish input.
  - Tests: `'https://controld-mobile.pages.dev'` → unchanged; `'https://x.pages.dev/'` → trailing
    slash stripped; `''`/`null`/`undefined` → `''`.
  (Small, but gives a tested seam and keeps the component free of string-fiddling.)

## 4. Components, deps & files

- **`src/lib/shareDevice.js`** + `shareDevice.test.js` (the pure fn above).
- **`src/components/ShareDeviceSheet.jsx`** (new): the sheet in §2. Props `{ onClose }`; computes
  `url = buildShareUrl(window.location.origin)` internally.
- **`src/components/Settings.jsx`** (modify): add the "Add another device" row + `shareOpen` state;
  render `<ShareDeviceSheet onClose={...}/>` when open. Uses `useToast` for the copy/share toasts.
- **Dependency:** add **`qrcode.react`** (client-side QR, renders `QRCodeSVG` — zero external
  calls). One new runtime dep; consistent with the app's self-contained/telemetry-free stance.

## 5. Security / validation

- The QR/link contains **only** `window.location.origin` — a public URL, no token, no PII.
- QR generated **locally** (bundled lib) — the URL is never sent to any third-party QR service.
- No user free-text input feeds anything (the URL is derived, not typed), so no injection surface
  here; copy/share operate on the derived URL only. (Consistent with [[feedback_input_validation]] —
  there simply is no untrusted input in this feature.)

## 6. Testing

- **TDD** `buildShareUrl` (`shareDevice.test.js`): normalization + empty cases above.
- **Component test** (`ShareDeviceSheet.test.jsx`, jsdom):
  - renders a QR (`<svg>` present) and the URL text;
  - **Copy link** calls `navigator.clipboard.writeText` with the URL (mock clipboard);
  - **Share** button is **absent** when `navigator.share` is undefined, and **present + calls
    `navigator.share`** when it's mocked in.
- **Live Playwright pass:** Settings → "Add another device" → sheet shows the QR + URL; Copy link
  works (assert clipboard/toast). (Read-only — no account writes.)

## 7. Scope boundaries (YAGNI)

- **No token/secret in the QR or link** (the whole security premise).
- No receiving-side changes — the existing onboarding handles sign-in.
- No "copy my token" button, no cross-device token transfer, no expiring/one-time links (the app is
  serverless — can't track single-use without a backend).
- No custom QR styling/branding, no download-QR-as-image — just display, copy, share.
