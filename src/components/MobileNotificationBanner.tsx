import React, { useState, useEffect } from 'react';
import { BellRing, CheckCircle2, X } from 'lucide-react';
import { getSystemNotificationPermission, requestPushNotificationPermission } from '../utils/pushNotifications';

export const MobileNotificationBanner: React.FC = () => {
  const [permission, setPermission] = useState<string>('granted');
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [dismissed, setDismissed] = useState<boolean>(false);
  const [isActivating, setIsActivating] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ua = navigator.userAgent || '';
    const mobileDetected = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i.test(ua) ||
      (('ontouchstart' in window || navigator.maxTouchPoints > 0) && window.innerWidth <= 820);
    setIsMobile(mobileDetected);

    const currentPerm = getSystemNotificationPermission();
    setPermission(currentPerm);

    // Si ya fue descartado en esta sesión
    if (sessionStorage.getItem('tay_notif_banner_dismissed') === '1') {
      setDismissed(true);
    }
  }, []);

  if (!isMobile || permission === 'granted' || permission === 'unsupported' || dismissed) {
    return null;
  }

  const handleActivate = async () => {
    setIsActivating(true);
    try {
      const ok = await requestPushNotificationPermission();
      if (ok) {
        setSuccess(true);
        setPermission('granted');
        setTimeout(() => {
          setDismissed(true);
        }, 3000);
      } else {
        setPermission(getSystemNotificationPermission());
      }
    } finally {
      setIsActivating(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem('tay_notif_banner_dismissed', '1');
    } catch {}
  };

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 999,
        backgroundColor: success ? 'rgba(34, 197, 94, 0.95)' : 'rgba(234, 179, 8, 0.96)',
        color: '#000000',
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        transition: 'all 0.3s ease'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
        {success ? (
          <>
            <CheckCircle2 size={18} color="#000000" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '0.78rem', fontWeight: 800 }}>
              ¡Notificaciones activadas con éxito! Recibirás alertas con sonido en tu celular.
            </span>
          </>
        ) : (
          <>
            <BellRing size={18} color="#000000" style={{ flexShrink: 0, animation: 'pulse 1.5s infinite' }} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 900, lineHeight: 1.2 }}>
                Activar Alertas de Tickets en este Celular
              </span>
              <span style={{ fontSize: '0.68rem', fontWeight: 600, opacity: 0.9 }}>
                Recibe sonido y avisos en segundo plano al crearse tickets
              </span>
            </div>
          </>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {!success && (
          <button
            type="button"
            onClick={handleActivate}
            disabled={isActivating}
            style={{
              padding: '6px 14px',
              fontSize: '0.74rem',
              fontWeight: 900,
              backgroundColor: '#000000',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
            }}
          >
            {isActivating ? 'Activando...' : 'Permitir'}
          </button>
        )}
        <button
          type="button"
          onClick={handleDismiss}
          style={{
            background: 'none',
            border: 'none',
            color: '#000000',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            opacity: 0.7
          }}
          title="Cerrar aviso"
          aria-label="Cerrar aviso"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};
