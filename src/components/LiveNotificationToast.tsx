import React, { useEffect, useState } from 'react';
import { Headphones, X, ArrowRight } from 'lucide-react';
import type { AppNotification } from '../types';

interface LiveNotificationToastProps {
  notification: AppNotification | null;
  onClose: () => void;
  onAtender: (notification: AppNotification) => void;
}

export const LiveNotificationToast: React.FC<LiveNotificationToastProps> = ({
  notification,
  onClose,
  onAtender
}) => {
  const [progress, setProgress] = useState(100);
  const [isClosing, setIsClosing] = useState(false);

  const requestClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 220);
  };

  useEffect(() => {
    if (!notification) return;
    setProgress(100);

    const interval = 50;
    const duration = 7000; // 7 seconds auto-dismiss
    const decrement = (interval / duration) * 100;

    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          requestClose();
          return 0;
        }
        return prev - decrement;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [notification, isClosing]);

  if (!notification) return null;

  return (
    <div
      className={`live-toast-notification ${isClosing ? 'closing' : ''}`}
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 10002,
        maxWidth: '380px',
        width: 'calc(100vw - 40px)',
        borderRadius: '14px',
        backgroundColor: 'var(--bg-acrylic-popover, #0f172a)',
        color: 'var(--text-primary, #ffffff)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1.5px solid var(--accent-primary, #6366f1)',
        boxShadow: '0 20px 45px -10px rgba(0, 0, 0, 0.45), 0 0 20px rgba(99, 102, 241, 0.35)',
        overflow: 'hidden',
        animation: 'slideInRight 0.35s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        {/* Animated Chime Icon */}
        <div
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            backgroundColor: 'rgba(99, 102, 241, 0.2)',
            border: '1px solid var(--accent-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-primary)',
            flexShrink: 0,
            animation: 'pulse 1.8s infinite'
          }}
        >
          <Headphones size={20} />
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
            <span
              style={{
                fontSize: '0.62rem',
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                padding: '2px 6px',
                borderRadius: '4px',
                backgroundColor: '#ef4444',
                color: '#ffffff'
              }}
            >
              Nuevo Ticket STIVIE
            </span>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              {notification.ticketId}
            </span>
          </div>

          <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '3px' }}>
            {notification.userName || 'Usuario Docente'}{' '}
            <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              ({notification.hostname})
            </span>
          </div>

          <div
            style={{
              fontSize: '0.74rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.35,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              marginBottom: '10px'
            }}
          >
            "{notification.description}"
          </div>

          {/* Quick Action Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => onAtender(notification)}
              className="btn-primary"
              style={{
                padding: '5px 12px',
                fontSize: '0.74rem',
                fontWeight: 800,
                borderRadius: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer'
              }}
            >
              <span>Atender Ahora</span>
              <ArrowRight size={13} />
            </button>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              {notification.category}
            </span>
          </div>
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={requestClose}
          className="btn-flat"
          style={{ width: '22px', height: '22px', padding: 0, borderRadius: '4px', color: 'var(--text-muted)' }}
          title="Cerrar aviso"
        >
          <X size={13} />
        </button>
      </div>

      {/* Progress countdown bar */}
      <div style={{ width: '100%', height: '3px', backgroundColor: 'rgba(255, 255, 255, 0.08)' }}>
        <div
          style={{
            height: '100%',
            width: `${progress}%`,
            backgroundColor: 'var(--accent-primary, #6366f1)',
            transition: 'width 0.05s linear'
          }}
        />
      </div>
    </div>
  );
};
