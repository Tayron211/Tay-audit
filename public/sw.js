// Service Worker para Notificaciones Push Nativas en Móviles y Windows (TAY-AUDIT & STIVIE 24/7)

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
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
      icon: '/upn-arrow-icon.png',
      badge: '/upn-symbol.svg',
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

    const syncRes = await fetch('/api/sync/state', { cache: 'no-store' });
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
                  icon: '/upn-arrow-icon.png',
                  badge: '/upn-symbol.svg',
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

// Polling de respaldo cada 5 segundos
setInterval(checkBackgroundUpdates, 5000);
