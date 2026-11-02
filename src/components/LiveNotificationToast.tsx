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
    <div className={`live-toast-notification ${isClosing ? 'closing' : ''}`}>
      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        {/* Animated Chime Icon */}
        <div className="live-toast-icon-box">
          <Headphones size={20} strokeWidth={2.4} />
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
            <span className="live-toast-badge">
              Nuevo Ticket STIVIE
            </span>
            <span className="live-toast-meta">
              {notification.ticketId}
            </span>
          </div>

          <div style={{ marginBottom: '4px' }}>
            <span className="live-toast-user">{notification.userName || 'Usuario Docente'}</span>{' '}
            <span className="live-toast-host">({notification.hostname})</span>
          </div>

          <div className="live-toast-desc">
            "{notification.description}"
          </div>

          {/* Quick Action Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => onAtender(notification)}
              className="btn-primary"
              style={{
                padding: '6px 14px',
                fontSize: '0.74rem',
                fontWeight: 800,
                borderRadius: '8px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer'
              }}
            >
              <span>Atender Ahora</span>
              <ArrowRight size={13} strokeWidth={2.5} />
            </button>
            <span className="live-toast-meta">
              {notification.category}
            </span>
          </div>
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={requestClose}
          className="modal-close-btn"
          style={{ width: '28px', height: '28px', minWidth: '28px', minHeight: '28px' }}
          title="Cerrar aviso"
          aria-label="Cerrar aviso"
        >
          <X size={14} strokeWidth={2.4} />
        </button>
      </div>

      {/* Progress countdown bar */}
      <div className="live-toast-progress-track">
        <div
          className="live-toast-progress-bar"
          style={{
            width: `${progress}%`
          }}
        />
      </div>
    </div>
  );
};
