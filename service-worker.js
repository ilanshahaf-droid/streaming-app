const CACHE_NAME = 'mah-yesh-litzfot-v2';
const SHELL_FILES = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
];

// Files that rarely change — safe to cache-first.
const STATIC_ASSETS = ['icon-192.png', 'icon-512.png', 'icon-512-maskable.png', 'manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
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
  const url = new URL(event.request.url);

  // Never cache TMDB or Supabase calls — always go live so subscriptions,
  // search results, availability, and sync data stay current.
  if (url.hostname.includes('themoviedb.org') || url.hostname.includes('tmdb.org')
      || url.hostname.includes('supabase.co') || url.hostname.includes('jsdelivr.net')) {
    return; // let the browser handle it normally
  }

  const isStaticAsset = STATIC_ASSETS.some((f) => url.pathname.endsWith(f));

  if (isStaticAsset) {
    // Rarely-changing assets: cache-first for speed.
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return cached || fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // HTML/app shell: network-first, so every deploy shows up immediately.
  // Falls back to the cached copy only when there's no network (offline).
  event.respondWith(
    fetch(event.request).then((response) => {
      if (response.ok && event.request.method === 'GET') {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
      }
      return response;
    }).catch(() => caches.match(event.request))
  );
});
