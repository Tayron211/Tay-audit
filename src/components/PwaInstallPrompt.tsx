import React, { useState, useEffect } from 'react';
import { Download, Share, PlusSquare, X, Check } from 'lucide-react';
import { AndroidIcon, AppleIcon } from './BrandIcons';

export const PwaInstallPrompt: React.FC = () => {
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [showIOSModal, setShowIOSModal] = useState<boolean>(false);
  const [dismissed, setDismissed] = useState<boolean>(false);
  const [installedSuccessfully, setInstalledSuccessfully] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Detectar si ya corre en modo standalone (App Nativa instalada)
    const checkStandalone = () => {
      const standalone = window.matchMedia('(display-mode: standalone)').matches 
        || (window.navigator as any).standalone === true
        || document.referrer.includes('android-app://');
      setIsStandalone(standalone);
    };
    checkStandalone();

    // 2. Detectar plataforma móvil y iOS
    const ua = navigator.userAgent || '';
    const iOSDetected = /iphone|ipad|ipod/i.test(ua) && !(window as any).MSStream;
    const mobileDetected = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i.test(ua) ||
      (('ontouchstart' in window || navigator.maxTouchPoints > 0) && window.innerWidth <= 820);

    setIsIOS(iOSDetected);
    setIsMobile(mobileDetected);

    // Capturar cuando la app ya fue instalada
    const handleAppInstalled = () => {
      setInstalledSuccessfully(true);
      setIsStandalone(true);
      (window as any).__pwaInstallPrompt = null;
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    if (sessionStorage.getItem('tay_pwa_banner_dismissed') === '1') {
      setDismissed(true);
    }

    return () => {
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Si ya está instalada como app nativa o no es móvil o fue descartada en la sesión, no mostrar banner
  if (isStandalone || !isMobile || dismissed) {
    return null;
  }

  const handleInstallClick = () => {
    if (isIOS) {
      setShowIOSModal(true);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem('tay_pwa_banner_dismissed', '1');
    } catch {}
  };

  return (
    <>
      {/* Banner Superior Flotante: Invitar a instalar como WebAPK / App Nativa */}
      <aside
        aria-label="Instalar aplicación móvil"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 9998,
          background: 'linear-gradient(90deg, #070c1e 0%, #0d1530 100%)',
          color: '#ffffff',
          padding: '8px 12px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255, 184, 0, 0.25)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0, flex: 1 }}>
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '9px',
              backgroundColor: isIOS ? 'rgba(255, 255, 255, 0.08)' : 'rgba(61, 220, 132, 0.12)',
              border: `1px solid ${isIOS ? 'rgba(255, 255, 255, 0.2)' : 'rgba(61, 220, 132, 0.3)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
            }}
          >
            {isIOS ? <AppleIcon size={18} color="#ffffff" /> : <AndroidIcon size={19} color="#3DDC84" />}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.80rem', fontWeight: 800, color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {installedSuccessfully 
                  ? '¡App Instalada!' 
                  : isIOS ? 'TayAudit en iPhone' : 'TayAudit para Android'}
              </span>
              {!installedSuccessfully && (
                <span style={{
                  fontSize: '0.58rem',
                  fontWeight: 800,
                  padding: '1px 5px',
                  borderRadius: '4px',
                  backgroundColor: isIOS ? 'rgba(255, 255, 255, 0.15)' : 'rgba(61, 220, 132, 0.2)',
                  color: isIOS ? '#FFFFFF' : '#3DDC84',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  {isIOS ? 'PWA' : 'APK'}
                </span>
              )}
            </div>
            <span style={{ fontSize: '0.67rem', color: '#94A3B8', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {installedSuccessfully 
                ? 'Lista en tu pantalla de inicio' 
                : isIOS ? 'Acceso en pantalla de inicio' : 'App oficial con alertas en vivo'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {!installedSuccessfully && (
            !isIOS ? (
              <a
                href="/TayAudit.apk"
                download="TayAudit.apk"
                style={{
                  background: 'linear-gradient(135deg, #FFB800 0%, #F59E0B 100%)',
                  color: '#070C1E',
                  textDecoration: 'none',
                  padding: '6px 12px',
                  borderRadius: '20px',
                  fontSize: '0.74rem',
                  fontWeight: 900,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  boxShadow: '0 2px 10px rgba(255, 184, 0, 0.35)',
                  whiteSpace: 'nowrap'
                }}
              >
                <Download size={13} strokeWidth={2.8} />
                <span>Instalar</span>
              </a>
            ) : (
              <button
                type="button"
                onClick={handleInstallClick}
                style={{
                  background: 'linear-gradient(135deg, #FFB800 0%, #F59E0B 100%)',
                  color: '#070C1E',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '20px',
                  fontSize: '0.74rem',
                  fontWeight: 900,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 10px rgba(255, 184, 0, 0.35)',
                  whiteSpace: 'nowrap'
                }}
              >
                <Download size={13} strokeWidth={2.8} />
                <span>Instalar</span>
              </button>
            )
          )}

          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Cerrar aviso de instalación"
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              color: '#94A3B8',
              width: '26px',
              height: '26px',
              borderRadius: '7px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <X size={14} />
          </button>
        </div>
      </aside>



      {/* Modal Instructivo para iPhone (iOS) */}
      {showIOSModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="modal-backdrop-acrylic modal-centered-mobile"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 11000,
            backgroundColor: 'rgba(0, 0, 0, 0.82)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={() => setShowIOSModal(false)}
        >
          <div
            className="modal-window-acrylic"
            style={{
              width: '100%',
              maxWidth: '380px',
              backgroundColor: 'var(--bg-canvas-card, #0B132B)',
              border: '1px solid var(--border-acrylic, rgba(255, 255, 255, 0.15))',
              borderRadius: '24px',
              padding: '24px 20px',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.85)',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
              color: 'var(--text-primary, #ffffff)',
              margin: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header del Modal */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img 
                  src="/icon-192.png" 
                  alt="Tay-Audit Icon" 
                  style={{ width: '40px', height: '40px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}
                />
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800 }}>Instalar Tay-Audit</h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
                    <AppleIcon size={13} color="var(--text-secondary, #94a3b8)" />
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #94a3b8)' }}>
                      En tu iPhone / iPad
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSModal(false)}
                className="modal-close-btn"
                style={{ width: '32px', height: '32px' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Pasos Visuales iOS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(56, 189, 248, 0.15)',
                    color: '#38bdf8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 900,
                    fontSize: '0.80rem',
                    flexShrink: 0
                  }}
                >
                  1
                </div>
                <div style={{ fontSize: '0.82rem', lineHeight: 1.4 }}>
                  Toca el botón <strong>Compartir</strong> <Share size={14} style={{ display: 'inline', verticalAlign: 'middle', margin: '0 2px', color: '#38bdf8' }} /> en la barra inferior de Safari.
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(255, 184, 0, 0.15)',
                    color: '#FFB800',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 900,
                    fontSize: '0.80rem',
                    flexShrink: 0
                  }}
                >
                  2
                </div>
                <div style={{ fontSize: '0.82rem', lineHeight: 1.4 }}>
                  Desliza hacia abajo y selecciona <strong>Añadir a la pantalla de inicio</strong> <PlusSquare size={14} style={{ display: 'inline', verticalAlign: 'middle', margin: '0 2px', color: '#FFB800' }} />.
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(34, 197, 94, 0.15)',
                    color: '#22c55e',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 900,
                    fontSize: '0.80rem',
                    flexShrink: 0
                  }}
                >
                  3
                </div>
                <div style={{ fontSize: '0.82rem', lineHeight: 1.4 }}>
                  Pulsa <strong>Añadir</strong> arriba a la derecha. ¡Listo! Se abrirá como app nativa sin Safari.
                </div>
              </div>
            </div>

            {/* Botón Entendido */}
            <button
              type="button"
              onClick={() => setShowIOSModal(false)}
              className="btn-flat btn-primary"
              style={{
                width: '100%',
                padding: '11px',
                borderRadius: '12px',
                fontWeight: 800,
                fontSize: '0.84rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <Check size={16} />
              <span>Entendido</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};
