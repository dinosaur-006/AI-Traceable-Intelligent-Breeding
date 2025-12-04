const CACHE_NAME = 'ai-zhiyang-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/main.js',
  '/assessment.html',
  '/recommend.html',
  '/advisor.html',
  '/account.html',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
    ))
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/')) return;
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(event.request).then((cached) => {
        const network = fetch(event.request).then((resp) => {
          if (resp.ok) cache.put(event.request, resp.clone());
          return resp;
        }).catch(() => undefined);
        if (cached) return cached;
        return network || (event.request.destination === 'document' ? cache.match('/index.html') : undefined);
      })
    )
  );
});
