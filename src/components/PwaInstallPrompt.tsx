import React, { useState, useEffect } from 'react';
import { Download, Share, PlusSquare, X, Check, Smartphone } from 'lucide-react';

export const PwaInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
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

    // 3. Capturar evento de instalación nativo (Android / Chrome)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 4. Capturar cuando la app ya fue instalada
    const handleAppInstalled = () => {
      setInstalledSuccessfully(true);
      setIsStandalone(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    if (sessionStorage.getItem('tay_pwa_banner_dismissed') === '1') {
      setDismissed(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Si ya está instalada como app nativa o no es móvil o fue descartada en la sesión, no mostrar banner
  if (isStandalone || !isMobile || dismissed) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSModal(true);
      return;
    }

    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setInstalledSuccessfully(true);
          setDeferredPrompt(null);
        }
      } catch {
        // En caso de fallo transitorio en el prompt del navegador
      }
    } else {
      // Si el navegador de Android aún no emitió beforeinstallprompt o es un navegador alternativo
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
      {/* Banner Superior Flotante: Invitar a instalar como App Nativa */}
      <aside
        aria-label="Instalar aplicación móvil"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 9998,
          background: 'linear-gradient(135deg, rgba(255, 184, 0, 0.95), rgba(245, 158, 11, 0.95))',
          color: '#000000',
          padding: '8px 12px',
          boxShadow: '0 4px 16px rgba(245, 158, 11, 0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(0,0,0,0.1)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: '#070c1e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
            }}
          >
            <Smartphone size={18} color="#FFB800" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 900, lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {installedSuccessfully ? '¡App Instalada con Éxito!' : 'Usar como App Nativa'}
            </span>
            <span style={{ fontSize: '0.67rem', fontWeight: 600, opacity: 0.9, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {installedSuccessfully 
                ? 'Ábrela desde tu pantalla de inicio' 
                : 'Sin barras de navegador, más rápida y en pantalla completa'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {!installedSuccessfully && (
            <button
              type="button"
              onClick={handleInstallClick}
              style={{
                backgroundColor: '#070c1e',
                color: '#FFB800',
                border: 'none',
                padding: '5px 12px',
                borderRadius: '8px',
                fontSize: '0.72rem',
                fontWeight: 900,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                whiteSpace: 'nowrap'
              }}
            >
              <Download size={13} strokeWidth={2.5} />
              <span>Instalar</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Cerrar aviso de instalación"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(0, 0, 0, 0.65)',
              padding: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={16} />
          </button>
        </div>
      </aside>

      {/* Modal Instructivo para iPhone (iOS) y Navegadores sin auto-prompt */}
      {showIOSModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 11000,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={() => setShowIOSModal(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '380px',
              backgroundColor: 'var(--bg-canvas-card, #0B132B)',
              border: '1px solid var(--border-acrylic, rgba(255, 255, 255, 0.15))',
              borderRadius: '24px',
              padding: '24px 20px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8)',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
              color: 'var(--text-primary, #ffffff)',
              animation: 'slideUpModal 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
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
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #94a3b8)' }}>
                    {isIOS ? 'En tu iPhone / iPad' : 'En tu dispositivo móvil'}
                  </span>
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

            {/* Pasos Visuales */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {isIOS ? (
                <>
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
                </>
              ) : (
                <>
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
                      1
                    </div>
                    <div style={{ fontSize: '0.82rem', lineHeight: 1.4 }}>
                      Toca el menú de opciones de tu navegador (los tres puntos <strong>⋮</strong> arriba a la derecha).
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
                      2
                    </div>
                    <div style={{ fontSize: '0.82rem', lineHeight: 1.4 }}>
                      Selecciona <strong>"Instalar aplicación"</strong> o <strong>"Añadir a la pantalla de inicio"</strong>.
                    </div>
                  </div>
                </>
              )}
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
