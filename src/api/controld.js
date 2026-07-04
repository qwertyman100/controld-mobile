/**
 * Control D API client.
 *
 * Base URL resolution:
 *   - Development: /api  →  Vite proxies to https://api.controld.com
 *   - Production:  VITE_API_BASE_URL env var (Cloudflare Worker URL)
 */
const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

async function request(token, method, path, body, opts = {}) {
  const options = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  if (body !== undefined && method !== 'GET') {
    if (opts.json) {
      // Endpoints whose body contains an array of objects (batch filters) can't
      // survive form-encoding — String([{…}]) becomes "[object Object]". Send JSON.
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    } else {
      // Control D API accepts form-encoded bodies for scalar mutations
      options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      options.body = new URLSearchParams(
        Object.fromEntries(
          Object.entries(body)
            .filter(([, v]) => v !== undefined && v !== null)
            .map(([k, v]) => [k, String(v)])
        )
      ).toString();
    }
  }

  const res = await fetch(`${BASE_URL}${path}`, options);

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Server error (HTTP ${res.status}) — please try again`);
  }

  if (!data.success) {
    throw new Error(data.error?.message || `Request failed (${res.status})`);
  }

  return data.body;
}

// ---------------------------------------------------------------------------
// Helper: normalize array responses that might be wrapped in an object
// The API sometimes returns { rules: [...] } and sometimes [...] directly.
// ---------------------------------------------------------------------------
function toArray(value, ...keys) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') {
    for (const key of keys) {
      if (Array.isArray(value[key])) return value[key];
    }
    // If there's only one array-valued key, return that
    const arrays = Object.values(value).filter(Array.isArray);
    if (arrays.length === 1) return arrays[0];
  }
  return [];
}

// ---------------------------------------------------------------------------
// API methods
// ---------------------------------------------------------------------------
export const api = {
  // Auth / account
  getUser: (token) => request(token, 'GET', '/users'),

  // Profiles
  getProfiles: (token) => request(token, 'GET', '/profiles'),

  // Custom rules
  getRules: (token, profileId, folderId) =>
    request(
      token,
      'GET',
      `/profiles/${encodeURIComponent(profileId)}/rules${folderId ? `/${encodeURIComponent(folderId)}` : ''}`
    ),

  createRule: (token, profileId, payload) =>
    request(token, 'POST', `/profiles/${encodeURIComponent(profileId)}/rules`, payload),

  // PUT requires the target in the body as hostnames[] (array), same as POST —
  // a singular `hostname` is rejected with 400 code 40003. Callers pass the
  // literal 'hostnames[]' key so the form-encoder emits hostnames[]=<domain>.
  updateRule: (token, profileId, payload) =>
    request(token, 'PUT', `/profiles/${encodeURIComponent(profileId)}/rules`, payload),

  deleteRule: (token, profileId, hostname) =>
    request(
      token,
      'DELETE',
      `/profiles/${encodeURIComponent(profileId)}/rules/${encodeURIComponent(hostname)}`
    ),

  // Rule groups/folders
  getGroups: (token, profileId) =>
    request(token, 'GET', `/profiles/${encodeURIComponent(profileId)}/groups`),

  // Filters
  getFilters: (token, profileId) =>
    request(token, 'GET', `/profiles/${encodeURIComponent(profileId)}/filters`),

  getExternalFilters: (token, profileId) =>
    request(token, 'GET', `/profiles/${encodeURIComponent(profileId)}/filters/external`),

  toggleFilter: (token, profileId, filterId, status) =>
    request(
      token,
      'PUT',
      `/profiles/${encodeURIComponent(profileId)}/filters/filter/${encodeURIComponent(filterId)}`,
      { status }
    ),

  // Batch enable/disable multiple filters (used for filter levels).
  // JSON body: the filters array-of-objects can't be form-encoded (verified live).
  batchFilters: (token, profileId, filters) =>
    request(token, 'PUT', `/profiles/${encodeURIComponent(profileId)}/filters`, { filters }, { json: true }),

  // Set a profile option (e.g. ai_malware for Malware Strict)
  setOption: (token, profileId, name, payload) =>
    request(
      token,
      'PUT',
      `/profiles/${encodeURIComponent(profileId)}/options/${encodeURIComponent(name)}`,
      payload
    ),

  // Default rule (catch-all "da"). Undocumented endpoint, verified live:
  // PUT /profiles/{id}/default with form { do, status, via? }. Redirect (do:3)
  // requires a via (location PK); do:3 with no via is rejected 400.
  setDefaultRule: (token, profileId, payload) =>
    request(token, 'PUT', `/profiles/${encodeURIComponent(profileId)}/default`, payload),

  // Proxies (for redirect rules)
  getProxies: (token) => request(token, 'GET', '/proxies'),

  // Services (Phase 2)
  getServices: (token, profileId) =>
    request(token, 'GET', `/profiles/${encodeURIComponent(profileId)}/services`),

  updateService: (token, profileId, serviceId, payload) =>
    request(
      token,
      'PUT',
      `/profiles/${encodeURIComponent(profileId)}/services/${encodeURIComponent(serviceId)}`,
      payload
    ),

  // "Remove" a service = hard delete the record (not status:0), so the profile
  // doesn't accumulate inert disabled entries.
  deleteService: (token, profileId, serviceId) =>
    request(
      token,
      'DELETE',
      `/profiles/${encodeURIComponent(profileId)}/services/${encodeURIComponent(serviceId)}`
    ),

  // Services catalog (global, not per-profile)
  getServiceCategories: (token) => request(token, 'GET', '/services/categories'),

  getServiceCategory: (token, category) =>
    request(token, 'GET', `/services/categories/${encodeURIComponent(category)}`),

  // Devices (Phase 2)
  getDevices: (token) => request(token, 'GET', '/devices'),
};

// ---------------------------------------------------------------------------
// Domain extraction helper (used by clipboard banner)
// ---------------------------------------------------------------------------
// Requires a proper alphabetic TLD (e.g. .com, .net, .io) — rejects API
// tokens, UUIDs, and other strings that happen to contain dots.
const VALID_DOMAIN_RE =
  /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/;

export function extractDomain(text) {
  if (!text || text.length > 2000) return null;

  const trimmed = text.trim();

  try {
    let url = trimmed;
    if (!url.match(/^https?:\/\//i)) url = 'https://' + url;
    const parsed = new URL(url);
    let domain = parsed.hostname.toLowerCase();
    if (domain.startsWith('www.')) domain = domain.slice(4);
    if (VALID_DOMAIN_RE.test(domain)) return domain;
  } catch {
    // Fall through to bare-domain check
  }

  const bare = trimmed.toLowerCase();
  if (VALID_DOMAIN_RE.test(bare)) return bare;

  return null;
}

// ---------------------------------------------------------------------------
// Rule action constants — from API docs:
//   0 = BLOCK, 1 = BYPASS, 2 = SPOOF, 3 = REDIRECT
// ---------------------------------------------------------------------------
export const RULE_ACTION = {
  BLOCK: 0,
  BYPASS: 1,
  SPOOF: 2,
  REDIRECT: 3,
};

export const RULE_ACTION_LABEL = {
  [RULE_ACTION.BLOCK]: 'Block',
  [RULE_ACTION.BYPASS]: 'Bypass',
  [RULE_ACTION.SPOOF]: 'Spoof',
  [RULE_ACTION.REDIRECT]: 'Redirect',
};

export const RULE_STATUS = {
  DISABLED: 0,
  ENABLED: 1,
};

export { toArray };
