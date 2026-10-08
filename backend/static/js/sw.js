// ════════════════════════════════════════════════════════════════════
// STAFF POS — APP SHELL SERVICE WORKER
// ════════════════════════════════════════════════════════════════════
// Scope: ONLY caches the static files that make up the Staff dashboard
// page shell (the HTML/CSS/JS, not any data). This lets an already-
// logged-in staff member reload the POS page and have it still load
// even with zero network connectivity, so the existing offline-POS
// queue in staff.js can take over from there.
//
// What this deliberately does NOT do:
//  - Cache or intercept any /api/* request, /login, /ping, or any POST —
//    those always go straight to the network, untouched.
//  - Enable a fresh login while offline — that still requires a real
//    round-trip to Flask + Supabase to check credentials. This only
//    helps a staff member who is already logged in (valid session
//    cookie) reload or reopen the page while offline.
//
// Served at /sw.js (not /static/js/sw.js) via a dedicated Flask route
// with a Service-Worker-Allowed header, so its scope covers the whole
// site rather than just /static/js/.

const CACHE_NAME = 'tefc-staff-shell-v1';

const SHELL_URLS = [
  '/staff/dashboard',
  '/static/css/admin.css',
  '/static/css/staff.css',
  '/static/js/staff.js',
  '/static/img/favicon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_URLS))
      .catch(() => {}) // don't fail install if e.g. favicon 404s
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only ever touch GET requests for the exact shell files above.
  // Everything else (all API calls, /ping, /login, POST requests,
  // images inside products, etc.) passes straight through untouched.
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (!SHELL_URLS.includes(url.pathname)) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        // Online: serve fresh, and refresh the cached copy in the background
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        return res;
      })
      .catch(() => caches.match(req)) // offline: fall back to the cached shell
  );
});