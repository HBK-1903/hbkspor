// Offline app shell and Web Push delivery handler.
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
  const hashedAssets = [...html.matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/g)].map((match) => match[1]);
  await cache.addAll([...new Set(hashedAssets)]);
  await Promise.allSettled(SHELL_ASSETS.map((url) => cache.add(url)));
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheAppShell().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('hbk-spor-') && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('push', (event) => {
  let message = { title: 'HBK Spor', body: 'Planlı antrenman hatırlatıcın var.', tag: 'hbk-spor-push', url: '/' };
  try { if (event.data) message = { ...message, ...event.data.json() }; } catch { if (event.data) message.body = event.data.text(); }
  event.waitUntil(self.registration.showNotification(message.title, {
    body: message.body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: message.tag,
    data: { url: typeof message.url === 'string' && message.url.startsWith('/') ? message.url : '/' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    const existing = clients.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) { void existing.navigate(target); return existing.focus(); }
    return self.clients.openWindow(target);
  }));
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
        return (await caches.match(request)) || (await caches.match('/index.html'))
          || new Response('Çevrimdışısın. HBK Spor’u çevrimiçi açtıktan sonra tekrar dene.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
    })());
    return;
  }
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) { const cache = await caches.open(CACHE_NAME); await cache.put(request, response.clone()); }
      return response;
    })());
  }
});
