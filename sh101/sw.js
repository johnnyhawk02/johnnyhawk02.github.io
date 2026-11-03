// Offline support (same approach as the 303 app): the page is fetched fresh when online, so updates arrive,
// and served from cache when not. Icons, manifest and fonts are cache-first. The cache name carries the version.
const CACHE = 'kestrel-0.9.4';
const CORE = ['./', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const req = e.request; if (req.method !== 'GET') return;
  if (req.mode === 'navigate') {
    // bypass the browser's HTTP cache (GitHub Pages sends max-age=600) so a new build shows up on the next launch
    e.respondWith(fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }).then((r) => {
      if (r.ok && !r.redirected) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put('./', copy)); }
      return r;
    }).catch(() => caches.match('./')));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => {
    if (r.ok || r.type === 'opaque') { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return r;
  })));
});
