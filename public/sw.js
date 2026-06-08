// v2
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

// Handle server-sent push events (for future backend integration)
self.addEventListener('push', e => {
  const d = e.data?.json() ?? {};
  e.waitUntil(
    self.registration.showNotification(d.title ?? 'padla', {
      body: d.body ?? 'Time for your daily check-in — takes 20 seconds',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'daily-checkin',
      data: { url: d.url ?? '/' },
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.startsWith(self.location.origin));
      if (existing) return existing.focus();
      return self.clients.openWindow(e.notification.data?.url ?? '/');
    })
  );
});
