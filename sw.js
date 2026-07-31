const CACHE_NAME = 'boost-yourself-v1';

const ASSETS = [
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

// Install
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).catch(() => {})
  );

  self.skipWaiting();
});

// Activate
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );

  self.clients.claim();
});

// Fetch
self.addEventListener('fetch', (e) => {

  if (e.request.method !== 'GET') return;

  e.respondWith(
    caches.match(e.request).then((cached) => {

      if (cached) return cached;

      return fetch(e.request)
        .then((response) => {

          const clone = response.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, clone);
          });

          return response;

        })
        .catch(() => {
          return cached || caches.match('./index.html');
        });

    })
  );

});

// Message
self.addEventListener('message', (e) => {

  if (e.data && e.data.type === 'SHOW_NOTIFICATION') {
    self.registration.showNotification(
      e.data.title,
      e.data.options
    );
  }

});

// Push Notification
self.addEventListener('push', (e) => {

  let data = {};

  try {

    data = e.data ? e.data.json() : {};

  } catch {

    data = {
      title: 'Boost Yourself',
      body: e.data ? e.data.text() : ''
    };

  }

  const title = data.title || 'Boost Yourself';

  const options = {

    body: data.body || '',

    icon: './icons/icon-192.png',

    badge: './icons/icon-192.png',

    data: data.url ? { url: data.url } : {}

  };

  e.waitUntil(
    self.registration.showNotification(title, options)
  );

});

// Notification Click
self.addEventListener('notificationclick', (e) => {

  e.notification.close();

  e.waitUntil(

    clients.matchAll({

      type: 'window',

      includeUncontrolled: true

    }).then((clientList) => {

      for (const client of clientList) {

        if ('focus' in client)
          return client.focus();

      }

      if (clients.openWindow)
        return clients.openWindow('./index.html');

    })

  );

});