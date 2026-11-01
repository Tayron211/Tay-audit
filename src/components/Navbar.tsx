import React, { useState, useRef, useEffect } from 'react';
import { 
  QrCode, 
  Plus, 
  ClipboardCheck, 
  LifeBuoy, 
  Palette, 
  Sun, 
  Moon, 
  Bot, 
  Check,
  Sparkles
} from 'lucide-react';
import { computeIntelligentContrast } from '../utils/theme';
import { NotificationDropdown } from './NotificationDropdown';
import type { AppNotification } from '../types';

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
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onChangeTab,
  onOpenScanner,
  onOpenAuditModal,
  onGoHome,
  isLiveConnected: _isLiveConnected,
  totalDevices: _totalDevices = 0,
  openTicketsCount = 0,
  currentTheme,
  onSelectTheme,
  customColor = '#8b5cf6',
  onSelectCustomColor,
  colorMode,
  onToggleColorMode,
  notifications = [],
  onSelectNotification,
  onMarkAllAsRead,
  onClearAllNotifications,
  onDismissNotification
}) => {
  const [isColorDropdownOpen, setIsColorDropdownOpen] = useState(false);
  const colorDropdownRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (colorDropdownRef.current && !colorDropdownRef.current.contains(event.target as Node)) {
        setIsColorDropdownOpen(false);
      }
    };
    if (isColorDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isColorDropdownOpen]);

  const themes = [
    { id: 'upn', label: 'UPN Oro Lúcuma', color: '#ffb800' },
    { id: 'violet', label: 'Violet Mica', color: '#8b5cf6' },
    { id: 'azure', label: 'Glacier Blue', color: '#0284c7' },
    { id: 'indigo', label: 'Deep Indigo', color: '#6366f1' },
    { id: 'emerald', label: 'Cyber Emerald', color: '#10b981' },
    { id: 'teal', label: 'Mint Teal', color: '#0d9488' },
    { id: 'amber', label: 'Titanium Amber', color: '#d97706' },
    { id: 'rose', label: 'Crimson Ruby', color: '#e11d48' },
    { id: 'slate', label: 'Graphite Slate', color: '#475569' },
  ];

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

        {/* Right Controls: Grouped cleanly into Appearance Capsule and Action Tools */}
        <div className="nav-controls-container">
        {/* UN SOLO BOTÓN: APARIENCIA Y TEMA */}
        <div style={{ position: 'relative' }} ref={colorDropdownRef}>
          <button
            type="button"
            onClick={() => setIsColorDropdownOpen(prev => !prev)}
            className="btn-flat"
            style={{
              padding: '7px 9px',
              borderRadius: '10px',
              gap: '6px',
              border: isColorDropdownOpen ? '1px solid var(--accent-primary)' : '1px solid var(--border-acrylic)',
              backgroundColor: isColorDropdownOpen ? 'rgba(148, 163, 184, 0.16)' : 'rgba(148, 163, 184, 0.08)'
            }}
            title="Personalizar apariencia y colores"
            aria-haspopup="true"
            aria-expanded={isColorDropdownOpen}
          >
            <Palette size={16} color={currentTheme === 'custom' ? customColor : (themes.find(t => t.id === currentTheme)?.color || '#8b5cf6')} />
            <span 
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: currentTheme === 'custom' ? customColor : (themes.find(t => t.id === currentTheme)?.color || '#8b5cf6'),
                boxShadow: `0 0 6px ${currentTheme === 'custom' ? customColor : (themes.find(t => t.id === currentTheme)?.color || '#8b5cf6')}`,
                display: 'inline-block'
              }}
            />
          </button>

          {/* Desplegable de Apariencia & Tema (Limpio, sin texto de pantone ni botón aplicar) */}
          {isColorDropdownOpen && (
            <div 
              className="acrylic-popover"
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                width: '240px',
                padding: '14px',
                borderRadius: '16px',
                zIndex: 1000,
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                animation: 'fadeIn 0.18s ease'
              }}
            >
              {/* Header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: '8px',
                borderBottom: '1px solid var(--border-acrylic)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <Palette size={15} color="var(--accent-primary)" />
                  <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Apariencia y Tema
                  </span>
                </div>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  {colorMode === 'dark' ? 'Oscuro' : 'Claro'}
                </span>
              </div>

              {/* 1. Selector de Modo: Claro / Oscuro */}
              <div>
                <div style={{
                  fontSize: '0.66rem',
                  fontWeight: 800,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}>
                  {colorMode === 'dark' ? <Moon size={11} /> : <Sun size={11} />}
                  <span>Modo de Pantalla</span>
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '6px',
                  background: 'rgba(148, 163, 184, 0.08)',
                  padding: '3px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-acrylic)'
                }}>
                  <button
                    type="button"
                    onClick={() => colorMode !== 'dark' && onToggleColorMode()}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                      padding: '6px 8px',
                      borderRadius: '8px',
                      border: colorMode === 'dark' ? '1px solid var(--accent-primary)' : '1px solid transparent',
                      background: colorMode === 'dark' ? 'var(--accent-primary)' : 'transparent',
                      color: colorMode === 'dark' ? 'var(--accent-contrast, #000000)' : 'var(--text-secondary)',
                      fontWeight: 700,
                      fontSize: '0.74rem',
                      cursor: 'pointer',
                      transition: 'all 0.18s ease'
                    }}
                  >
                    <Moon size={12} />
                    <span>Oscuro</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => colorMode !== 'light' && onToggleColorMode()}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                      padding: '6px 8px',
                      borderRadius: '8px',
                      border: colorMode === 'light' ? '1px solid var(--accent-primary)' : '1px solid transparent',
                      background: colorMode === 'light' ? 'var(--accent-primary)' : 'transparent',
                      color: colorMode === 'light' ? 'var(--accent-contrast, #000000)' : 'var(--text-secondary)',
                      fontWeight: 700,
                      fontSize: '0.74rem',
                      cursor: 'pointer',
                      transition: 'all 0.18s ease'
                    }}
                  >
                    <Sun size={12} />
                    <span>Claro</span>
                  </button>
                </div>
              </div>

              {/* Temas Predeterminados y Color Personalizado en Círculos */}
              <div>
                <div style={{
                  fontSize: '0.66rem',
                  fontWeight: 800,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '8px'
                }}>
                  Colores del Sistema
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(5, 1fr)',
                  gap: '8px',
                  justifyItems: 'center',
                  alignItems: 'center'
                }}>
                  {themes.map(t => {
                    const isSelected = currentTheme === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => onSelectTheme(t.id)}
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          backgroundColor: t.color,
                          border: isSelected ? '2.5px solid #ffffff' : '2px solid rgba(255, 255, 255, 0.18)',
                          boxShadow: isSelected ? `0 0 10px ${t.color}` : '0 2px 5px rgba(0, 0, 0, 0.25)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.18s ease',
                          transform: isSelected ? 'scale(1.14)' : 'scale(1)',
                          padding: 0
                        }}
                        title={t.label}
                        aria-label={t.label}
                      >
                        {isSelected && <Check size={14} color={computeIntelligentContrast(t.id)} strokeWidth={3} />}
                      </button>
                    );
                  })}

                  {/* 9no Círculo: Botón de Color Personalizado con selector nativo instantáneo */}
                  <label
                    style={{
                      position: 'relative',
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: currentTheme === 'custom' 
                        ? customColor 
                        : 'conic-gradient(from 180deg at 50% 50%, #f43f5e, #eab308, #22c55e, #06b6d4, #8b5cf6, #ec4899, #f43f5e)',
                      border: currentTheme === 'custom' ? '2.5px solid #ffffff' : '2px dashed rgba(255, 255, 255, 0.5)',
                      boxShadow: currentTheme === 'custom' ? `0 0 10px ${customColor}` : '0 2px 5px rgba(0, 0, 0, 0.25)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.18s ease',
                      transform: currentTheme === 'custom' ? 'scale(1.14)' : 'scale(1)',
                      flexShrink: 0
                    }}
                    title="Elegir color personalizado"
                  >
                    {currentTheme === 'custom' ? (
                      <Check size={14} color={computeIntelligentContrast('custom', customColor)} strokeWidth={3} style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))' }} />
                    ) : (
                      <Sparkles size={13} color="#ffffff" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))' }} />
                    )}
                    <input
                      type="color"
                      value={customColor || '#8b5cf6'}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (onSelectCustomColor) onSelectCustomColor(val);
                      }}
                      style={{
                        position: 'absolute',
                        opacity: 0,
                        width: '100%',
                        height: '100%',
                        top: 0,
                        left: 0,
                        cursor: 'pointer'
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* NOTIFICACIONES EN VIVO ESTILO FACEBOOK (MÁXIMO 5 CON ALERTA TEMPORAL) */}
        <NotificationDropdown
          notifications={notifications}
          onSelectNotification={(n) => onSelectNotification?.(n)}
          onMarkAllAsRead={() => onMarkAllAsRead?.()}
          onClearAll={() => onClearAllNotifications?.()}
          onDismissNotification={(id) => onDismissNotification?.(id)}
          onGoToSupport={() => onChangeTab('support')}
          openTicketsCount={openTicketsCount}
        />

        {/* Audit Device Button */}
        <button
          type="button"
          onClick={onOpenAuditModal}
          className="btn-flat btn-primary hide-on-mobile nav-register-btn"
          title="Registrar nuevo equipo en inventario"
        >
          <Plus size={14} />
          <span>Registrar</span>
        </button>
      </div>
    </header>



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
