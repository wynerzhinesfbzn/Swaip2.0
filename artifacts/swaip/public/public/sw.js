const CACHE = 'swaip-v9';
const OFFLINE_URLS = ['/'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(OFFLINE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('/api/')) return;

  /* HTML-страницы (index.html и SPA-роуты) — всегда с сети */
  const url = new URL(e.request.url);
  const isHtml = e.request.headers.get('accept')?.includes('text/html') ||
    url.pathname === '/' || !url.pathname.includes('.');
  if (isHtml) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' })
        .catch(() => caches.match('/') || caches.match(e.request))
    );
    return;
  }

  /* JS/CSS/assets — сеть с кэшем как fallback */
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request).then(r => r || caches.match('/')))
  );
});

/* ── Показать уведомление по команде от страницы ── */
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SHOW_BOOKING_NOTIFICATION') {
    const { title, body, tag } = e.data;
    self.registration.showNotification(title, {
      body,
      icon: '/swaip-logo.png',
      badge: '/swaip-logo.png',
      vibrate: [200, 100, 200, 100, 300],
      tag: tag || 'booking',
      renotify: true,
      requireInteraction: false,
    });
  }
});

/* ── Входящий Web Push ── */
self.addEventListener('push', e => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch { data = {}; }

  const title  = data.title  || 'SWAIP';
  const body   = data.body   || 'Новое сообщение';
  const tag    = data.tag    || 'swaip-push';
  const icon   = data.icon   || '/swaip-logo.png';
  const url    = data.url    || '/';

  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge:  '/swaip-logo.png',
      tag,
      renotify: true,
      requireInteraction: false,
      vibrate: [200, 100, 200],
      data: { url },
    })
  );
});

/* ── Тап по уведомлению — открывает нужный экран ── */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) ? e.notification.data.url : '/';
  e.waitUntil(
    clients.matchAll({ type:'window', includeUncontrolled:true }).then(list => {
      for (const c of list) {
        if (c.url.includes(self.location.origin) && 'focus' in c) {
          c.focus();
          if (url !== '/') c.postMessage({ type: 'NAVIGATE', url });
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
