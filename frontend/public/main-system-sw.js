const CACHE_NAME = 'ubumwe-main-system-v10';

const APP_SHELL = [
  '/',
  '/login',
  '/dashboard',
  '/tenant-portal',
  '/main-system.webmanifest',
  '/tenant-portal.webmanifest',
  '/samm-192.png',
  '/samm-512.png',
  '/apple-touch-icon.png',
  '/samm.svg'
];

const isApiRequest = (url) => url.pathname.startsWith('/api') || url.pathname.startsWith('/uploads');
const isNavigationRequest = (request) => request.mode === 'navigate';
const isStaticAsset = (url) =>
  url.pathname.startsWith('/assets/') ||
  url.pathname.endsWith('.svg') ||
  url.pathname.endsWith('.ico') ||
  url.pathname.endsWith('.webmanifest') ||
  url.pathname.endsWith('.png') ||
  url.pathname.endsWith('.jpg') ||
  url.pathname.endsWith('.jpeg') ||
  url.pathname.endsWith('.css') ||
  url.pathname.endsWith('.js');

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
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
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/', copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((hit) => hit || caches.match('/') || caches.match('/login')))
    );
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (!response || !response.ok) return response;
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        });
      })
    );
  }
});

self.addEventListener('push', (event) => {
  let data = {
    title: 'UBUMWE System',
    body: 'You have a new update.',
    url: '/dashboard'
  };

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
      tag: 'ubumwe-system-notification',
      renotify: true,
      data: { url: data.url }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/dashboard';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
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
