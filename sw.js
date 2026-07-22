const CACHE_NAME = 'fossil-viewer-v26';

const URLS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  'https://unpkg.com/three@0.160.0/build/three.module.js',
  'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js',
  'https://unpkg.com/three@0.160.0/examples/jsm/loaders/STLLoader.js',
  'https://unpkg.com/three@0.160.0/examples/jsm/loaders/OBJLoader.js',
  'https://unpkg.com/three@0.160.0/examples/jsm/loaders/PLYLoader.js',
  'https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(URLS_TO_CACHE).catch((err) => {
        console.warn('Some assets failed to pre-cache:', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  const isAppShell = url.endsWith('/') || url.endsWith('index.html') || url.endsWith('manifest.json') || url.endsWith('sw.js');

  if (isAppShell) {
    // Network-first for the app's own files, so updates always take effect
    // immediately instead of being stuck behind an old cached copy.
    event.respondWith(
      fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      }).catch(() => {
        // Offline — fall back to whatever was last cached
        return caches.match(event.request);
      })
    );
    return;
  }

  // Cache-first for large static libraries (Three.js etc.) that never change per-version
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      }).catch(() => {
        return new Response('Offline and resource not cached.', {
          status: 503,
          statusText: 'Offline'
        });
      });
    })
  );
});
