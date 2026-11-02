import React, { useState, useRef, useEffect } from 'react';
import { 
  Bell, 
  CheckCheck, 
  Trash2, 
  Clock, 
  X, 
  ChevronRight,
  Headphones,
  BellRing
} from 'lucide-react';
import type { AppNotification } from '../types';
import { getSystemNotificationPermission, requestPushNotificationPermission } from '../utils/pushNotifications';

interface NotificationDropdownProps {
  notifications: AppNotification[];
  onSelectNotification: (notification: AppNotification) => void;
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
  onDismissNotification: (id: string) => void;
  onGoToSupport: () => void;
  onGoToTickets?: () => void;
  openTicketsCount: number;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({
  notifications,
  onSelectNotification,
  onMarkAllAsRead,
  onClearAll,
  onDismissNotification,
  onGoToSupport,
  onGoToTickets,
  openTicketsCount
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const unreadCount = notifications.filter(n => !n.read).length;
  const [pushPermission, setPushPermission] = useState<string>(() => getSystemNotificationPermission());

  const handleEnablePush = async () => {
    const granted = await requestPushNotificationPermission();
    setPushPermission(granted ? 'granted' : 'denied');
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'critica':
      case 'alta':
        return '#ef4444';
      case 'media':
        return '#f59e0b';
      default:
        return '#3b82f6';
    }
  };

  const formatRelativeTime = (dateStr: string): string => {
    try {
      const diffMs = Date.now() - new Date(dateStr).getTime();
      const diffSec = Math.floor(diffMs / 1000);
      if (diffSec < 45) return 'Hace unos segundos';
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `Hace ${diffMin} min`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `Hace ${diffHours} h`;
      return new Date(dateStr).toLocaleDateString([], { day: '2-digit', month: 'short' });
    } catch {
      return 'Reciente';
    }
  };

  return (
    <div style={{ position: 'relative' }} ref={containerRef}>
      {/* Botón de Campana estilo Facebook con Badge de Nuevas */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="btn-flat"
        style={{
          position: 'relative',
          width: '36px',
          height: '36px',
          padding: 0,
          borderRadius: '10px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: isOpen ? '1px solid var(--accent-primary)' : '1px solid var(--border-acrylic)',
          backgroundColor: isOpen ? 'rgba(148, 163, 184, 0.16)' : 'rgba(148, 163, 184, 0.08)',
          color: unreadCount > 0 ? 'var(--text-primary)' : 'var(--text-secondary)',
          cursor: 'pointer',
          transition: 'all 0.18s ease'
        }}
        title="Notificaciones de tickets e incidencias en vivo"
        aria-label="Notificaciones"
        aria-expanded={isOpen}
      >
        <Bell size={17} />

        {/* Badge contador circular estilo Facebook */}
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-3px',
              right: '-3px',
              backgroundColor: '#ef4444',
              color: '#ffffff',
              fontSize: '0.62rem',
              fontWeight: 900,
              minWidth: '18px',
              height: '18px',
              borderRadius: '9px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
              border: '2px solid var(--bg-canvas)',
              boxShadow: '0 0 10px rgba(239, 68, 68, 0.55)',
              animation: 'pulse 2s infinite'
            }}
          >
            {unreadCount > 5 ? '5+' : unreadCount}
          </span>
        )}
      </button>

      {/* Menú Desplegable Estilo Facebook (Máximo 5 notificaciones) */}
      {isOpen && (
        <>
          <div
            className="notification-backdrop-mobile"
            onClick={() => setIsOpen(false)}
          />
          <div
            className="acrylic-popover notification-popover"
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              width: '360px',
              maxWidth: '92vw',
              borderRadius: '16px',
              boxShadow: '0 12px 36px -4px rgba(0, 0, 0, 0.35), 0 0 0 1px var(--border-acrylic)',
              backgroundColor: 'var(--bg-acrylic-popover)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              zIndex: 1100,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
          {/* Header estilo Facebook */}
          <div
            style={{
              padding: '14px 16px',
              borderBottom: '1px solid var(--border-acrylic)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'rgba(148, 163, 184, 0.04)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                Notificaciones
              </span>
              {unreadCount > 0 && (
                <span
                  style={{
                    fontSize: '0.66rem',
                    fontWeight: 800,
                    padding: '2px 7px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    color: '#ef4444'
                  }}
                >
                  {unreadCount} nueva{unreadCount > 1 ? 's' : ''}
                </span>
              )}
            </div>

            {notifications.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={onMarkAllAsRead}
                    className="btn-flat"
                    style={{ padding: '3px 8px', fontSize: '0.68rem', fontWeight: 700, gap: '4px' }}
                    title="Marcar todas como leídas"
                  >
                    <CheckCheck size={12} />
                    <span>Leídas</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClearAll}
                  className="btn-flat"
                  style={{ padding: '3px 6px', fontSize: '0.68rem', color: 'var(--text-secondary)' }}
                  title="Limpiar historial"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            )}
          </div>

          {/* Banner de Activación de Notificaciones Push (Windows y Móviles) */}
          {pushPermission !== 'granted' && pushPermission !== 'unsupported' && (
            <div
              style={{
                padding: '8px 14px',
                backgroundColor: 'rgba(255, 184, 0, 0.08)',
                borderBottom: '1px solid var(--border-acrylic)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BellRing size={14} color="#FFB800" />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                  Activar alertas Windows y Móvil
                </span>
              </div>
              <button
                type="button"
                onClick={handleEnablePush}
                className="btn-flat btn-primary"
                style={{ padding: '3px 9px', fontSize: '0.68rem', fontWeight: 800, whiteSpace: 'nowrap' }}
              >
                Activar
              </button>
            </div>
          )}

          {/* Lista de Notificaciones (Top 5 más recientes) */}
          <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div
                style={{
                  padding: '36px 20px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  color: 'var(--text-secondary)'
                }}
              >
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(148, 163, 184, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-muted)'
                  }}
                >
                  <Bell size={20} />
                </div>
                <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Sin notificaciones pendientes
                </span>
                <span style={{ fontSize: '0.72rem', maxWidth: '240px', lineHeight: 1.35 }}>
                  Los tickets e incidencias reportadas por clientes y docentes en STIVIE aparecerán aquí en tiempo real.
                </span>
              </div>
            ) : (
              <div>
                {notifications.map(n => {
                  const urgencyCol = getUrgencyColor(n.urgency);
                  return (
                    <div
                      key={n.id}
                      onClick={() => {
                        onSelectNotification(n);
                        setIsOpen(false);
                      }}
                      style={{
                        padding: '12px 14px',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                        cursor: 'pointer',
                        borderBottom: '1px solid var(--border-acrylic)',
                        backgroundColor: !n.read 
                          ? 'rgba(99, 102, 241, 0.08)' 
                          : 'transparent',
                        transition: 'background-color 0.15s ease',
                        position: 'relative'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = !n.read 
                          ? 'rgba(99, 102, 241, 0.14)' 
                          : 'rgba(148, 163, 184, 0.06)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = !n.read 
                          ? 'rgba(99, 102, 241, 0.08)' 
                          : 'transparent';
                      }}
                    >
                      {/* Avatar / Ícono de la notificación */}
                      <div
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '50%',
                          backgroundColor: `${urgencyCol}18`,
                          border: `1.5px solid ${urgencyCol}40`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: urgencyCol,
                          flexShrink: 0,
                          position: 'relative'
                        }}
                      >
                        <Headphones size={18} />
                        <span
                          style={{
                            position: 'absolute',
                            bottom: '-2px',
                            right: '-2px',
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            backgroundColor: urgencyCol,
                            border: '2px solid var(--bg-canvas)'
                          }}
                        />
                      </div>

                      {/* Contenido de la notificación estilo Facebook */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)', lineHeight: 1.35, marginBottom: '2px' }}>
                          <strong style={{ color: 'var(--text-primary)', fontWeight: 800 }}>
                            {n.userName || 'Usuario Docente'}
                          </strong>{' '}
                          envió un ticket desde{' '}
                          <strong style={{ fontFamily: 'monospace', color: 'var(--accent-primary)' }}>
                            {n.hostname}
                          </strong>
                        </div>

                        {/* Extracto de la incidencia */}
                        <div
                          style={{
                            fontSize: '0.72rem',
                            color: 'var(--text-secondary)',
                            lineHeight: 1.3,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            marginBottom: '4px'
                          }}
                        >
                          "{n.description}"
                        </div>

                        {/* Metadatos: Categoría y Tiempo Relativo */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.66rem', color: 'var(--text-muted)' }}>
                          <span
                            style={{
                              padding: '1px 5px',
                              borderRadius: '4px',
                              backgroundColor: 'rgba(148, 163, 184, 0.12)',
                              color: 'var(--text-primary)',
                              fontWeight: 700
                            }}
                          >
                            {n.category || 'General'}
                          </span>
                          <span>•</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <Clock size={10} />
                            {formatRelativeTime(n.timestamp)}
                          </span>
                        </div>
                      </div>

                      {/* Indicador azul de no leída estilo FB + Botón Descartar */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        {!n.read && (
                          <span
                            style={{
                              width: '9px',
                              height: '9px',
                              borderRadius: '50%',
                              backgroundColor: '#2563eb',
                              boxShadow: '0 0 8px rgba(37, 99, 235, 0.8)',
                              display: 'inline-block'
                            }}
                            title="No leída"
                          />
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDismissNotification(n.id);
                          }}
                          className="btn-flat"
                          style={{
                            width: '20px',
                            height: '20px',
                            padding: 0,
                            borderRadius: '4px',
                            color: 'var(--text-muted)'
                          }}
                          title="Eliminar del historial"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer estilo Facebook */}
          <div
            style={{
              padding: '10px 14px',
              borderTop: '1px solid var(--border-acrylic)',
              backgroundColor: 'rgba(148, 163, 184, 0.04)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                if (onGoToTickets) {
                  onGoToTickets();
                } else {
                  onGoToSupport();
                }
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent-primary)',
                fontSize: '0.74rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
                padding: '4px 0',
                width: '100%',
                justifyContent: 'center'
              }}
            >
              <span>Ver todos los tickets de soporte ({openTicketsCount} abiertos)</span>
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
        </>
      )}
    </div>
  );
};
