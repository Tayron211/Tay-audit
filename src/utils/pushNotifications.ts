import type { AppNotification } from '../types';
import { API_BASE, isNativeCapacitor } from '../services/api';
import { playNotificationChime } from './notificationSound';
import { LocalNotifications } from '@capacitor/local-notifications';

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
 * Registra el Service Worker para permitir notificaciones push en segundo plano en Navegadores Web (PWA)
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

let isChannelCreated = false;

/**
 * Configura el canal de notificaciones nativas en Android (Heads-Up, sonido alto y vibración)
 */
export const setupNativeNotificationChannel = async () => {
  if (typeof window === 'undefined' || !isNativeCapacitor() || isChannelCreated) return;
  try {
    await LocalNotifications.createChannel({
      id: 'tay_audit_tickets_channel',
      name: 'Tickets de Soporte TI UPN',
      description: 'Notificaciones en tiempo real de nuevos tickets de soporte e incidencias',
      importance: 5, // High / Heads-up
      visibility: 1, // Public
      sound: 'notification.wav',
      vibration: true,
      lights: true,
      lightColor: '#FFB800'
    });
    isChannelCreated = true;

    // Escuchar cuando el usuario hace clic o toca la notificación en la bandeja del sistema
    LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
      const ticketId = action.notification.extra?.ticketId;
      if (ticketId && typeof window !== 'undefined') {
        const event = new CustomEvent('app-open-ticket', { detail: { ticketId } });
        window.dispatchEvent(event);
      }
    });
  } catch (err) {
    console.warn('Error configurando canal nativo de notificaciones:', err);
  }
};

/**
 * Suscribe este dispositivo al servidor Cloudflare / Express para recibir Web Push (en navegadores PWA)
 */
export const subscribeDeviceToPush = async (): Promise<{ success: boolean; error?: string; endpoint?: string }> => {
  if (typeof window === 'undefined') {
    return { success: false, error: 'Entorno no es navegador' };
  }
  if (isNativeCapacitor()) {
    // En APK nativo, las notificaciones se gestionan vía LocalNotifications y servicio nativo
    await setupNativeNotificationChannel();
    return { success: true, endpoint: 'native-capacitor' };
  }
  if (!('serviceWorker' in navigator)) {
    return { success: false, error: 'ServiceWorker no soportado en este dispositivo' };
  }
  if (!('PushManager' in window)) {
    return { success: false, error: 'PushManager no disponible en este navegador' };
  }

  try {
    await registerNotificationServiceWorker();
    const reg = await navigator.serviceWorker.ready;

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

      const resp = await fetch(`${API_BASE}/api/push/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint,
          p256dh,
          auth,
          userAgent: navigator.userAgent
        })
      });

      if (!resp.ok) {
        const errTxt = await resp.text();
        console.warn('Servidor rechazó registro push:', resp.status, errTxt);
        return { success: false, error: `Servidor HTTP ${resp.status}` };
      }

      try {
        localStorage.setItem('tay_push_registered', 'true');
      } catch {}

      return { success: true, endpoint };
    }

    return { success: false, error: 'No se pudo obtener objeto de suscripción' };
  } catch (err: any) {
    console.error('Error al suscribir el dispositivo a Web Push:', err);
    return { success: false, error: err?.message || String(err) };
  }
};

/**
 * Consulta el estado actual de los permisos de notificaciones del sistema (Asíncrono para APK + Web)
 */
export const getSystemNotificationPermission = async (): Promise<NotificationPermission | 'unsupported'> => {
  if (typeof window === 'undefined') {
    return 'unsupported';
  }

  if (isNativeCapacitor()) {
    try {
      const status = await LocalNotifications.checkPermissions();
      if (status.display === 'granted') return 'granted';
      if (status.display === 'denied') return 'denied';
      return 'default';
    } catch {
      return 'default';
    }
  }

  if (!('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
};

/**
 * Consulta sincrónica rápida del permiso
 */
export const getSystemNotificationPermissionSync = (): NotificationPermission | 'unsupported' => {
  if (typeof window === 'undefined') return 'unsupported';
  if (isNativeCapacitor()) {
    const saved = localStorage.getItem('tay_native_perm_granted');
    return saved === '1' ? 'granted' : 'default';
  }
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
};

/**
 * Solicita permisos de notificación al usuario (Dialog nativo en Android 13+ o Web Prompt)
 */
export const requestPushNotificationPermission = async (): Promise<boolean> => {
  if (typeof window === 'undefined') {
    return false;
  }

  // 1. En APK Nativo Android (Capacitor)
  if (isNativeCapacitor()) {
    try {
      await setupNativeNotificationChannel();
      const status = await LocalNotifications.requestPermissions();
      const ok = status.display === 'granted';
      if (ok) {
        localStorage.setItem('tay_native_perm_granted', '1');
      }
      return ok;
    } catch (err) {
      console.warn('Error solicitando permisos nativos en APK:', err);
      return false;
    }
  }

  // 2. En Navegador Web (Chrome, Edge, etc.)
  if (!('Notification' in window)) {
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      await registerNotificationServiceWorker();
      const res = await subscribeDeviceToPush();
      return res.success;
    }
    return false;
  } catch (err) {
    console.warn('Error al solicitar permisos de notificación:', err);
    return false;
  }
};

/**
 * Despacha una notificación nativa del sistema operativo:
 * - En APK Android Nativo: Dispara notificación heads-up nativa vía LocalNotifications con canal de alta prioridad.
 * - En Navegadores Web: Dispara ServiceWorker.showNotification o Web Notification.
 */
export const sendNativePushNotification = async (notif: AppNotification): Promise<boolean> => {
  if (typeof window === 'undefined') {
    return false;
  }

  // Siempre ejecutar timbre sonoro y vibración inmediata
  playNotificationChime();

  const urgencyTag = notif.urgency === 'critica' ? '🔴 CRÍTICA' : notif.urgency === 'alta' ? '🟠 ALTA' : '🟡 TI';
  const title = `🎫 [${urgencyTag}] ${notif.category} • ${notif.hostname}`;
  const body = `${notif.userName || 'Usuario / Docente'}: ${notif.description || 'Nueva incidencia reportada desde STIVIE'}`;

  // 1. Caso APK Nativo Android
  if (isNativeCapacitor()) {
    try {
      await setupNativeNotificationChannel();
      let notifId = 100;
      try {
        const digits = notif.ticketId.replace(/\D+/g, '');
        if (digits) notifId = parseInt(digits, 10);
      } catch {}

      await LocalNotifications.schedule({
        notifications: [
          {
            id: notifId,
            title,
            body,
            largeBody: `${notif.userName || 'Usuario'}\nUrgencia: ${notif.urgency}\n${notif.description}`,
            summaryText: `Ticket ${notif.ticketId}`,
            channelId: 'tay_audit_tickets_channel',
            sound: 'notification.wav',
            smallIcon: 'ic_launcher',
            iconColor: '#FFB800',
            autoCancel: true,
            foreground: true,
            isExactNotification: false,
            extra: {
              ticketId: notif.ticketId
            }
          }
        ]
      });
      return true;
    } catch (capErr) {
      console.warn('Error emitiendo LocalNotification en APK:', capErr);
    }
  }

  // 2. Caso Navegador Web (PWA / Chrome / Edge)
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return false;
  }

  const notificationOptions: any = {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
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
    console.error('Error al emitir notificación web:', err);
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
