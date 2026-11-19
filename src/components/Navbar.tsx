import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  QrCode, 
  Plus, 
  ClipboardCheck, 
  LifeBuoy, 
  Sun, 
  Moon, 
  Bot, 
  LogOut,
  ChevronDown,
  X,
  RotateCw,
  CheckCircle2,
  Cloud,
  Share
} from 'lucide-react';
import { NotificationDropdown } from './NotificationDropdown';
import { AndroidIcon, AppleIcon } from './BrandIcons';
import type { AppNotification, AuthUser } from '../types';
import { checkAppVersion, APP_CURRENT_VERSION, APP_CURRENT_BUILD, triggerDirectApkInstall } from '../utils/appUpdateChecker';
import { useFadeModal } from '../utils/useFadeModal';
import { isNativeCapacitor } from '../services/api';

// Logotipo Corporativo Oficial UPN (Universidad Privada del Norte - TI)
// Emblema Vectorial Institucional con Corte Superior Horizontal y Alas Bipilares Hacia el Norte
export const UpnBrandLogo: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 22, color = '#FDBA30', className = '' }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill={color} 
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'block', flexShrink: 0 }}
  >
    {/* Pilar Izquierdo con Corte Superior Horizontal y Ala Norte UPN */}
    <path d="M11.4 2.5H9.4L4 7.9V11.1L8.55 7.9V22H11.4V2.5Z" />
    {/* Pilar Derecho con Corte Superior Horizontal y Ala Norte UPN */}
    <path d="M12.6 2.5H14.6L20 7.9V11.1L15.45 7.9V22H12.6V2.5Z" />
  </svg>
);

export type NavTab = 'dashboard' | 'inventory' | 'audit' | 'support' | 'agent';

interface NavbarProps {
  currentTab: NavTab;
  onChangeTab: (tab: NavTab) => void;
  onOpenScanner: () => void;
  onOpenAuditModal: () => void;
  onGoHome?: () => void;
  isLiveConnected?: boolean;
  totalDevices?: number;
  openTicketsCount?: number;
  currentTheme: string;
  onSelectTheme: (theme: string) => void;
  customColor?: string;
  onSelectCustomColor?: (color: string) => void;
  colorMode: 'dark' | 'light';
  onToggleColorMode: () => void;
  notifications?: AppNotification[];
  onSelectNotification?: (notification: AppNotification) => void;
  onMarkAllAsRead?: () => void;
  onClearAllNotifications?: () => void;
  onDismissNotification?: (id: string) => void;
  onGoToTickets?: () => void;
  currentUser?: AuthUser | null;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onChangeTab,
  onOpenScanner,
  onOpenAuditModal,
  onGoHome,
  isLiveConnected: _isLiveConnected = false,
  totalDevices: _totalDevices = 0,
  openTicketsCount = 0,
  currentTheme: _currentTheme,
  onSelectTheme: _onSelectTheme,
  customColor: _customColor = '#8b5cf6',
  onSelectCustomColor: _onSelectCustomColor,
  colorMode,
  onToggleColorMode,
  notifications = [],
  onSelectNotification,
  onMarkAllAsRead,
  onClearAllNotifications,
  onDismissNotification,
  onGoToTickets,
  currentUser,
  onLogout
}) => {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuFade = useFadeModal(userMenuOpen, () => setUserMenuOpen(false), 200, { isModal: false });
  const userMenuRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownCoords, setDropdownCoords] = useState({ top: 60, right: 16 });

  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateStatusModal, setUpdateStatusModal] = useState<{ type: string; version: string; build: number; isNative: boolean } | null>(null);
  const updateModalFade = useFadeModal(Boolean(updateStatusModal), () => setUpdateStatusModal(null), 200, { isModal: true });

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showIosModal, setShowIosModal] = useState(false);

  useEffect(() => {
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  useEffect(() => {
    if (userMenuOpen && userMenuRef.current) {
      const updateCoords = () => {
        if (!userMenuRef.current) return;
        const rect = userMenuRef.current.getBoundingClientRect();
        setDropdownCoords({
          top: rect.bottom + 8,
          right: Math.max(12, window.innerWidth - rect.right),
        });
      };
      updateCoords();
      window.addEventListener('resize', updateCoords);
      window.addEventListener('scroll', updateCoords, true);
      return () => {
        window.removeEventListener('resize', updateCoords);
        window.removeEventListener('scroll', updateCoords, true);
      };
    }
  }, [userMenuOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const clickedTrigger = userMenuRef.current && userMenuRef.current.contains(e.target as Node);
      const clickedMenu = dropdownRef.current && dropdownRef.current.contains(e.target as Node);
      if (!clickedTrigger && !clickedMenu) {
        setUserMenuOpen(false);
      }
    };
    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [userMenuOpen]);


  const handleInstallPwa = async () => {
    const w = window as any;
    const prompt = w.__pwaInstallPrompt || deferredPrompt;
    if (prompt) {
      prompt.prompt();
      try {
        const choice = await prompt.userChoice;
        if (choice?.outcome === 'accepted') {
          w.__pwaInstallPrompt = null;
          setDeferredPrompt(null);
          return;
        }
      } catch {}
    }
    setShowIosModal(true);
  };

  const handleCheckUpdate = async () => {
    setUserMenuOpen(false);
    setCheckingUpdate(true);
    try {
      const res = await checkAppVersion(true);
      if (res && res.isAvailable) {
        window.dispatchEvent(new CustomEvent('tayaudit:app-update-available', {
          detail: res
        }));
      } else {
        setUpdateStatusModal({
          type: 'up-to-date',
          version: res?.currentVersion || APP_CURRENT_VERSION,
          build: res?.currentBuild || APP_CURRENT_BUILD,
          isNative: res?.isNative ?? isNativeCapacitor()
        });
      }
    } catch (err) {
      console.warn('[Navbar] Error checking update:', err);
    } finally {
      setCheckingUpdate(false);
    }
  };

  const displayedUserName = (
    currentUser?.username && currentUser.username.toLowerCase() !== 'admin' && currentUser.username.toLowerCase() !== 'user'
      ? currentUser.username
      : (currentUser?.displayName && !currentUser.displayName.toLowerCase().includes('administrador del sistema'))
        ? currentUser.displayName.replace(/\s*\((Admin|Operador TI)\)/i, '')
        : 'Tayron Salinas'
  ).toUpperCase();

  return (
    <>
      <header className="acrylic-nav">
        <div className="acrylic-nav-inner">
        {/* Brand Logo Oficial UPN / Tay-Audit (Botón para Ir al Inicio sin modificar el diseño) */}
        <div 
          className="nav-brand-container"
          onClick={onGoHome}
          role="button"
          tabIndex={0}
          title="Ir al Inicio (UPN TI - Tay-Audit)"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onGoHome?.();
            }
          }}
        >
          <div 
            className="nav-brand-logo-box"
            title="Ir al Inicio"
          >
            <img 
              src="/icon.svg" 
              alt="UPN" 
              style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '8px' }} 
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="nav-brand-title">
              Tay-Audit
            </span>
            <span className="nav-brand-badge">
              UPN TI
            </span>
          </div>
        </div>

        {/* Center: Main Section Tabs (Desktop & Tablet) */}
        <div className="nav-tabs-container desktop-nav-tabs">
          {/* MODULO 1: INVENTARIO */}
          <button
            type="button"
            onClick={() => onChangeTab('audit')}
            className={`nav-tab-btn ${currentTab === 'audit' || currentTab === 'dashboard' || currentTab === 'inventory' ? 'nav-tab-active' : ''}`}
          >
            <ClipboardCheck size={14} />
            <span>Inventario</span>
          </button>

          {/* MODULO 2: ASISTENCIA */}
          <button
            type="button"
            onClick={() => onChangeTab('support')}
            className={`nav-tab-btn ${currentTab === 'support' ? 'nav-tab-active' : ''}`}
            style={{ position: 'relative' }}
          >
            <LifeBuoy size={14} />
            <span>Asistencia TI</span>
            {openTicketsCount > 0 && (
              <span
                className="nav-badge-pill"
                style={{
                  width: '20px',
                  height: '20px',
                  minWidth: '20px',
                  minHeight: '20px',
                  borderRadius: '50%',
                  aspectRatio: '1 / 1',
                  display: 'inline-grid',
                  placeItems: 'center',
                  marginLeft: '6px',
                  padding: 0,
                  boxSizing: 'border-box',
                  lineHeight: 1
                }}
              >
                <span className="nav-badge-number">{openTicketsCount}</span>
              </span>
            )}
          </button>

          {/* MODULO 3: STIVIE (Solo Icono de Robot) */}
          <button
            type="button"
            onClick={() => onChangeTab('agent')}
            className={`nav-tab-btn nav-tab-icon-only ${currentTab === 'agent' ? 'nav-tab-active' : ''}`}
            title="STIVIE - Instalador para PC Clientes"
            aria-label="STIVIE"
          >
            <Bot size={16} />
          </button>
        </div>

        {/* Right Controls: Grouped cleanly into Notifications, Theme Switch, and Unified User Capsule */}
        <div className="nav-controls-container">
          {/* NOTIFICACIONES EN VIVO ESTILO FACEBOOK */}
          <NotificationDropdown
            notifications={notifications}
            onSelectNotification={(n) => onSelectNotification?.(n)}
            onMarkAllAsRead={() => onMarkAllAsRead?.()}
            onClearAll={() => onClearAllNotifications?.()}
            onDismissNotification={(id) => onDismissNotification?.(id)}
            onGoToSupport={() => {
              if (onGoToTickets) {
                onGoToTickets();
              } else {
                onChangeTab('support');
              }
            }}
            onGoToTickets={onGoToTickets}
            openTicketsCount={openTicketsCount}
          />

          {/* UN SOLO BOTÓN DE USUARIO: CÁPSULA CON MENÚ DESPLEGABLE (ESTILO EXACTO STEEL-PRO1) */}
          {currentUser && (
            <div style={{ position: 'relative' }} ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className={`user-capsule-btn ${userMenuOpen ? 'open' : ''} ${currentUser.role === 'admin' ? 'admin' : 'operator'}`}
                title="Opciones de cuenta y sistema"
                aria-haspopup="true"
                aria-expanded={userMenuOpen}
              >
                <span className={`user-capsule-dot ${currentUser.role === 'admin' ? 'admin' : 'operator'}`} />
                <span className="user-capsule-name">
                  {displayedUserName}
                </span>
                <ChevronDown className={`user-capsule-chevron ${userMenuOpen ? 'rotated' : ''}`} size={14} />
              </button>

              {/* Menú Desplegable: Portaled a document.body para evitar clipping */}
              {userMenuFade.shouldRender && typeof document !== 'undefined' && createPortal(
                <div
                  ref={dropdownRef}
                  style={{
                    position: 'fixed',
                    top: `${dropdownCoords.top}px`,
                    right: `${dropdownCoords.right}px`,
                    backdropFilter: 'blur(36px) saturate(200%)',
                    WebkitBackdropFilter: 'blur(36px) saturate(200%)',
                  }}
                  className={`user-dropdown-window ${userMenuFade.dropdownClass}`}
                >
                  {/* Cabecera del Usuario */}
                  <div className="user-dropdown-header">
                    <div className="user-dropdown-title">
                      {displayedUserName}
                    </div>
                    <div className={`user-dropdown-subtitle ${currentUser.role === 'admin' ? 'admin' : 'operator'}`}>
                      {currentUser.role === 'admin' ? 'Modo Administrador' : 'Modo Asistente TI'} • Comas
                    </div>
                  </div>

                  {/* Fila de Iconos de Acciones (3 columnas) */}
                  <div className="user-dropdown-actions-grid">
                    {/* 1. Modo Claro / Oscuro */}
                    <button
                      type="button"
                      onClick={() => onToggleColorMode()}
                      className="user-dropdown-action-btn"
                      title={colorMode === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
                    >
                      {colorMode === 'dark' ? (
                        <Sun size={17} strokeWidth={2.2} color="#FDBA30" />
                      ) : (
                        <Moon size={17} strokeWidth={2.2} color="#334155" />
                      )}
                    </button>

                    {/* 2. Sincronizar / Estado Cloudflare */}
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof window !== 'undefined') {
                          window.dispatchEvent(new CustomEvent('tayaudit:refresh-data'));
                        }
                      }}
                      className="user-dropdown-action-btn"
                      title="Conexión en Vivo y Sincronización Cloudflare"
                    >
                      <Cloud size={17} strokeWidth={2.2} color="#38bdf8" />
                    </button>

                    {/* 3. Cerrar Sesión */}
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        onLogout?.();
                      }}
                      className="user-dropdown-action-btn logout"
                      title="Cerrar Sesión"
                    >
                      <LogOut size={17} strokeWidth={2.2} color="#f43f5e" />
                    </button>
                  </div>

                  {/* Sección de Instalación & Descargas (2 columnas + Buscar Actualización) */}
                  <div className="user-dropdown-downloads-section">
                    <div className="user-dropdown-downloads-grid">
                      {/* Descargar e Instalar APK Android */}
                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          triggerDirectApkInstall();
                        }}
                        className="user-dropdown-download-btn apk-android"
                        title="Descargar e Instalar APK Nativo para Android"
                      >
                        <AndroidIcon size={14} color="#3DDC84" />
                        <span>APK Android</span>
                      </button>

                      {/* Instalar WebApp / PWA (Apple) */}
                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          handleInstallPwa();
                        }}
                        className="user-dropdown-download-btn webapp-apple"
                        title="Instalar WebApp en Apple iOS (iPhone / iPad) o Safari"
                      >
                        <AppleIcon size={14} />
                        <span>WebApp Apple</span>
                      </button>
                    </div>

                    {/* Buscar Actualización (Línea Delgada con versión) */}
                    <button
                      type="button"
                      disabled={checkingUpdate}
                      onClick={handleCheckUpdate}
                      className="user-dropdown-update-btn"
                    >
                      <div className="user-dropdown-update-left">
                        <RotateCw size={13} strokeWidth={2.2} className={`user-dropdown-update-icon ${checkingUpdate ? 'spinning' : ''}`} />
                        <span>{checkingUpdate ? 'Verificando...' : 'Buscar actualización'}</span>
                      </div>
                      <span className="user-dropdown-version-tag">v{APP_CURRENT_VERSION}</span>
                    </button>
                  </div>
                </div>,
                document.body
              )}
            </div>
          )}
        </div>
        </div>
      </header>

      {/* Espaciador para reservar el alto exacto del encabezado fijo */}
      <div className="acrylic-nav-spacer" aria-hidden="true" />

      {/* Modal estilizado UPN para estado de actualización (Aplicación al Día) */}
      {updateModalFade.shouldRender && typeof document !== 'undefined' && createPortal(
        <div
          className={`upn-update-status-backdrop modal-backdrop-acrylic ${updateModalFade.backdropClass}`}
          onClick={() => updateModalFade.requestClose()}
        >
          <div
            className={`upn-update-status-window ${updateModalFade.modalClass}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="upn-update-status-icon-box">
              <CheckCircle2 size={26} strokeWidth={2.5} />
            </div>

            <div className="upn-update-status-header">
              <span className="upn-update-status-badge">
                Sistema al Día
              </span>
              <h3 className="upn-update-status-title">
                Aplicación al Día
              </h3>
            </div>

            <div className="upn-update-status-pill">
              <span className="upn-update-status-dot" />
              <span>v{updateStatusModal?.version || APP_CURRENT_VERSION} (Build {updateStatusModal?.build || APP_CURRENT_BUILD})</span>
            </div>

            <p className="upn-update-status-desc">
              Cuentas con la última versión oficial instalada. Todas las funciones de control y sincronización están activas.
            </p>

            <button
              type="button"
              onClick={() => updateModalFade.requestClose()}
              className="upn-update-status-btn"
            >
              Entendido
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Instructivo para Instalación en Apple iOS (Safari) */}
      {showIosModal && (
        <div 
          className="modal-backdrop-acrylic modal-centered-mobile"
          onClick={() => setShowIosModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            zIndex: 10090,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div
            className="acrylic-panel-elevated modal-window-acrylic"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '380px',
              width: '100%',
              padding: '22px',
              borderRadius: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              background: 'var(--bg-popover, #121216)',
              border: '1px solid var(--border-acrylic-active, rgba(253, 186, 48, 0.3))',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.85)',
              margin: 'auto'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AppleIcon size={20} color="var(--text-primary, #ffffff)" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)' }}>Instalar en iOS</h3>
                  <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>iPhone & iPad (Safari)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowIosModal(false)}
                className="btn-flat"
                style={{ padding: '6px', borderRadius: '8px' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.80rem', color: 'var(--text-secondary)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#FDBA30', color: '#000', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', flexShrink: 0, marginTop: '2px' }}>1</span>
                <div>En Safari, pulsa el botón <strong>Compartir</strong> <Share size={13} style={{ display: 'inline', margin: '0 3px', verticalAlign: 'middle', color: '#38bdf8' }} /> en la barra inferior.</div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#FDBA30', color: '#000', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', flexShrink: 0, marginTop: '2px' }}>2</span>
                <div>Desplázate y selecciona <strong>"Añadir a pantalla de inicio"</strong>.</div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#FDBA30', color: '#000', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', flexShrink: 0, marginTop: '2px' }}>3</span>
                <div>Pulsa <strong>Añadir</strong> en la esquina superior derecha. Se abrirá como app oficial.</div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowIosModal(false)}
              className="btn-flat btn-primary"
              style={{ width: '100%', padding: '10px', fontSize: '0.84rem', fontWeight: 900, justifyContent: 'center', borderRadius: '12px', background: '#FDBA30', color: '#000000' }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}



    {/* NATIVE MOBILE BOTTOM NAVIGATION BAR (Thumb-friendly & 100% Native Feel) */}
    <nav className="mobile-bottom-bar" aria-label="Navegación móvil principal">
      <button
        type="button"
        onClick={() => onChangeTab('audit')}
        className={`mobile-bottom-btn ${(currentTab === 'audit' || currentTab === 'dashboard' || currentTab === 'inventory') ? 'active' : ''}`}
      >
        <div className="mobile-btn-icon-wrapper">
          <ClipboardCheck size={20} />
        </div>
        <span>Inventario</span>
      </button>

      <button
        type="button"
        onClick={() => onChangeTab('support')}
        className={`mobile-bottom-btn ${currentTab === 'support' ? 'active' : ''}`}
      >
        <div className="mobile-btn-icon-wrapper">
          <LifeBuoy size={20} />
          {openTicketsCount > 0 && (
            <span className="mobile-bottom-badge">{openTicketsCount}</span>
          )}
        </div>
        <span>Asistencia TI</span>
      </button>

      {/* Central Floating Action: + Registrar */}
      <button
        type="button"
        onClick={onOpenAuditModal}
        className="mobile-center-action-btn"
        title="Registrar nuevo equipo en inventario"
        aria-label="Registrar nuevo equipo en inventario"
      >
        <Plus size={22} strokeWidth={2.8} />
      </button>

      <button
        type="button"
        onClick={onOpenScanner}
        className="mobile-bottom-btn"
      >
        <div className="mobile-btn-icon-wrapper">
          <QrCode size={20} />
        </div>
        <span>Escanear</span>
      </button>

      <button
        type="button"
        onClick={() => onChangeTab('agent')}
        className={`mobile-bottom-btn ${currentTab === 'agent' ? 'active' : ''}`}
        title="STIVIE"
      >
        <div className="mobile-btn-icon-wrapper">
          <Bot size={20} />
        </div>
        <span>STIVIE</span>
      </button>
    </nav>
  </>
  );
};
