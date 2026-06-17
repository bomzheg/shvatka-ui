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

// Service workers get killed between pushes, so the unread count is persisted
// in Cache Storage (no IndexedDB schema needed for a single number) instead of
// an in-memory variable.
const BADGE_CACHE = 'shvatka-badge-v1';
const BADGE_KEY = '/__badge-count__';

async function getBadgeCount() {
  if (!('caches' in self)) {
    return 0;
  }
  const cache = await caches.open(BADGE_CACHE);
  const cached = await cache.match(BADGE_KEY);
  const count = cached ? parseInt(await cached.text(), 10) : 0;
  return Number.isFinite(count) ? count : 0;
}

async function setBadgeCount(count) {
  if ('caches' in self) {
    const cache = await caches.open(BADGE_CACHE);
    await cache.put(BADGE_KEY, new Response(String(count)));
  }
  if (self.navigator && 'setAppBadge' in self.navigator) {
    try {
      if (count > 0) {
        await self.navigator.setAppBadge(count);
      } else {
        await self.navigator.clearAppBadge();
      }
    } catch (e) {
      // Badging API unsupported in this context; safe to ignore.
    }
  }
}

self.addEventListener('push', (event) => {
  const payload = parsePayload(event) || {};
  const title = payload.title || 'Shvatka';
  const url = resolveUrl(payload);

  const options = {
    body: payload.body || '',
    icon: '/assets/icons/web-app-manifest-192x192.png',
    // Android renders the status-bar/lock-screen badge from this image's alpha
    // channel only, so it must be a transparent silhouette (not a full photo)
    // or it shows up as a solid white square.
    badge: '/assets/icons/notification-badge.png',
    vibrate: [200, 100, 200],
    data: Object.assign({}, payload.data, { url }),
  };
  if (payload.tag) {
    options.tag = payload.tag;
    options.renotify = true;
  }

  const handlePush = (async () => {
    const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const isAppVisible = clientsList.some((client) => client.visibilityState === 'visible');

    clientsList.forEach((client) => client.postMessage({ type: 'push', payload }));

    await Promise.all([
      self.registration.showNotification(title, options),
      // While the app is open and visible the user already sees the toast above,
      // so it doesn't count toward the unread badge.
      isAppVisible ? setBadgeCount(0) : getBadgeCount().then((count) => setBadgeCount(count + 1)),
    ]);
  })();

  event.waitUntil(handlePush);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const url = data.url || '/';

  event.waitUntil(
    (async () => {
      await setBadgeCount(0);

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

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'reset-badge-count') {
    event.waitUntil(setBadgeCount(0));
  }
});
