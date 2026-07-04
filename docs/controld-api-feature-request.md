# Feature request / API gap: expose the Activity Log (`/queries`) to API tokens

**To:** ControlD support / API team
**From:** API user (account `controld.67jmp@passmail.com`)
**Type:** API feature request (with a likely permissions bug)

## Summary

The REST API tokens (both **Read-only** and **Read/Write**) cannot access the query-log /
activity endpoints. This blocks any API-driven tooling that wants to surface DNS activity —
for example, a self-hosted mobile client that lets a user review what a device is doing and
act on it.

## What I observed

Using standard API tokens against `https://api.controld.com`:

| Endpoint | Read-only token | Read/Write token |
|----------|-----------------|------------------|
| `GET /queries` | `403 "This read-only token does not have access to this endpoint"` | `403 "This token does not have access to this endpoint"` |
| `GET /analytics`, `/analytics/records` | `404 Not implemented` | — |
| `GET /devices` | ✅ works | ✅ works |

So `/queries` clearly exists (it returns 403, not 404), but **no API token — not even Read/Write —
can reach it**. It appears gated behind the web-dashboard session only. Device objects (`GET /devices`)
also don't carry query counts — the `stats` field is a single scalar, not activity data.

## Why it matters (use case)

I'm building a small personal PWA to manage my ControlD account from my phone. A high-value
workflow is the **default-deny allowlist**: set a profile's Default Rule to **Block**, then
allow only the domains a device legitimately needs. To do that safely you have to *observe*
what the device queries (and what got blocked), then promote the legitimate domains to Bypass
rules. That "review the activity log → one-tap allow" loop is impossible through the API today,
because the activity log isn't reachable with an API token.

## The ask

1. **Expose read access to the Activity Log via API tokens** — ideally under a scoped permission
   (e.g. a token capability like `logs:read`) so it can be granted deliberately. Even the
   Read/Write token being able to `GET /queries` would unblock this.
2. Document the `/queries` request/response shape (filters: by device/endpoint, time range,
   verdict = blocked/allowed/redirected; pagination).
3. If this is intended to stay dashboard-only, please **return a clearer error** (e.g. 403 with
   "activity log is not available to API tokens") and note it in the API reference, so integrators
   don't assume it's a bug.

Thanks — the API is otherwise excellent to work with; this is the one gap stopping a genuinely
useful workflow.
