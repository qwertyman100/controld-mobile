# ControlD feature request — paste-ready

**Where to submit (pick one, you'll need to be logged in):**
- **feedback.controld.com** — the feature-request board (recommended; gets upvotes/visibility)
- docs.controld.com/discuss — community "Discussions" board (Feature Request category)
- controld.com/contact-support — email/ticket (fallback)

Paste the **Title** into the title field and the **Body** into the description.

---

## Title

Expose the Activity Log (`/queries`) to API tokens (scoped permission)

## Body

**Summary:** The REST API tokens — both **Read-only** and **Read/Write** — can't access the
query-log / activity endpoints. This blocks any API-driven tooling that wants to surface DNS
activity and act on it (e.g. a self-hosted mobile client). Please expose the activity log to a
scoped API-token permission.

**What I observed** (standard API tokens against `https://api.controld.com`):

| Endpoint | Read-only token | Read/Write token |
|---|---|---|
| `GET /queries` | `403 "This read-only token does not have access to this endpoint"` | `403 "This token does not have access to this endpoint"` |
| `GET /analytics`, `/analytics/records` | `404 Not implemented` | — |
| `GET /devices` | ✅ works | ✅ works |

So `/queries` clearly exists (403, not 404), but **no API token — not even Read/Write — can
reach it**; it appears to be dashboard-session-only. Device objects (`GET /devices`) also don't
carry query counts (the `stats` field is a single scalar, not activity data).

**Why it matters (use case):** I'm building a small personal PWA to manage my ControlD account
from my phone. A high-value workflow is the **default-deny allowlist**: set a profile's Default
Rule to **Block**, then allow only the domains a device legitimately needs. Doing that safely
means *observing* what a device queries (and what got blocked), then promoting the legitimate
domains to Bypass rules — a "review the activity log → one-tap allow" loop. That's impossible
through the API today because the activity log isn't reachable with an API token.

**The ask:**
1. **Expose read access to the Activity Log via API tokens**, ideally under a scoped capability
   (e.g. `logs:read`) so it can be granted deliberately. Even letting the Read/Write token
   `GET /queries` would unblock this.
2. **Document the `/queries` request/response shape** — filters (by device/endpoint, time range,
   verdict = blocked/allowed/redirected) and pagination.
3. If it's intended to stay dashboard-only, please return a **clearer error** (e.g. "activity log
   is not available to API tokens") and note it in the API reference so integrators don't read
   the 403 as a bug.

Thanks — the API is otherwise great to work with; this is the one gap stopping a genuinely useful
workflow.
