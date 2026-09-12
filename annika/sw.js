/* Annika Timer 2.0 — service worker
   version = "20260912-143000"
   Bump CACHE_VERSION whenever index.html, styles.css or app.js change. */

const CACHE_VERSION = 'annika-timer-v20260912-143000';
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './logo.png',
  './favicon.ico'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function (cache) {
      // addAll fails as a unit, so each shell file is added on its own to
      // keep one missing asset from breaking the whole install.
      return Promise.all(SHELL.map(function (url) {
        return cache.add(new Request(url, { cache: 'reload' })).catch(function () {});
      }));
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        return key === CACHE_VERSION ? null : caches.delete(key);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Voice files never change: serve from cache, fill the cache on first use.
  if (url.pathname.indexOf('/audio-numbers/') !== -1) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Everything else: fresh when online, cached copy when not.
  event.respondWith(networkFirst(request));
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response && response.ok) cache.put(request, response.clone());
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const hit = await cache.match(request);
    if (hit) return hit;
    if (request.mode === 'navigate') {
      const shell = await cache.match('./index.html');
      if (shell) return shell;
    }
    throw err;
  }
}
