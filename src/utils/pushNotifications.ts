import type { AppNotification } from '../types';
import { API_BASE } from '../services/api';
import { playNotificationChime } from './notificationSound';

export const VAPID_PUBLIC_KEY = 'BGkSXnXaQ6GLubO9tK0uaFxsBm10mCoHbEjVHY-UsA4g6jC0CNfPrnywmxr_owgO-r2mDTN_3sKWT6Q39x6BrIk';

/**
 * Convierte una clave pública VAPID en Base64URL al formato Uint8Array requerido por PushManager
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Registra el Service Worker para permitir notificaciones push en segundo plano en Móviles y Windows
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
 * Suscribe este dispositivo móvil o PC al servidor Cloudflare / Express para recibir Web Push en segundo plano
 */
export const subscribeDeviceToPush = async (): Promise<boolean> => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }

  try {
    let reg: ServiceWorkerRegistration | null | undefined = await navigator.serviceWorker.getRegistration();
    if (!reg) {
      reg = await registerNotificationServiceWorker();
    }
    if (!reg) return false;

    // Verificar si ya existe una suscripción activa
    let subscription = await reg.pushManager.getSubscription();
    if (!subscription) {
      const appKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: appKey as unknown as BufferSource
      });
    }

    if (subscription) {
      const subJson = subscription.toJSON();
      const endpoint = subscription.endpoint;
      const p256dh = subJson.keys?.p256dh || '';
      const auth = subJson.keys?.auth || '';

      await fetch(`${API_BASE}/api/push/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint,
          p256dh,
          auth,
          userAgent: navigator.userAgent
        })
      });
      return true;
    }
    return false;
  } catch (err) {
    console.warn('Error al suscribir el dispositivo a Web Push:', err);
    return false;
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
 * Solicita permisos de notificación al usuario y suscribe el dispositivo automáticamente
 */
export const requestPushNotificationPermission = async (): Promise<boolean> => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      await registerNotificationServiceWorker();
      await subscribeDeviceToPush();
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
  if (typeof window === 'undefined') {
    return false;
  }

  // Siempre ejecutar timbre y vibración
  playNotificationChime();

  if (!('Notification' in window) || Notification.permission !== 'granted') {
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
    requireInteraction: true,
    silent: false,
    sound: '/notification.wav',
    vibrate: [300, 150, 300, 150, 450],
    data: {
      ticketId: notif.ticketId,
      url: `/?tab=support&subtab=tickets&ticketId=${notif.ticketId}`
    },
    actions: [
      { action: 'open', title: '🎫 Ver Caso' }
    ]
  };

  // En Android / Chrome Móvil es indispensable usar ServiceWorkerRegistration.showNotification
  try {
    if ('serviceWorker' in navigator) {
      let reg: ServiceWorkerRegistration | null | undefined = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        reg = await registerNotificationServiceWorker();
      }
      if (reg && reg.showNotification) {
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

/**
 * Envía una prueba de notificación Push a través del servidor a todos los dispositivos
 */
export const triggerPushTest = async (): Promise<boolean> => {
  try {
    const res = await fetch(`${API_BASE}/api/push/test`, { method: 'POST' });
    return res.ok;
  } catch {
    return false;
  }
};
