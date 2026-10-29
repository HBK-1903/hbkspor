// Offline app shell for the Vite build. Keep this version in sync with releases.
const CACHE_NAME = 'hbk-spor-source-v1';
const SHELL_ASSETS = [
  '/manifest.webmanifest',
  '/favicon.svg',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
];

async function precacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  const response = await fetch('/', { cache: 'reload' });
  if (!response.ok) throw new Error(`App shell request failed: ${response.status}`);

  const html = await response.clone().text();
  await cache.put('/', response.clone());
  await cache.put('/index.html', response.clone());

  // Vite emits content-hashed JS and CSS paths into index.html. Cache both so
  // the app can launch offline after its first successful online visit.
  const hashedAssets = [...html.matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/g)]
    .map((match) => match[1]);
  await cache.addAll([...new Set(hashedAssets)]);
  await Promise.allSettled(SHELL_ASSETS.map((url) => cache.add(url)));
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheAppShell().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith('hbk-spor-') && key !== CACHE_NAME)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put('/', response.clone());
          await cache.put('/index.html', response.clone());
        }
        return response;
      } catch {
        return (await caches.match(request))
          || (await caches.match('/index.html'))
          || new Response('Çevrimdışısın. HBK Spor’u çevrimiçi açtıktan sonra tekrar dene.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          });
      }
    })());
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    })());
  }
});
