import type { AppNotification } from '../types';

/**
 * Registra el Service Worker para permitir notificaciones push en Windows y Móviles (Android / iOS)
 */
export const registerNotificationServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    return registration;
  } catch (err) {
    console.warn('No se pudo registrar el service worker para notificaciones push:', err);
    return null;
  }
};

/**
 * Consulta el estado actual de los permisos de notificaciones del sistema
 */
export const getSystemNotificationPermission = (): NotificationPermission | 'unsupported' => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
};

/**
 * Solicita permisos de notificación al usuario (compatible con Windows y Móvil)
 */
export const requestPushNotificationPermission = async (): Promise<boolean> => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      await registerNotificationServiceWorker();
      return true;
    }
    return false;
  } catch (err) {
    console.warn('Error al solicitar permisos de notificación:', err);
    return false;
  }
};

/**
 * Despacha una notificación nativa del sistema operativo tanto en Windows (Action Center)
 * como en teléfonos móviles (Bandeja del sistema con vibración y sonido).
 */
export const sendNativePushNotification = async (notif: AppNotification): Promise<boolean> => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  // Si no hay permisos concedidos, no se puede disparar
  if (Notification.permission !== 'granted') {
    return false;
  }

  const urgencyTag = notif.urgency === 'critica' ? '🔴 CRÍTICA' : notif.urgency === 'alta' ? '🟠 ALTA' : '🟡 TI';
  const title = `🎫 [${urgencyTag}] ${notif.category} • ${notif.hostname}`;
  const body = `${notif.userName || 'Usuario / Docente'}: ${notif.description || 'Nueva incidencia reportada desde STIVIE'}`;

  const notificationOptions: any = {
    body,
    icon: '/upn-arrow-icon.png',
    badge: '/upn-symbol.svg',
    tag: `ticket-${notif.ticketId}`,
    renotify: true,
    requireInteraction: true, // En Windows permanece en el centro de notificaciones
    silent: false,
    data: {
      ticketId: notif.ticketId,
      url: `/?tab=support&subtab=tickets&ticketId=${notif.ticketId}`
    }
  };

  // En Android / Chrome Móvil, new Notification() genera error si no se hace mediante Service Worker
  try {
    if ('serviceWorker' in navigator) {
      let reg: ServiceWorkerRegistration | null | undefined = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        reg = await registerNotificationServiceWorker();
      }
      if (reg && reg.showNotification) {
        // En móviles añadimos patrón de vibración
        notificationOptions.vibrate = [200, 100, 200, 100, 250];
        await reg.showNotification(title, notificationOptions);
        return true;
      }
    }
  } catch (swErr) {
    console.warn('Fallback a notificación directa de ventana:', swErr);
  }

  // Fallback para entornos de escritorio (Windows / Mac)
  try {
    const n = new Notification(title, notificationOptions);
    n.onclick = (e) => {
      e.preventDefault();
      window.focus();
      const event = new CustomEvent('app-open-ticket', { detail: { ticketId: notif.ticketId } });
      window.dispatchEvent(event);
      n.close();
    };
    return true;
  } catch (err) {
    console.error('Error al emitir notificación nativa:', err);
    return false;
  }
};
