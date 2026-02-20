/**
 * ControlD API CORS Proxy — Cloudflare Worker
 *
 * Deploy to Cloudflare Workers (free tier). This proxies requests from the
 * PWA to api.controld.com, adding the CORS headers the API doesn't include.
 *
 * Setup:
 *   1. wrangler deploy (or paste into Cloudflare dashboard)
 *   2. Set VITE_API_BASE_URL=https://your-worker.workers.dev in your
 *      Cloudflare Pages environment variables
 *
 * Optional: restrict allowed origins to your Pages domain only.
 */

const TARGET = 'https://api.controld.com';

// Set this to your Pages URL to lock down who can use the proxy.
// Leave as '*' for open access (fine for a personal tool).
const ALLOWED_ORIGIN = '*';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(request) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const targetUrl = TARGET + url.pathname + url.search;

    // Forward the request, stripping the Host header so CF doesn't block it
    const proxyRequest = new Request(targetUrl, {
      method: request.method,
      headers: request.headers,
      body: request.method !== 'GET' && request.method !== 'HEAD'
        ? request.body
        : undefined,
    });

    const response = await fetch(proxyRequest);

    // Clone response and inject CORS headers
    const proxied = new Response(response.body, response);
    Object.entries(CORS_HEADERS).forEach(([k, v]) =>
      proxied.headers.set(k, v)
    );

    return proxied;
  },
};
