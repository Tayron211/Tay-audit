// Service Worker para Notificaciones Push Nativas y WebAPK en Android / iOS (TAY-AUDIT 24/7)

const CACHE_NAME = 'tay-audit-pwa-v1';
const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-192.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png',
  '/favicon.svg',
  '/notification.wav'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Manejador fetch indispensable para habilitar la instalación de WebAPK nativo en Android
self.addEventListener('fetch', (event) => {
  // Las llamadas API de sincronización y datos en tiempo real siempre van a la red
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache).catch(() => {});
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.mode === 'navigate') {
          const fallback = await caches.match('/');
          if (fallback) return fallback;
        }
        return new Response('Modo Offline', { status: 503, statusText: 'Offline' });
      })
  );
});

// Manejo de clic en la notificación nativa (Android, iOS o Windows Action Center)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const ticketId = event.notification.data ? event.notification.data.ticketId : null;
  const targetUrl = ticketId 
    ? `/?tab=support&subtab=tickets&ticketId=${ticketId}` 
    : '/?tab=support&subtab=tickets';

  event.waitUntil((async () => {
    const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientList) {
      if ('focus' in client) {
        if (client.url.includes(self.location.origin)) {
          await client.focus();
          client.postMessage({ type: 'OPEN_TICKET', ticketId: ticketId });
          return;
        }
      }
    }
    if (self.clients.openWindow) {
      return self.clients.openWindow(targetUrl);
    }
  })());
});

// Manejo de eventos Web Push del servidor en segundo plano (FCM / APNS)
self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    let payload = null;
    if (event.data) {
      try {
        payload = event.data.json();
      } catch {
        payload = { body: event.data.text() };
      }
    }

    // Si el push no incluye los detalles completos, consultamos la última incidencia de la base de datos
    let ticket = payload;
    if (!ticket || !ticket.id || !ticket.category) {
      try {
        const res = await fetch('/api/tickets', { cache: 'no-store' });
        if (res.ok) {
          const tickets = await res.json();
          if (Array.isArray(tickets) && tickets.length > 0) {
            ticket = tickets[0];
          }
        }
      } catch (err) {
        console.warn('SW no pudo consultar /api/tickets:', err);
      }
    }

    const urgencyTag = ticket?.urgency === 'critica' ? '🔴 CRÍTICA' : ticket?.urgency === 'alta' ? '🟠 ALTA' : '🟡 TI';
    const title = ticket?.category 
      ? `🎫 [${urgencyTag}] ${ticket.category} • ${ticket.hostname || 'UPN'}` 
      : (payload?.title || '🎫 Nuevo Ticket Soporte TI UPN');

    const body = ticket?.description
      ? `${ticket.userName || 'Usuario'}: ${ticket.description}`
      : (payload?.body || 'Se ha registrado una nueva incidencia técnica.');

    const ticketId = ticket?.id || payload?.ticketId || null;

    const notificationOptions = {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: ticketId ? `ticket-${ticketId}` : `ticket-${Date.now()}`,
      renotify: true,
      requireInteraction: true,
      silent: false,
      sound: '/notification.wav',
      vibrate: [300, 150, 300, 150, 450],
      data: {
        ticketId: ticketId,
        url: ticketId ? `/?tab=support&subtab=tickets&ticketId=${ticketId}` : '/?tab=support&subtab=tickets'
      },
      actions: [
        { action: 'open', title: '🎫 Ver Caso' }
      ]
    };

    await self.registration.showNotification(title, notificationOptions);
  })());
});

// ============================================================================
// VERIFICADOR DE SEGUNDO PLANO AUTÓNOMO (FALLBACK CONTINUO PARA MÓVILES)
// ============================================================================
let lastSyncVersionSw = null;
let lastNotifiedTicketId = null;

async function checkBackgroundUpdates() {
  try {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // Si la app está abierta en primer plano activo, la UI principal se encarga del sonido
    const isAppInForeground = clients.some(c => c.visibilityState === 'visible');

    const syncRes = await fetch('/api/sync-state', { cache: 'no-store' });
    if (!syncRes.ok) return;
    const syncData = await syncRes.json();

    if (lastSyncVersionSw === null) {
      lastSyncVersionSw = syncData.version;
      return;
    }

    if (syncData.version !== lastSyncVersionSw) {
      lastSyncVersionSw = syncData.version;

      // Si la app está minimizada o en segundo plano, notificamos directamente al sistema operativo
      if (!isAppInForeground) {
        const ticketsRes = await fetch('/api/tickets', { cache: 'no-store' });
        if (ticketsRes.ok) {
          const tickets = await ticketsRes.json();
          if (Array.isArray(tickets) && tickets.length > 0) {
            const latest = tickets[0];
            if (latest.status !== 'resuelto' && latest.id !== lastNotifiedTicketId) {
              lastNotifiedTicketId = latest.id;
              const urgencyTag = latest.urgency === 'critica' ? '🔴 CRÍTICA' : latest.urgency === 'alta' ? '🟠 ALTA' : '🟡 TI';
              await self.registration.showNotification(
                `🎫 [${urgencyTag}] ${latest.category} • ${latest.hostname || 'UPN'}`,
                {
                  body: `${latest.userName || 'Usuario'}: ${latest.description}`,
                  icon: '/icon-192.png',
                  badge: '/icon-192.png',
                  tag: `ticket-${latest.id}`,
                  renotify: true,
                  requireInteraction: true,
                  silent: false,
                  sound: '/notification.wav',
                  vibrate: [300, 150, 300, 150, 450],
                  data: {
                    ticketId: latest.id,
                    url: `/?tab=support&subtab=tickets&ticketId=${latest.id}`
                  }
                }
              );
            }
          }
        }
      }
    }
  } catch (err) {
    // Modo silencioso ante desconexión de red transitoria
  }
}

// Polling de respaldo cada 2.5 segundos para detección rápida en segundo plano
setInterval(checkBackgroundUpdates, 2500);
