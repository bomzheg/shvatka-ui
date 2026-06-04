/*
 * Shvatka push service worker.
 *
 * Handles the native Web Push protocol for the backend whose payloads are flat
 * objects: { title, body, url?, tag?, data? }. It is intentionally tiny and has
 * no dependency on @angular/service-worker, so the regular Angular build is
 * untouched. The file is copied to the site root (/push-sw.js) by angular.json,
 * which gives it the "/" scope required to control the whole app.
 */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

function parsePayload(event) {
  if (!event.data) {
    return { title: 'Shvatka', body: '' };
  }
  try {
    return event.data.json();
  } catch (e) {
    return { title: 'Shvatka', body: event.data.text() };
  }
}

function resolveUrl(payload) {
  return payload.url || (payload.data && payload.data.url) || '/';
}

self.addEventListener('push', (event) => {
  const payload = parsePayload(event) || {};
  const title = payload.title || 'Shvatka';
  const url = resolveUrl(payload);

  const options = {
    body: payload.body || '',
    icon: '/assets/icons/web-app-manifest-192x192.png',
    badge: '/assets/icons/favicon-96x96.png',
    data: Object.assign({}, payload.data, { url }),
  };
  if (payload.tag) {
    options.tag = payload.tag;
    options.renotify = true;
  }

  const showNotification = self.registration.showNotification(title, options);

  // Let any open tab show an in-app toast for foreground messages.
  const notifyClients = self.clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then((clients) => {
      clients.forEach((client) => client.postMessage({ type: 'push', payload }));
    });

  event.waitUntil(Promise.all([showNotification, notifyClients]));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const url = data.url || '/';

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      for (const client of clients) {
        if ('focus' in client) {
          await client.focus();
          // Ask the running SPA to route in place instead of reloading.
          client.postMessage({ type: 'notificationclick', url });
          return;
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(url);
      }
    })(),
  );
});
