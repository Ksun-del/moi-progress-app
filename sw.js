// Service worker для приложения "Мой прогресс"
// Нужен, чтобы: 1) приложение можно было установить на телефон, 2) приходили push-уведомления.

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  self.clients.claim();
});

// Приходит push от сервера напоминаний
self.addEventListener('push', (event) => {
  let data = { title: 'Мой прогресс', body: 'Напоминание' };
  try { data = event.data.json(); } catch (e) {}
  event.waitUntil(
    self.registration.showNotification(data.title || 'Мой прогресс', {
      body: data.body || '',
      icon: 'icon-192.png',
      badge: 'icon-192.png'
    })
  );
});

// Клик по уведомлению — открыть приложение
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(list => {
      for (const c of list) { if ('focus' in c) return c.focus(); }
      if (clients.openWindow) return clients.openWindow('./');
    })
  );
});
