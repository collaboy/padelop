// v4
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', e => {
  const d = e.data?.json() ?? {};
  e.waitUntil(
    self.registration.showNotification(d.title ?? 'padla', {
      body: d.body ?? 'Time for your daily check-in — takes 20 seconds',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: d.tag ?? 'padelop',
      data: { url: d.url ?? '/home8' },
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url ?? '/home8';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.startsWith(self.location.origin));
      if (existing) {
        return existing.focus().then(() => existing.navigate(url));
      }
      return self.clients.openWindow(url);
    })
  );
});
