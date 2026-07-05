# Share / Add-a-Device Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Settings "Add another device" button that opens a sheet with a client-side QR code of the app URL (+ copy-link and native share) so a new phone can scan and land on the existing onboarding.

**Architecture:** A pure `buildShareUrl(origin)` normalizes `window.location.origin`; `ShareDeviceSheet` renders a `qrcode.react` `<QRCodeSVG>` of it plus Copy/Share; a Settings row opens the sheet. No API calls, no token/secret in the QR, no receiving-side changes.

**Tech Stack:** React 18, Vite 6, Vitest 3 + jsdom + @testing-library/react, Tailwind v4, lucide-react, **qrcode.react** (new dep).

## Global Constraints

- The QR/link carries **only** the app URL (`window.location.origin`) — **no token, no secret, no PII**.
- QR is generated **client-side** (`qrcode.react`) — the URL is never sent to any external QR service.
- **Share** button is progressive: rendered only when `typeof navigator.share === 'function'`; a user-cancel (`AbortError`) is swallowed silently.
- Reuse the bottom-sheet overlay pattern (`fixed inset-0 z-50 flex items-end` + `bg-slate-900/45` scrim + `rounded-t-2xl` panel) from `DefaultRuleSheet.jsx`.
- No receiving-side/onboarding changes — out of scope.

---

### Task 1: Pure logic — `src/lib/shareDevice.js`

**Files:**
- Create: `src/lib/shareDevice.js`
- Test: `src/lib/shareDevice.test.js`

**Interfaces:**
- Produces: `buildShareUrl(origin) → string` (clean app URL; `''` for empty/nullish).

- [ ] **Step 1: Write the failing test**

Create `src/lib/shareDevice.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { buildShareUrl } from './shareDevice';

describe('buildShareUrl', () => {
  it('returns a normal origin unchanged', () => {
    expect(buildShareUrl('https://controld-mobile.pages.dev')).toBe('https://controld-mobile.pages.dev');
  });
  it('strips trailing slash(es)', () => {
    expect(buildShareUrl('https://x.pages.dev/')).toBe('https://x.pages.dev');
    expect(buildShareUrl('https://x.pages.dev///')).toBe('https://x.pages.dev');
  });
  it('trims whitespace', () => {
    expect(buildShareUrl('  https://x.pages.dev  ')).toBe('https://x.pages.dev');
  });
  it('returns empty string for empty/nullish', () => {
    expect(buildShareUrl('')).toBe('');
    expect(buildShareUrl(null)).toBe('');
    expect(buildShareUrl(undefined)).toBe('');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/shareDevice.test.js`
Expected: FAIL — cannot resolve `./shareDevice`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/shareDevice.js`:

```js
// Normalise the app's origin into a clean shareable URL for the "Add another
// device" QR/link. Strips trailing slashes and whitespace; empty/nullish → ''.
export function buildShareUrl(origin) {
  const s = String(origin ?? '').trim();
  if (!s) return '';
  return s.replace(/\/+$/, '');
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/shareDevice.test.js`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/shareDevice.js src/lib/shareDevice.test.js
git commit -m "feat(share): buildShareUrl helper + tests"
```

---

### Task 2: `ShareDeviceSheet` + `qrcode.react` dep + Settings wiring

**Files:**
- Modify: `package.json` / `package-lock.json` (add `qrcode.react`)
- Create: `src/components/ShareDeviceSheet.jsx`
- Test: `src/components/ShareDeviceSheet.test.jsx`
- Modify: `src/components/Settings.jsx` (add the "Add another device" row + sheet state)

**Interfaces:**
- Consumes: `buildShareUrl` from `../lib/shareDevice` (Task 1); `QRCodeSVG` from `qrcode.react`; `useToast`.
- Produces: `default export ShareDeviceSheet({ onClose })`.

- [ ] **Step 1: Install the QR dependency**

Run: `npm install qrcode.react`
Expected: `qrcode.react` added to `dependencies`, lockfile updated. (Exports `QRCodeSVG`.)

- [ ] **Step 2: Write the failing component tests**

Create `src/components/ShareDeviceSheet.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ToastProvider } from '../context/ToastContext';
import { buildShareUrl } from '../lib/shareDevice';
import ShareDeviceSheet from './ShareDeviceSheet';

const APP_URL = buildShareUrl(window.location.origin); // jsdom origin (e.g. http://localhost:3000)

function renderSheet() {
  render(<ToastProvider><ShareDeviceSheet onClose={() => {}} /></ToastProvider>);
}

describe('ShareDeviceSheet', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn(async () => {}) }, configurable: true,
    });
    // ensure Share is unavailable by default
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
  });
  afterEach(() => {
    delete navigator.share;
  });

  it('renders a QR code and the app URL', () => {
    renderSheet();
    expect(document.querySelector('svg')).toBeTruthy();        // QRCodeSVG renders an <svg>
    expect(screen.getByText(APP_URL)).toBeInTheDocument();
  });

  it('Copy link writes the URL to the clipboard', async () => {
    renderSheet();
    fireEvent.click(screen.getByText('Copy link'));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(APP_URL));
  });

  it('hides Share when navigator.share is unavailable', () => {
    renderSheet();
    expect(screen.queryByText('Share…')).toBeNull();
  });

  it('shows Share and calls navigator.share when available', async () => {
    const shareFn = vi.fn(async () => {});
    Object.defineProperty(navigator, 'share', { value: shareFn, configurable: true });
    renderSheet();
    fireEvent.click(screen.getByText('Share…'));
    await waitFor(() => expect(shareFn).toHaveBeenCalled());
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/components/ShareDeviceSheet.test.jsx`
Expected: FAIL — cannot resolve `./ShareDeviceSheet`.

- [ ] **Step 4: Write the component**

Create `src/components/ShareDeviceSheet.jsx`:

```jsx
import { X, Copy, Share2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useToast } from '../context/ToastContext';
import { buildShareUrl } from '../lib/shareDevice';

export default function ShareDeviceSheet({ onClose }) {
  const toast = useToast();
  const url = buildShareUrl(window.location.origin);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      toast('Link copied', 'success');
    } catch {
      toast('Could not copy link', 'error');
    }
  }

  async function share() {
    try {
      await navigator.share({ title: 'ControlD Manager', text: 'Open ControlD Manager', url });
    } catch (err) {
      if (err && err.name === 'AbortError') return; // user cancelled — ignore
      toast('Could not share', 'error');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/45" />
      <div
        className="relative w-full bg-white dark:bg-slate-800 rounded-t-2xl p-4 pb-6 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">Add another device</h4>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 p-1"><X size={18} /></button>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          Scan on the new phone to open the app, then follow the prompts to sign in. No token or account data is shared here.
        </p>

        {/* QR on a white plate so it scans in dark mode too */}
        <div className="flex justify-center mb-4">
          <div className="bg-white p-3 rounded-xl border border-slate-200">
            <QRCodeSVG value={url} size={200} />
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 dark:text-slate-400 break-all mb-4">{url}</p>

        <div className="flex gap-2">
          <button
            onClick={copyLink}
            className="flex-1 flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-sm py-3 rounded-xl"
          >
            <Copy size={16} /> Copy link
          </button>
          {canShare && (
            <button
              onClick={share}
              className="flex-1 flex items-center justify-center gap-2 bg-green-500 text-white font-semibold text-sm py-3 rounded-xl"
            >
              <Share2 size={16} /> Share…
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/components/ShareDeviceSheet.test.jsx`
Expected: PASS (all 4 cases).

- [ ] **Step 6: Wire the row into Settings**

In `src/components/Settings.jsx`:

1. Update the top imports:

```jsx
import { useState } from 'react';
import { Sun, Moon, LogOut, User, Info, QrCode, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import ShareDeviceSheet from './ShareDeviceSheet';
```

2. Add sheet state at the top of the component body (next to the existing hooks):

```jsx
  const [shareOpen, setShareOpen] = useState(false);
```

3. Insert this button **immediately before** the `{/* Logout */}` button:

```jsx
      {/* Add another device */}
      <button
        onClick={() => setShareOpen(true)}
        className="w-full flex items-center gap-3 bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/50 px-4 py-4 text-left"
      >
        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
          <QrCode size={20} className="text-slate-500 dark:text-slate-300" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-slate-800 dark:text-slate-200">Add another device</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Share the app with a QR code</p>
        </div>
        <ChevronRight size={18} className="text-slate-400 shrink-0" />
      </button>
```

4. Render the sheet **just before the closing `</div>`** of the returned root element:

```jsx
      {shareOpen && <ShareDeviceSheet onClose={() => setShareOpen(false)} />}
```

- [ ] **Step 7: Run the full suite + build**

Run: `npm test`
Expected: PASS — prior 131 tests + Task 1 (buildShareUrl) + Task 2 (ShareDeviceSheet), all green.

Run: `npm run build`
Expected: build succeeds (bundle now includes `qrcode.react`).

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/components/ShareDeviceSheet.jsx src/components/ShareDeviceSheet.test.jsx src/components/Settings.jsx
git commit -m "feat(share): Add-another-device QR sheet + Settings entry"
```

---

## Post-implementation: live verification (controller, after merge)

Not a subagent task — after merge, via Playwright (read-only, no account writes):

1. Open **Settings** → tap **"Add another device"** → the sheet shows a **QR code** + the app URL.
2. **Copy link** → confirm the success toast (and, if practical, that the clipboard holds the URL).
3. If the browser supports it, confirm the **Share…** button appears; otherwise confirm it's hidden.

## Notes for the implementer

- **No token/secret** anywhere in this feature — the QR/link is only `window.location.origin`.
- The QR must render on a **white background** (already in the markup) so it scans in dark mode.
- Do not add receiving-side/onboarding logic — the new phone uses the existing flow.
- The `.claude/worktrees/**` vitest exclude is already in `vite.config.js`; run `npm test` from the repo root.
