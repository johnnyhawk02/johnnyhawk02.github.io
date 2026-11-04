// Shyoy moved to https://shyoy.pages.dev. This worker replaces the old offline one: it clears the old cache,
// stops serving anything, and unregisters itself so the redirect page always loads from the network.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const ks = await caches.keys();
    await Promise.all(ks.filter((k) => k.startsWith('kestrel-')).map((k) => caches.delete(k)));
    await self.registration.unregister();
    const cs = await self.clients.matchAll({ type: 'window' });
    cs.forEach((c) => c.navigate('https://shyoy.pages.dev/'));
  })());
});
