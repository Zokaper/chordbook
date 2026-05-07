const CACHE_NAME = 'chordbook-v1778150658314';
const CACHED_URLS = [
  "/chordbook/",
  "/chordbook/_expo/static/css/native-tabs.module-1c34c93ae030da6223919552702a4e39.css",
  "/chordbook/_expo/static/js/web/entry-4f118db8b61ef8ef8aef79031013acea.js",
  "/chordbook/assets/icon.png",
  "/chordbook/index.html",
  "/chordbook/manifest.json",
  "/chordbook/metadata.json"
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CACHED_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  // Only handle same-origin requests under our scope
  if (url.origin !== location.origin) return;
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      });
    }).catch(() => caches.match('/chordbook/'))
  );
});