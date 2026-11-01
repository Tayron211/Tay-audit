// Service Worker para Notificaciones Push Nativas en Windows y Móviles (TAY-AUDIT & STIVIE)
const CACHE_NAME = 'tay-audit-sw-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Manejo de clic en la notificación del sistema operativo (Windows Action Center o Android / iOS)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const ticketId = event.notification.data ? event.notification.data.ticketId : null;
  const targetUrl = ticketId 
    ? `/?tab=support&subtab=tickets&ticketId=${ticketId}` 
    : '/?tab=support&subtab=tickets';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Si la ventana ya está abierta, enfocarla y navegar al ticket
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if ('focus' in client) {
          if (client.url.includes(self.location.origin)) {
            client.postMessage({ type: 'OPEN_TICKET', ticketId: ticketId });
            return client.focus();
          }
        }
      }
      // Si no hay ninguna ventana abierta, abrir una nueva
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Manejo de eventos push en segundo plano
self.addEventListener('push', (event) => {
  let data = {
    title: 'Nuevo Ticket TI UPN',
    body: 'Se ha recibido una nueva incidencia técnica.',
    ticketId: null
  };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/upn-arrow-icon.png',
    badge: '/upn-symbol.svg',
    tag: data.ticketId ? `ticket-${data.ticketId}` : 'ticket-notification',
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: {
      ticketId: data.ticketId,
      url: data.ticketId ? `/?tab=support&subtab=tickets&ticketId=${data.ticketId}` : '/?tab=support&subtab=tickets'
    }
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

