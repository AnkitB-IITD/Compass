/* ============================================================
   sw.js — Offline-first service worker.
   Precache the shell; cache-first for same-origin GETs; network
   passthrough for everything else (notably api.anthropic.com).
   Bump VERSION on every deploy to refresh caches.
   ============================================================ */

const VERSION = 'compass-v4';

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './styles/main.css',
  './src/app.js',
  './src/router.js',
  './src/db.js',
  './src/ui.js',
  './src/voice.js',
  './src/checkin.js',
  './src/ai.js',
  './src/emotions.js',
  './src/views/home.js',
  './src/views/journal.js',
  './src/views/checkin-view.js',
  './src/views/goals.js',
  './src/views/insights.js',
  './src/views/onboarding.js',
  './src/views/settings.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // API calls etc. go straight to the network

  event.respondWith(
    caches.match(request, { ignoreSearch: request.mode === 'navigate' }).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((cache) => cache.put(request, copy));
        }
        return res;
      }).catch(() => {
        // Offline navigation falls back to the app shell
        if (request.mode === 'navigate') return caches.match('./index.html');
        throw new Error('offline');
      });
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) { client.navigate('#/checkin'); return client.focus(); }
      }
      return self.clients.openWindow('./#/checkin');
    }),
  );
});
