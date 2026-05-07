const CACHE_NAME = 'vedafacil-medidor-v21';
const CACHE_FILES = [
  './index.html',
  './sw.js',
  './manifest.json'
];

// Install: cache all app files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(CACHE_FILES);
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: serve from cache, fallback to network
self.addEventListener('fetch', event => {
  // Não interceptar POST/não-GET — deixar ir direto para a rede
  // (interceptar POST causa hang permanente quando o servidor falha)
  if (event.request.method !== 'GET') return;

  // Não interceptar requisições cross-origin (ex: webhook do servidor)
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        throw new Error('offline');
      });
    })
  );
});

// Força ativação imediata quando app manda SKIP_WAITING
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// Background sync: retry pending measurements
self.addEventListener('sync', event => {
  if (event.tag === 'sync-measurements') {
    event.waitUntil(
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'SYNC_MEASUREMENTS' });
        });
      })
    );
  }
});
