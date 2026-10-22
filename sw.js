// Service worker for the PHFR SOP & EMS Reference Hub.
// Cache-first for the app shell; bump CACHE_VERSION when shipping updates.
const CACHE_VERSION = 'phfr-hub-v7';
const APP_SHELL = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  './firebase-config.js',
  './assets/dept-logo.png',
  './assets/ems-logo.png',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  // Only handle same-origin requests; let CDN traffic pass through.
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
        return resp;
      }).catch(() => {
        // Offline fallback: serve the app shell for navigations.
        if (req.mode === 'navigate') return caches.match('./index.html');
        return new Response('Offline', { status: 503 });
      });
    })
  );
});
