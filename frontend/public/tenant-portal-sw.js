const CACHE_NAME = 'ubumwe-tenant-portal-v7';
const APP_SHELL = [
  '/',
  '/tenant-portal',
  '/tenant-portal/payments',
  '/tenant-portal/upload',
  '/tenant-portal/maintenance',
  '/tenant-portal/messages',
  '/tenant-portal/announcements',
  '/tenant-portal/profile',
  '/samm-192.png',
  '/samm-512.png',
  '/apple-touch-icon.png',
  '/samm.svg',
  '/tenant-portal.webmanifest'
];

const isApiRequest = (url) => url.pathname.startsWith('/api') || url.pathname.startsWith('/uploads');
const isNavigationRequest = (request) => request.mode === 'navigate';
const isStaticAsset = (url) => url.pathname.startsWith('/assets/') || url.pathname.endsWith('.svg') || url.pathname.endsWith('.ico') || url.pathname.endsWith('.webmanifest');

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || isApiRequest(url)) return;

  if (isNavigationRequest(event.request)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/tenant-portal', copy));
          return response;
        })
        .catch(() => caches.match('/tenant-portal').then((response) => response || caches.match('/')))
    );
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(event.request)
        .then((cached) => cached || fetch(event.request).then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        }))
    );
  }
});

// ─── Web Push: show notification even when PWA is closed ──────────────────────
self.addEventListener('push', (event) => {
  let data = { title: 'UBUMWE HOUSE LTD', body: 'You have a new message.', url: '/tenant-portal/messages' };

  try {
    if (event.data) {
      data = { ...data, ...JSON.parse(event.data.text()) };
    }
  } catch (_) {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/samm-192.png',
      badge: '/samm-192.png',
      tag: 'tp-admin-message',
      renotify: true,
      data: { url: data.url }
    })
  );
});

// ─── Notification click: focus or open the messages page ──────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/tenant-portal/messages';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/tenant-portal') && 'focus' in client) {
          client.focus();
          client.navigate(targetUrl);
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
