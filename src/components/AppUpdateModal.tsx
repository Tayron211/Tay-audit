import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  RotateCw,
  Download,
  CheckCircle2,
  X,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import {
  triggerDirectApkInstall,
  AppInstaller,
  APP_CURRENT_VERSION,
  type AppUpdateInfo
} from '../utils/appUpdateChecker';
import { isNativeCapacitor } from '../services/api';
import { useFadeModal } from '../utils/useFadeModal';

interface AppUpdateModalProps {
  updateInfo: AppUpdateInfo | null;
  onClose: () => void;
}

export const AppUpdateModal: React.FC<AppUpdateModalProps> = ({ updateInfo, onClose }) => {
  const isAvailable = Boolean(isNativeCapacitor() && updateInfo && updateInfo.isAvailable);
  const fade = useFadeModal(isAvailable ? updateInfo : null, onClose, 220, { isModal: true });
  const rawInfo: Partial<AppUpdateInfo> =
    fade.cachedData && typeof fade.cachedData === 'object'
      ? fade.cachedData
      : updateInfo && typeof updateInfo === 'object'
        ? updateInfo
        : {};

  const currentVer = rawInfo.currentVersion || APP_CURRENT_VERSION || '1.0.0';
  const latestVer = rawInfo.latestVersion || currentVer;
  const infoNotes = rawInfo.notes || 'Mejoras de rendimiento a 120 FPS y estabilidad.';
  const isForceUpdate = Boolean(rawInfo.forceUpdate);
  const targetApkUrl = rawInfo.apkUrl || 'https://tay-audit.pages.dev/TayAudit.apk';
  const detailedFeatures = Array.isArray(rawInfo.features) && rawInfo.features.length > 0 ? rawInfo.features : null;

  const [downloading, setDownloading] = useState<boolean>(false);
  const [downloadStarted, setDownloadStarted] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);

  // El popup de actualización SOLO opera dentro de la app APK nativa (Android)
  if (!isNativeCapacitor() || !fade.shouldRender || typeof document === 'undefined') return null;

  const handleUpdate = async () => {
    if (progress >= 100) {
      try {
        if (AppInstaller?.launchInstaller) {
          await AppInstaller.launchInstaller();
          return;
        }
      } catch (err) {
        console.warn('Reintentando instalación directa:', err);
      }
    }

    setDownloading(true);
    setProgress(5);
    setDownloadStarted(true);

    try {
      await triggerDirectApkInstall(targetApkUrl, (data) => {
        if (data && typeof data.percent === 'number') {
          setProgress(Math.max(5, Math.min(100, data.percent)));
        }
      });
    } catch (err) {
      console.error('Error starting update installation:', err);
      setDownloading(false);
    }
  };

  return createPortal(
    <div
      className={`modal-backdrop-acrylic ${fade.isClosing ? 'closing' : ''} fixed inset-0 z-[999999] select-none ${fade.backdropClass}`}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        backgroundColor: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box'
      }}
    >
      <div
        className={`acrylic-card border-2 ${fade.modalClass}`}
        style={{
          width: '100%',
          maxWidth: '430px',
          maxHeight: '92vh',
          backgroundColor: 'var(--bg-modal-window)',
          backdropFilter: 'blur(28px) saturate(180%)',
          WebkitBackdropFilter: 'blur(28px) saturate(180%)',
          border: '2px solid rgba(253, 186, 48, 0.8)',
          borderRadius: '24px',
          padding: '18px',
          boxShadow: '0 16px 50px rgba(253, 186, 48, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          boxSizing: 'border-box',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #FDBA30 0%, #f59e0b 100%)',
                color: '#09090b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(253, 186, 48, 0.35)',
                flexShrink: 0
              }}
            >
              <RotateCw size={20} strokeWidth={2.4} />
            </div>
            <div style={{ minWidth: 0 }}>
              <span
                style={{
                  fontSize: '9.5px',
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: '#b45309',
                  backgroundColor: 'rgba(253, 186, 48, 0.18)',
                  border: '1px solid rgba(253, 186, 48, 0.4)',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  display: 'inline-block',
                  marginBottom: '2px'
                }}
              >
                Actualización OTA Disponible
              </span>
              <h2
                style={{
                  fontSize: '1.05rem',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  margin: 0,
                  letterSpacing: '-0.02em',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                Tay-Audit v{latestVer}
              </h2>
            </div>
          </div>

          {!isForceUpdate && (
            <button
              type="button"
              onClick={() => fade.requestClose()}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '10px'
              }}
              title="Cerrar"
            >
              <X size={18} strokeWidth={2.2} />
            </button>
          )}
        </div>

        {/* Comparación Visual: Instalada -> Disponible */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            backgroundColor: 'var(--bg-card-subtle)',
            padding: '10px 14px',
            borderRadius: '16px',
            border: '1px solid var(--border-acrylic)'
          }}
        >
          {/* Versión Anterior */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '2px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--text-muted)' }} />
              <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                Instalada
              </span>
            </div>
            <div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '0.86rem', color: 'var(--text-primary)' }}>
              v{currentVer}
            </div>
          </div>

          {/* Flecha Central */}
          <div
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '50%',
              backgroundColor: 'rgba(253, 186, 48, 0.15)',
              color: '#FDBA30',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(253, 186, 48, 0.3)',
              flexShrink: 0
            }}
          >
            <ArrowRight size={15} strokeWidth={2.6} />
          </div>

          {/* Versión Nueva */}
          <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '5px', marginBottom: '2px' }}>
              <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: '#10b981' }}>
                Disponible
              </span>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
            </div>
            <div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '0.86rem', color: '#10b981' }}>
              v{latestVer}
            </div>
          </div>
        </div>

        {/* Novedades y Mejoras */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            borderRadius: '16px',
            backgroundColor: 'rgba(253, 186, 48, 0.08)',
            border: '1px solid rgba(253, 186, 48, 0.25)',
            padding: '10px',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10.5px', fontWeight: 900, textTransform: 'uppercase', color: '#d97706' }}>
              <Sparkles size={13} color="#FDBA30" />
              <span>Novedades & Mejoras</span>
            </div>
            {detailedFeatures && (
              <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 6px', borderRadius: '6px', backgroundColor: 'rgba(253, 186, 48, 0.2)', color: '#d97706' }}>
                {detailedFeatures.length} cambios
              </span>
            )}
          </div>

          <div style={{ overflowY: 'auto', maxHeight: '180px', display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '4px' }}>
            {detailedFeatures && detailedFeatures.length > 0 ? (
              detailedFeatures.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    padding: '8px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--bg-modal-window)',
          backdropFilter: 'blur(28px) saturate(180%)',
          WebkitBackdropFilter: 'blur(28px) saturate(180%)',
                    border: '1px solid var(--border-acrylic)'
                  }}
                >
                  <div style={{ width: '18px', height: '18px', borderRadius: '6px', backgroundColor: 'rgba(253, 186, 48, 0.15)', color: '#FDBA30', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                    <CheckCircle2 size={13} strokeWidth={2.4} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {item.title && (
                      <h4 style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 2px 0' }}>
                        {item.title}
                      </h4>
                    )}
                    <p style={{ fontSize: '10.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.35 }}>
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                {infoNotes}
              </p>
            )}
          </div>
        </div>

        {/* Barra de Progreso en Vivo */}
        {downloadStarted && (
          <div
            style={{
              padding: '10px',
              borderRadius: '14px',
              backgroundColor: 'rgba(253, 186, 48, 0.12)',
              border: '1px solid rgba(253, 186, 48, 0.35)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', fontWeight: 800 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: 'var(--text-primary)' }}>
                <ShieldCheck size={14} color="#FDBA30" strokeWidth={2.2} />
                {progress >= 100 ? 'Iniciando instalador...' : 'Descargando paquete OTA...'}
              </span>
              <span style={{ fontFamily: 'monospace', fontWeight: 900, color: '#FDBA30' }}>{progress}%</span>
            </div>
            <div style={{ width: '100%', height: '8px', borderRadius: '999px', backgroundColor: 'rgba(255, 255, 255, 0.1)', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${progress}%`,
                  backgroundColor: '#FDBA30',
                  borderRadius: '999px',
                  transition: 'width 0.2s ease'
                }}
              />
            </div>
            <p style={{ fontSize: '10px', color: 'var(--text-secondary)', margin: 0 }}>
              {progress >= 100
                ? 'Completado. Confirma la instalación en la ventana de Android.'
                : 'Descarga en curso. El instalador se abrirá automáticamente al finalizar.'}
            </p>
          </div>
        )}

        {/* Botón Principal */}
        <button
          type="button"
          onClick={handleUpdate}
          disabled={downloading && progress < 100}
          style={{
            width: '100%',
            height: '42px',
            borderRadius: '14px',
            backgroundColor: '#FDBA30',
            color: '#09090b',
            fontWeight: 800,
            fontSize: '12px',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            cursor: downloading && progress < 100 ? 'default' : 'pointer',
            opacity: downloading && progress < 100 ? 0.8 : 1,
            boxShadow: '0 4px 14px rgba(253, 186, 48, 0.3)'
          }}
        >
          {downloading && progress < 100 ? (
            <>
              <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} />
              <span>Descargando ({progress}%)...</span>
            </>
          ) : progress >= 100 ? (
            <>
              <Download size={15} strokeWidth={2.5} />
              <span>Abrir Instalador de Android</span>
            </>
          ) : (
            <>
              <Download size={15} strokeWidth={2.5} />
              <span>Actualizar Ahora</span>
            </>
          )}
        </button>
      </div>
    </div>,
    document.body
  );
};

export default AppUpdateModal;
