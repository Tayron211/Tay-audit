import React, { useState, useRef, useEffect } from 'react';
import { 
  QrCode, 
  Plus, 
  ClipboardCheck, 
  LifeBuoy, 
  Sun, 
  Moon, 
  Bot, 
  ShieldCheck,
  User,
  LogOut,
  ChevronDown,
  Smartphone,
  Download,
  X
} from 'lucide-react';
import { NotificationDropdown } from './NotificationDropdown';
import { AndroidIcon, AppleIcon } from './BrandIcons';
import type { AppNotification, AuthUser } from '../types';

// Logotipo Corporativo Oficial UPN (Universidad Privada del Norte - TI)
// Emblema Vectorial Institucional con Corte Superior Horizontal y Alas Bipilares Hacia el Norte
export const UpnBrandLogo: React.FC<{ size?: number; color?: string }> = ({ size = 22, color = '#0B132B' }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill={color} 
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
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isUserMenuClosing, setIsUserMenuClosing] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const [showInstallModal, setShowInstallModal] = useState(false);

  const handleInstallClick = async () => {
    const prompt = (window as any).__pwaInstallPrompt;
    if (prompt) {
      prompt.prompt();
      try {
        const choice = await prompt.userChoice;
        if (choice && choice.outcome === 'accepted') {
          (window as any).__pwaInstallPrompt = null;
          return;
        }
      } catch {}
    }
    setShowInstallModal(true);
  };

  const closeUserMenu = () => {
    if (isUserMenuClosing || !isUserMenuOpen) return;
    setIsUserMenuClosing(true);
    setTimeout(() => {
      setIsUserMenuClosing(false);
      setIsUserMenuOpen(false);
    }, 180);
  };

  const toggleUserMenu = () => {
    if (isUserMenuOpen) {
      closeUserMenu();
    } else {
      setIsUserMenuOpen(true);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        closeUserMenu();
      }
    };
    if (isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isUserMenuOpen, isUserMenuClosing]);

  return (
    <>
      <header className="acrylic-nav">
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
            <UpnBrandLogo size={18} color="#0B132B" />
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

        {/* Right Controls: Grouped cleanly into Action Tools, Appearance, Notifications, and Unified User Capsule */}
        <div className="nav-controls-container">
          {/* Audit Device Button (Primary Action - First on desktop, hidden on mobile) */}
          <button
            type="button"
            onClick={onOpenAuditModal}
            className="btn-flat btn-primary hide-on-mobile nav-register-btn"
            title="Registrar nuevo equipo en inventario"
          >
            <Plus size={14} />
            <span>Registrar</span>
          </button>

          {/* BOTÓN DIRECTO: MODO OSCURO / MODO CLARO */}
          <button
            type="button"
            onClick={onToggleColorMode}
            className="btn-flat"
            style={{
              height: '36px',
              padding: '0 10px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '10px',
              border: '1px solid var(--border-acrylic)',
              backgroundColor: 'rgba(148, 163, 184, 0.08)',
              cursor: 'pointer',
              transition: 'all 0.18s ease'
            }}
            title={colorMode === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
            aria-label="Cambiar modo de pantalla"
          >
            {colorMode === 'dark' ? (
              <Moon size={16} color="var(--accent-primary)" />
            ) : (
              <Sun size={16} color="var(--accent-primary)" />
            )}
          </button>

        {/* NOTIFICACIONES EN VIVO ESTILO FACEBOOK (MÁXIMO 5 CON ALERTA TEMPORAL) */}
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

        {/* UN SOLO BOTÓN DE USUARIO: AL DAR TAP DESPLIEGA EL MENÚ CON SALIR */}
        {currentUser && (
          <div style={{ position: 'relative' }} ref={userMenuRef}>
            <button
              type="button"
              onClick={toggleUserMenu}
              className="btn-flat nav-user-btn"
              style={{
                height: '36px',
                padding: '0 10px',
                borderRadius: '10px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: isUserMenuOpen 
                  ? (currentUser.role === 'admin' ? 'rgba(255, 184, 0, 0.22)' : 'rgba(56, 189, 248, 0.22)')
                  : (currentUser.role === 'admin' ? 'rgba(255, 184, 0, 0.12)' : 'rgba(56, 189, 248, 0.12)'),
                border: isUserMenuOpen 
                  ? (currentUser.role === 'admin' ? '1px solid #FFB800' : '1px solid #38bdf8')
                  : (currentUser.role === 'admin' ? '1px solid rgba(255, 184, 0, 0.32)' : '1px solid rgba(56, 189, 248, 0.32)'),
                color: currentUser.role === 'admin' ? 'var(--accent-primary, #FFB800)' : '#38bdf8',
                fontSize: '0.76rem',
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                userSelect: 'none'
              }}
              title={currentUser.role === 'admin' ? 'Sesión: Administrador (Click para opciones)' : 'Sesión: Operador TI (Click para opciones)'}
              aria-haspopup="true"
              aria-expanded={isUserMenuOpen}
            >
              {currentUser.role === 'admin' ? <ShieldCheck size={14} /> : <User size={14} />}
              <span>{currentUser.username}</span>
              <ChevronDown 
                size={12} 
                style={{ 
                  transition: 'transform 0.2s ease', 
                  transform: isUserMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  opacity: 0.8
                }} 
              />
            </button>

            {/* Menú Desplegable de Usuario (Al dar Tap) */}
            {(isUserMenuOpen || isUserMenuClosing) && (
              <div
                className={`acrylic-popover ${isUserMenuClosing ? 'closing' : ''}`}
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  right: 0,
                  width: '210px',
                  padding: '8px',
                  borderRadius: '14px',
                  zIndex: 1000,
                  boxShadow: '0 12px 36px rgba(0,0,0,0.45)'
                }}
              >
                {/* Cabecera del Usuario */}
                <div style={{ padding: '8px 10px 10px 10px', borderBottom: '1px solid var(--border-acrylic)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: currentUser.role === 'admin' ? 'rgba(255, 184, 0, 0.16)' : 'rgba(56, 189, 248, 0.16)',
                        color: currentUser.role === 'admin' ? '#FFB800' : '#38bdf8'
                      }}
                    >
                      {currentUser.role === 'admin' ? <ShieldCheck size={16} /> : <User size={16} />}
                    </div>
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontWeight: 800, fontSize: '0.82rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                        {currentUser.username}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        {currentUser.role === 'admin' ? 'Administrador' : 'Operador TI'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Opción de Instalar como WebApp Nativa */}
                <div style={{ marginTop: '4px', borderTop: '1px solid var(--border-acrylic)', paddingTop: '4px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      closeUserMenu();
                      handleInstallClick();
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-primary)',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 184, 0, 0.12)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <Smartphone size={14} color="var(--accent-primary)" />
                    <span>Instalar en el Móvil</span>
                  </button>
                </div>

                {/* Opción de Salir / Cerrar Sesión */}
                {onLogout && (
                  <div style={{ marginTop: '2px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        closeUserMenu();
                        setTimeout(() => onLogout(), 160);
                      }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        border: 'none',
                        background: 'transparent',
                        color: '#ef4444',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.12)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <LogOut size={14} />
                      <span>Cerrar Sesión</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </header>

    {/* MODAL GUÍA PARA INSTALAR COMO APP NATIVA (PWA / APK) */}
    {showInstallModal && (
      <div 
        className="modal-backdrop-acrylic modal-centered-mobile"
        onClick={() => setShowInstallModal(false)}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(7, 12, 30, 0.85)',
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
            maxWidth: '440px',
            width: '100%',
            padding: '24px',
            borderRadius: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            background: 'var(--bg-popover, #0B132B)',
            border: '1px solid var(--border-acrylic-active, rgba(255, 184, 0, 0.3))',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.85), 0 0 25px rgba(255, 184, 0, 0.15)',
            margin: 'auto'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(255, 184, 0, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Smartphone size={18} color="var(--accent-primary, #FFB800)" />
              </div>
              <span>Instalar como App en tu Móvil</span>
            </div>
            <button
              type="button"
              onClick={() => setShowInstallModal(false)}
              className="btn-flat"
              style={{ padding: '6px', borderRadius: '8px' }}
            >
              <X size={16} />
            </button>
          </div>

          <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5, display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Android Card con Logo Oficial Android */}
            <div style={{ padding: '14px', borderRadius: '14px', background: 'rgba(61, 220, 132, 0.08)', border: '1px solid rgba(61, 220, 132, 0.28)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AndroidIcon size={20} color="#3DDC84" />
                <strong style={{ color: '#3DDC84', fontSize: '0.88rem' }}>
                  Android (.APK)
                </strong>
              </div>
              <a 
                href="/TayAudit.apk" 
                download="TayAudit.apk"
                className="btn-flat btn-primary"
                style={{ padding: '6px 14px', fontSize: '0.78rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Download size={14} />
                <span>Descargar TayAudit.apk</span>
              </a>
            </div>

            {/* Apple iOS Card con Logo Oficial Apple */}
            <div style={{ padding: '14px', borderRadius: '14px', background: 'rgba(255, 255, 255, 0.06)', border: '1px solid rgba(255, 255, 255, 0.16)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                <AppleIcon size={18} color="var(--text-primary, #ffffff)" />
                <strong style={{ color: 'var(--text-primary)', fontSize: '0.88rem' }}>
                  Apple iOS (iPhone / iPad)
                </strong>
              </div>
              <span style={{ fontSize: '0.80rem', lineHeight: 1.5 }}>
                1. Toca el botón <strong>Compartir</strong> en Safari.<br />
                2. Selecciona <strong>"Añadir a pantalla de inicio"</strong>.
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowInstallModal(false)}
            className="btn-flat btn-primary"
            style={{ width: '100%', padding: '10px', fontSize: '0.84rem', fontWeight: 800, justifyContent: 'center' }}
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
