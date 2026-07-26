const CACHE_NAME = 'fossil-viewer-v33';

const URLS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon.png',
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
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(URLS_TO_CACHE).catch((err) => {
        console.warn('Some assets failed to pre-cache:', err);
      });
      // Also explicitly cache the actual page URL the browser will request
      // when opening the app fresh, since that can differ in exact form
      // from the relative './' and './index.html' entries above.
      try {
        const pageResponse = await fetch('./index.html');
        await cache.put(self.registration.scope, pageResponse.clone());
      } catch (e) {
        console.warn('Could not pre-cache scope URL:', e);
      }
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
  const isNavigationRequest = event.request.mode === 'navigate';
  const isAppShell = isNavigationRequest || url.endsWith('/') || url.endsWith('index.html') || url.endsWith('manifest.json') || url.endsWith('sw.js');

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
      }).catch(async () => {
        // Offline — try an exact cache match first.
        const exactMatch = await caches.match(event.request);
        if (exactMatch) return exactMatch;

        // If that fails (e.g. the request URL doesn't byte-match how it
        // was originally cached — a known PWA gotcha with relative vs
        // absolute URLs), fall back directly to the cached index.html so
        // the app can still open offline instead of showing nothing.
        const indexFallback = await caches.match('./index.html') || await caches.match('index.html');
        if (indexFallback) return indexFallback;

        return new Response(
          'App is offline and the page was not found in cache. Please open the app once while online to enable offline use.',
          { status: 503, statusText: 'Offline', headers: { 'Content-Type': 'text/plain' } }
        );
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
