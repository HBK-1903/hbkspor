// 🏟️ HBK Spor — Offline-öncelikli Service Worker (v3 ailesi; build'de üretilir — scripts/build-sw.mjs)
const CACHE_NAME = 'hbk-spor-cache-v3-CGAXHvPf';
const SHELL_ASSETS = ['/manifest.webmanifest', '/favicon.svg', '/icon-192.png', '/icon-512.png', '/icon-maskable-512.png', '/apple-touch-icon.png'];
const BUILD_ASSETS = [
 "/assets/index-CGAXHvPf.js",
 "/assets/index-DnZOOWBL.css"
];

async function precache() {
  const cache = await caches.open(CACHE_NAME);
  const indexRes = await fetch('/', { cache: 'reload' });
  if (!indexRes.ok) throw new Error('index precache failed: ' + indexRes.status);
  await cache.put('/index.html', indexRes.clone());
  await cache.put('/', indexRes);
  await cache.addAll(BUILD_ASSETS.map((u) => new Request(u, { cache: 'reload' })));
  await Promise.allSettled(SHELL_ASSETS.map((u) => cache.add(new Request(u, { cache: 'reload' }))));
}
self.addEventListener('install', (e) => { e.waitUntil(precache()); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((k) => (k === CACHE_NAME ? undefined : caches.delete(k))))).then(() => self.clients.claim()));
});
self.addEventListener('message', (e) => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });
const OFFLINE_HTML = '<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HBK Spor — Çevrimdışı</title><body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#081311;color:#F4F0E6;font-family:system-ui,sans-serif;text-align:center;padding:24px"><div><div style="font-size:40px">⚽</div><h1 style="font-size:18px">Çevrimdışısın</h1><p style="color:#AEBDB5;font-size:14px;max-width:320px">HBK Spor henüz bu cihaza tam olarak indirilmemiş. İnternete bağlanıp uygulamayı bir kez aç; sonrasında tamamen çevrimdışı çalışır.</p><button onclick="location.reload()" style="margin-top:12px;padding:12px 20px;border-radius:12px;border:0;background:#B7E35A;color:#081311;font-weight:800">Yeniden Dene</button></div></body></html>';
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || !request.url.startsWith('http')) return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try { const net = await fetch(request); if (net && net.ok) { const c = await caches.open(CACHE_NAME); c.put('/index.html', net.clone()); } return net; }
      catch { const cached = (await caches.match('/index.html')) || (await caches.match('/')) || (await caches.match(request)); if (cached) return cached; return new Response(OFFLINE_HTML, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }); }
    })());
    return;
  }
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((res) => { if (res && res.status === 200) { const cl = res.clone(); caches.open(CACHE_NAME).then((c) => c.put(request, cl)); } return res; })));
    return;
  }
  event.respondWith(caches.match(request).then((cached) => {
    const net = fetch(request).then((res) => { if (res && res.status === 200) { const cl = res.clone(); caches.open(CACHE_NAME).then((c) => c.put(request, cl)); } return res; }).catch(() => cached || Response.error());
    return cached || net;
  }));
});
