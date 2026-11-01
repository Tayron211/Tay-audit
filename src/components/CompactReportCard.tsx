import React, { useState, useRef, useLayoutEffect, useEffect } from 'react';
import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  ExternalLink,
  ChevronDown,
  Sparkles,
  Bot,
  Send,
  Monitor,
  ScreenShare,
  RotateCw,
  Power,
  Copy,
  Check
} from 'lucide-react';
import type { SupportTicket, Device } from '../types';
import { api } from '../services/api';
import { scrollElementIntoView } from '../utils/autoScroll';

interface CompactReportCardProps {
  ticket: SupportTicket;
  devices: Device[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdateStatus: (ticketId: string, status: 'abierto' | 'en_progreso' | 'resuelto', notes?: string) => Promise<void>;
  onDuplicateScreen: (hostname: string) => Promise<void>;
  onSelectDevice?: (device: Device) => void;
}
/** Alto fijo de toda tarjeta colapsada: garantiza una grilla perfectamente simétrica con espacio holgado para ID y Fecha. */
const COLLAPSED_HEIGHT = 252;

export const CompactReportCard: React.FC<CompactReportCardProps> = ({
  ticket,
  devices,
  isExpanded,
  onToggleExpand,
  onUpdateStatus,
  onDuplicateScreen,
  onSelectDevice
}) => {
  const [solutionText, setSolutionText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResolveForm, setShowResolveForm] = useState(false);
  const [remoteLoading, setRemoteLoading] = useState<string | null>(null);
  const [remoteFeedback, setRemoteFeedback] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  const handleCopyTicketId = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(String(ticket.id).toUpperCase());
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // Expansión tipo overlay: la tarjeta mantiene un tamaño fijo en la grilla y,
  // al desplegarse, crece por encima de las demás sin empujarlas.
  const cardRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number>(COLLAPSED_HEIGHT);
  const [raised, setRaised] = useState(false);

  useLayoutEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    setContentHeight(el.offsetHeight);
    const ro = new ResizeObserver(() => setContentHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Mantiene la tarjeta por encima mientras dura la animación de cierre y auto-scrolea al desplegar
  useEffect(() => {
    if (isExpanded) {
      setRaised(true);
      const measured = measureRef.current
        ? Math.max(measureRef.current.scrollHeight, measureRef.current.offsetHeight)
        : contentHeight;
      scrollElementIntoView(cardRef.current, {
        targetHeight: Math.max(contentHeight, measured, COLLAPSED_HEIGHT),
        delay: 50
      });
      return;
    }
    const t = setTimeout(() => setRaised(false), 450);
    return () => clearTimeout(t);
  }, [isExpanded, contentHeight]);

  // Si se abre el formulario de resolución de caso, asegurarse de que sea visible
  useEffect(() => {
    if (showResolveForm && isExpanded) {
      const measured = measureRef.current
        ? Math.max(measureRef.current.scrollHeight, measureRef.current.offsetHeight)
        : contentHeight;
      scrollElementIntoView(cardRef.current, {
        targetHeight: Math.max(contentHeight, measured, COLLAPSED_HEIGHT),
        delay: 70
      });
    }
  }, [showResolveForm, isExpanded, contentHeight]);

  const matchedDev = devices.find(d => d.hostname.toLowerCase() === ticket.hostname.toLowerCase());

  const handleRemoteAction = async (action: 'display_clone' | 'remote_access' | 'restart' | 'shutdown') => {
    setRemoteLoading(action);
    setRemoteFeedback(null);
    const targetId = matchedDev?.id || ticket.hostname;

    try {
      if (action === 'display_clone') {
        await onDuplicateScreen(ticket.hostname);
        setRemoteFeedback(`¡Comando de duplicación nativa enviado a ${ticket.hostname}!`);
      } else if (action === 'remote_access') {
        window.open(api.getRdpDownloadUrl(targetId), '_blank');
        setRemoteFeedback(`Sesión RDP nativa (mstsc.exe) iniciada hacia ${ticket.hostname}`);
      } else if (action === 'restart') {
        await api.triggerRemoteAction(targetId, 'restart', true);
        setRemoteFeedback(`Orden forzada de reinicio despachada a ${ticket.hostname}`);
      } else if (action === 'shutdown') {
        await api.triggerRemoteAction(targetId, 'shutdown', true);
        setRemoteFeedback(`Orden forzada de apagado despachada a ${ticket.hostname}`);
      }
    } catch (err: any) {
      setRemoteFeedback(err.message || 'Error al ejecutar acción remota');
    } finally {
      setRemoteLoading(null);
      setTimeout(() => setRemoteFeedback(null), 4000);
    }
  };

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!solutionText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onUpdateStatus(ticket.id, 'resuelto', solutionText.trim());
      setShowResolveForm(false);
      setSolutionText('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = () => {
    switch (ticket.status) {
      case 'resuelto':
        return {
          bg: 'rgba(16, 185, 129, 0.15)',
          color: '#10b981',
          border: 'rgba(16, 185, 129, 0.3)',
          label: 'RESUELTO',
          icon: CheckCircle2
        };
      case 'en_progreso':
        return {
          bg: 'rgba(245, 158, 11, 0.15)',
          color: '#f59e0b',
          border: 'rgba(245, 158, 11, 0.3)',
          label: 'EN ATENCIÓN',
          icon: Clock
        };
      default:
        return {
          bg: 'rgba(239, 68, 68, 0.15)',
          color: '#ef4444',
          border: 'rgba(239, 68, 68, 0.3)',
          label: 'ABIERTO',
          icon: AlertTriangle
        };
    }
  };

  const statusBadge = getStatusBadge();
  const StatusIcon = statusBadge.icon;

  return (
    <div
      key={ticket.id}
      ref={cardRef}
      className="report-card-slot"
      style={{
        position: 'relative',
        height: `${COLLAPSED_HEIGHT}px`,
        zIndex: raised ? 40 : 1
      }}
    >
      <div
        className="acrylic-card report-recuadro"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: `${isExpanded ? Math.max(contentHeight, COLLAPSED_HEIGHT) : COLLAPSED_HEIGHT}px`,
          overflow: 'hidden',
          minWidth: 0,
          borderRadius: '12px',
          border: `1px solid ${isExpanded ? 'var(--accent-primary)' : 'var(--border-acrylic)'}`,
          transition: 'height 0.42s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s ease, border-color 0.3s ease',
          boxShadow: isExpanded ? '0 22px 48px -8px rgba(15, 23, 42, 0.45)' : '0 4px 12px rgba(0,0,0,0.1)',
          backgroundColor: 'var(--bg-canvas)',
          backgroundImage: 'linear-gradient(var(--bg-canvas-subtle), var(--bg-canvas-subtle))',
          backdropFilter: 'none',
          transform: 'none'
        }}
      >
       <div ref={measureRef} data-auto-scroll-measure="true" style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Header: Categoría + Estado + Expandir (siempre visible) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 14px',
          borderBottom: '1px solid var(--border-acrylic)',
          cursor: 'pointer',
          transition: 'background 0.15s ease',
          userSelect: 'none',
          background: isExpanded ? 'rgba(139, 92, 246, 0.05)' : 'transparent'
        }}
        onClick={() => onToggleExpand()}
        onMouseEnter={(e) => { if (!isExpanded) e.currentTarget.style.background = 'rgba(148, 163, 184, 0.08)'; }}
        onMouseLeave={(e) => { if (!isExpanded) e.currentTarget.style.background = 'transparent'; }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              fontSize: '0.65rem',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '4px',
              backgroundColor: 'rgba(139, 92, 246, 0.15)',
              color: 'var(--accent-primary)'
            }}>
              {ticket.category || 'General'}
            </span>
            <span style={{
              fontSize: '0.64rem',
              fontWeight: 800,
              padding: '2px 7px',
              borderRadius: '9999px',
              backgroundColor: statusBadge.bg,
              color: statusBadge.color,
              border: `1px solid ${statusBadge.border}`,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <StatusIcon size={10} />
              <span>{statusBadge.label}</span>
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{
              fontSize: '0.7rem',
              color: 'var(--text-muted)',
              transform: `rotate(${isExpanded ? 180 : 0}deg)`,
              transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
            }}>
              ▾
            </span>
          </div>
        </div>

        {/* Cuerpo: contenido siempre visible con transición suave */}
        <div style={{
          padding: '12px 14px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          overflow: 'visible'
        }}
        >
          {/* Problema / Descripción */}
          <div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>
              Problema
            </div>
            <h4 style={{
              fontSize: '0.88rem',
              fontWeight: 800,
              color: 'var(--text-primary)',
              margin: 0,
              lineHeight: 1.35,
              wordBreak: 'break-word',
              overflowWrap: 'anywhere',
              display: '-webkit-box',
              WebkitLineClamp: isExpanded ? 'unset' : 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              transition: 'all 0.3s ease'
            }}>
              {ticket.description}
            </h4>
          </div>

          {/* Equipo y Usuario */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>
              Equipo / Usuario
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', minWidth: 0 }}>
              <Monitor size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} />
              <span style={{ fontWeight: 800, fontFamily: 'monospace', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                {ticket.hostname}
              </span>
              <span style={{ color: 'var(--text-muted)' }}>•</span>
              <span style={{ fontWeight: 600, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {ticket.userName}
              </span>
            </div>
          </div>

          {/* ID y Fecha: siempre visibles, balanceados en extremos y sin cortes antiestéticos */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '6px 8px',
            marginTop: '2px',
            paddingTop: '6px',
            borderTop: '1px solid var(--border-acrylic)',
            fontSize: '0.68rem',
            color: 'var(--text-secondary)'
          }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
              <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>ID:</span>
              <span
                onClick={handleCopyTicketId}
                className="copy-chip copy-chip-amber"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleCopyTicketId(e as any);
                  }
                }}
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  padding: '0 8px',
                  height: '21px',
                  minHeight: '21px',
                  borderRadius: '9999px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: 1,
                  gap: '5px',
                  boxSizing: 'border-box'
                }}
                title="Clic para copiar ID del ticket"
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', lineHeight: 1, transform: 'translateY(-0.5px)' }}>
                  {String(ticket.id).toUpperCase()}
                </span>
                {copiedId ? (
                  <Check size={11} color="var(--accent-emerald)" strokeWidth={2.5} style={{ flexShrink: 0 }} />
                ) : (
                  <Copy size={10} style={{ opacity: 0.65, flexShrink: 0 }} />
                )}
              </span>
            </div>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                whiteSpace: 'nowrap',
                marginLeft: 'auto',
                color: 'var(--text-secondary)',
                fontSize: '0.68rem',
                flexShrink: 0
              }}
              title="Fecha y hora de registro"
            >
              <Clock size={11} color="var(--text-muted)" style={{ flexShrink: 0 }} />
              <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Fecha:</span>
              <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                {new Date(ticket.createdAt).toLocaleDateString()} {new Date(ticket.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>

          {/* Contenido extendido: solo interactivo al desplegar */}
          <div
            aria-hidden={!isExpanded}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              opacity: isExpanded ? 1 : 0,
              transform: isExpanded ? 'translateY(0)' : 'translateY(-6px)',
              transition: 'opacity 0.35s ease 0.08s, transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
              pointerEvents: isExpanded ? 'auto' : 'none'
            }}
          >
          {/* Categoría como trigger */}
          <div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
              Categoría
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              <span
                style={{
                  fontSize: '0.68rem',
                  padding: '3px 9px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(2, 132, 199, 0.1)',
                  color: 'var(--accent-cyan)',
                  border: '1px solid rgba(2, 132, 199, 0.25)',
                  fontWeight: 600
                }}
              >
                {ticket.category || 'General'}
              </span>
            </div>
          </div>

          {/* Feedback Banner si se ejecutó acción remota */}
          {remoteFeedback && (
            <div style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              color: 'var(--accent-emerald)',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              padding: '3px 8px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}>
              <CheckCircle2 size={12} />
              <span>{remoteFeedback}</span>
            </div>
          )}

          {/* Acciones rápidas TI (1-CLIC) - Solo iconos para optimizar espacio */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            flexWrap: 'wrap', 
            gap: '6px', 
            marginTop: '6px',
            padding: '5px 8px',
            borderRadius: '10px',
            background: 'var(--bg-canvas-subtle)',
            border: '1px solid var(--border-acrylic)'
          }}>
            {ticket.status !== 'resuelto' && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <button
                  type="button"
                  disabled={remoteLoading !== null}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoteAction('display_clone');
                  }}
                  className="btn-flat btn-remote btn-remote--primary"
                  style={{
                    width: '32px',
                    height: '32px',
                    minWidth: '32px',
                    padding: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(139, 92, 246, 0.1)',
                    color: 'var(--accent-primary)',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    borderRadius: '8px',
                    boxShadow: remoteLoading === 'display_clone' ? '0 0 10px rgba(139, 92, 246, 0.4)' : 'none'
                  }}
                  title="Duplicar Pantalla (Win+P /clone)"
                  aria-label="Duplicar Pantalla (Win+P)"
                >
                  <ScreenShare size={15} />
                </button>

                <button
                  type="button"
                  disabled={remoteLoading !== null}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoteAction('remote_access');
                  }}
                  className="btn-flat btn-remote btn-remote--cyan"
                  style={{
                    width: '32px',
                    height: '32px',
                    minWidth: '32px',
                    padding: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(56, 189, 248, 0.1)',
                    color: 'var(--accent-cyan)',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    borderRadius: '8px',
                    boxShadow: remoteLoading === 'remote_access' ? '0 0 10px rgba(56, 189, 248, 0.4)' : 'none'
                  }}
                  title="Acceso Remoto RDP (mstsc.exe)"
                  aria-label="Acceso Remoto RDP"
                >
                  <Monitor size={15} />
                </button>

                <button
                  type="button"
                  disabled={remoteLoading !== null}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoteAction('restart');
                  }}
                  className="btn-flat btn-remote btn-remote--amber"
                  style={{
                    width: '32px',
                    height: '32px',
                    minWidth: '32px',
                    padding: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(245, 158, 11, 0.1)',
                    color: '#f59e0b',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    borderRadius: '8px',
                    boxShadow: remoteLoading === 'restart' ? '0 0 10px rgba(245, 158, 11, 0.4)' : 'none'
                  }}
                  title="Reiniciar Equipo"
                  aria-label="Reiniciar Equipo"
                >
                  <RotateCw size={15} />
                </button>

                <button
                  type="button"
                  disabled={remoteLoading !== null}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoteAction('shutdown');
                  }}
                  className="btn-flat btn-remote btn-remote--rose"
                  style={{
                    width: '32px',
                    height: '32px',
                    minWidth: '32px',
                    padding: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(239, 68, 68, 0.1)',
                    color: '#ef4444',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '8px',
                    boxShadow: remoteLoading === 'shutdown' ? '0 0 10px rgba(239, 68, 68, 0.4)' : 'none'
                  }}
                  title="Apagar Equipo"
                  aria-label="Apagar Equipo"
                >
                  <Power size={15} />
                </button>
              </div>
            )}

            {/* Acciones de resolución a la derecha */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', marginLeft: 'auto' }}>
              {ticket.status === 'abierto' && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateStatus(ticket.id, 'en_progreso');
                  }}
                  className="btn-flat btn-remote btn-remote--amber"
                  style={{
                    padding: '4px 8px',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    borderRadius: '8px',
                    gap: '4px'
                  }}
                  title="Tomar caso para atención"
                >
                  <Clock size={12} />
                  <span>Tomar Caso</span>
                </button>
              )}

              {!ticket.solutionNotes && (
                <button
                  type="button"
                  onClick={() => setShowResolveForm(true)}
                  className="btn-flat btn-remote btn-primary"
                  style={{
                    padding: '4px 8px',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    borderRadius: '8px',
                    gap: '4px'
                  }}
                  title="Resolver y Enseñar a STIVIE"
                >
                  <Sparkles size={12} />
                  <span>Resolver</span>
                </button>
              )}
            </div>
          </div>

          {/* Solución (si existe) o Formulario de resolución */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {ticket.solutionNotes ? (
              <div style={{
                padding: '10px 12px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', fontWeight: 800, color: 'var(--accent-emerald)' }}>
                  <Bot size={14} />
                  <span>Solución Aplicada (STIVIE la aprendió):</span>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                  {ticket.solutionNotes}
                </div>
              </div>
            ) : (
              showResolveForm ? (
                <form 
                  onSubmit={handleResolve}
                  className="report-resolve-form"
                  style={{
                    padding: '12px',
                    borderRadius: '10px',
                    background: 'var(--input-bg)',
                    border: '1px solid var(--border-acrylic-active)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}
                >
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={14} color="var(--accent-primary)" />
                    <span>Respuesta al Usuario & Solución (STIVIE la aprenderá):</span>
                  </div>
                  
                  <textarea
                    placeholder="Describe la solución aplicada al caso..."
                    value={solutionText}
                    onChange={(e) => setSolutionText(e.target.value)}
                    className="form-input"
                    style={{ width: '100%', minHeight: '60px', fontSize: '0.78rem' }}
                    autoFocus
                  />

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowResolveForm(false);
                        setSolutionText('');
                      }}
                      className="btn-flat"
                      style={{ padding: '5px 12px', fontSize: '0.72rem' }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={!solutionText.trim() || isSubmitting}
                      className="btn-flat btn-primary"
                      style={{ padding: '5px 14px', fontSize: '0.72rem', gap: '5px', fontWeight: 800 }}
                    >
                      <Send size={12} />
                      <span>Confirmar y Enseñar a STIVIE</span>
                    </button>
                  </div>
                </form>
              ) : null
            )}

            {/* Acciones rápidas */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '8px',
              marginTop: '4px'
            }}>
              {ticket.status === 'abierto' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateStatus(ticket.id, 'en_progreso');
                  }}
                  className="btn-flat"
                  style={{ padding: '8px 12px', fontSize: '0.72rem', fontWeight: 700, textAlign: 'left', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' }}
                >
                  <Clock size={13} />
                  <span>Tomar Caso</span>
                </button>
              )}
              {ticket.status !== 'resuelto' && !showResolveForm && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowResolveForm(true);
                    }}
                    className="btn-flat btn-primary"
                    style={{ padding: '8px 12px', fontSize: '0.72rem', fontWeight: 700, textAlign: 'left' }}
                  >
                    <CheckCircle2 size={13} />
                    <span>Resolver</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (matchedDev) {
                        onSelectDevice?.(matchedDev);
                      }
                    }}
                    className="btn-flat"
                    style={{ padding: '8px 12px', fontSize: '0.72rem', fontWeight: 700, textAlign: 'left' }}
                  >
                    <ExternalLink size={13} />
                    <span>Ver en Inventario</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Cerrar detalles */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button
              onClick={() => onToggleExpand()}
              className="btn-flat"
              style={{ padding: '4px 10px', fontSize: '0.7rem', fontWeight: 700 }}
            >
              <ChevronDown size={11} style={{ transform: 'rotate(180deg)' }} />
              <span>Ocultar Detalles</span>
            </button>
          </div>
          </div>
        </div>
       </div>

        {/* Degradado inferior mientras la tarjeta está colapsada */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: '28px',
            background: 'linear-gradient(to bottom, transparent, var(--bg-canvas-subtle))',
            opacity: isExpanded ? 0 : 1,
            transition: 'opacity 0.25s ease',
            pointerEvents: 'none'
          }}
        />
      </div>
    </div>
  );
};
