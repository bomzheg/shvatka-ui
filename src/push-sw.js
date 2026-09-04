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
//
// The app is the source of truth for this number: it polls
// GET /notifications/unread-count and pushes the result here via the
// 'set-badge-count' message. Incrementing on a background push is only an
// approximation until the app is opened and resyncs.
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

// What this device wants to see, as chosen in the profile and handed over by
// the app ('set-push-settings'). Persisted in Cache Storage for the same reason
// the badge count is: the worker is killed between pushes, and a push may well
// arrive before any page of the app has run. The app owns the mapping from the
// categories a player picks to the engine's push kinds — the worker only ever
// receives the resulting list, so the two never disagree about what a category
// means.
//
// The subscription is userVisibleOnly, so a browser may still show a generic
// notification of its own for a push we deliberately drop. Filtering here is
// the per-device half of the feature; the account-wide half belongs on the
// backend, which would not send the push at all.
const SETTINGS_CACHE = 'shvatka-push-settings-v1';
const SETTINGS_KEY = '/__push-settings__';
const DEFAULT_SETTINGS = { mutedKinds: [], vibrate: true };

async function getPushSettings() {
  if (!('caches' in self)) {
    return DEFAULT_SETTINGS;
  }
  try {
    const cache = await caches.open(SETTINGS_CACHE);
    const cached = await cache.match(SETTINGS_KEY);
    if (!cached) {
      return DEFAULT_SETTINGS;
    }
    const stored = await cached.json();
    return {
      mutedKinds: Array.isArray(stored.mutedKinds) ? stored.mutedKinds : [],
      vibrate: stored.vibrate !== false,
    };
  } catch (e) {
    // Unreadable cache: show everything, as if nothing was ever configured.
    return DEFAULT_SETTINGS;
  }
}

async function setPushSettings(settings) {
  if (!('caches' in self)) {
    return;
  }
  const cache = await caches.open(SETTINGS_CACHE);
  await cache.put(
    SETTINGS_KEY,
    new Response(
      JSON.stringify({
        mutedKinds: Array.isArray(settings.mutedKinds) ? settings.mutedKinds : [],
        vibrate: settings.vibrate !== false,
      }),
    ),
  );
}

// The tag already collapses same-kind pushes (a new hint replaces the previous
// one), but a level up leaves the hints of the level the team has just left
// sitting in the tray. A push whose kind is listed here closes those: the tray
// shows where the team is now, not the history of how it got there.
const SUPERSEDED_KINDS = {
  puzzle: ['hint', 'effects'],
  team_finished: ['puzzle', 'hint', 'effects'],
  game_finished: ['puzzle', 'hint', 'effects', 'team_finished'],
};

async function closeSuperseded(payload) {
  const data = (payload && payload.data) || {};
  const kinds = SUPERSEDED_KINDS[data.kind];
  if (!kinds || !self.registration.getNotifications) {
    return;
  }
  // The game ending is everyone's news; the rest only concern one team, and a
  // player may well be following another team's pushes as an org.
  const wholeGame = data.kind === 'game_finished';
  const shown = await self.registration.getNotifications();
  for (const notification of shown) {
    const other = notification.data || {};
    if (kinds.includes(other.kind) && (wholeGame || other.team_id === data.team_id)) {
      notification.close();
    }
  }
}

self.addEventListener('push', (event) => {
  const payload = parsePayload(event) || {};
  const title = payload.title || 'Shvatka';
  const url = resolveUrl(payload);
  const kind = (payload.data && payload.data.kind) || undefined;

  const handlePush = (async () => {
    const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const isAppVisible = clientsList.some((client) => client.visibilityState === 'visible');

    // Even a muted push is news for an open app: the notification feed and its
    // unread count are the account's, not this device's, so they still refresh.
    clientsList.forEach((client) => client.postMessage({ type: 'push', payload }));

    // Before the mute check and before showing: a muted level-up still has to
    // clear the tray of the level the team has just left, and the notification
    // this push draws is never a candidate for closing.
    await closeSuperseded(payload);

    const settings = await getPushSettings();
    if (kind && settings.mutedKinds.includes(kind)) {
      return;
    }

    const options = {
      body: payload.body || '',
      icon: '/assets/icons/web-app-manifest-192x192.png',
      // Android renders the status-bar/lock-screen badge from this image's alpha
      // channel only, so it must be a transparent silhouette (not a full photo)
      // or it shows up as a solid white square.
      badge: '/assets/icons/notification-badge.png',
      data: Object.assign({}, payload.data, { url }),
    };
    if (settings.vibrate) {
      options.vibrate = [200, 100, 200];
    }
    if (payload.tag) {
      options.tag = payload.tag;
      options.renotify = true;
    }

    await Promise.all([
      self.registration.showNotification(title, options),
      // While the app is open and visible it refreshes the unread count from
      // the server itself (triggered by the 'push' message above), so the
      // badge is only incremented for background pushes.
      isAppVisible ? Promise.resolve() : getBadgeCount().then((count) => setBadgeCount(count + 1)),
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
  } else if (event.data && event.data.type === 'set-badge-count') {
    const count = Number(event.data.count);
    event.waitUntil(setBadgeCount(Number.isFinite(count) && count > 0 ? count : 0));
  } else if (event.data && event.data.type === 'set-push-settings') {
    event.waitUntil(setPushSettings(event.data));
  }
});
