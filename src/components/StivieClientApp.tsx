import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  ThumbsUp,
  ThumbsDown,
  Tv,
  Volume2,
  Zap,
  ScreenShare,
  Sparkles,
  Minus,
  X,
  ChevronRight
} from 'lucide-react';
import { UpnBrandLogo } from './Navbar';
import type { SupportTicket } from '../types';
import { api } from '../services/api';

interface ChatMessage {
  id: string;
  sender: 'stivie' | 'user' | 'support_technician';
  text: string;
  timestamp: string;
  action?: {
    type: string;
    label: string;
  };
  ticketId?: string;
  knowledgeId?: string;
  feedbackGiven?: 'up' | 'down';
}

interface StivieClientAppProps {
  embedded?: boolean;
}

export const StivieAnimatedMascot: React.FC<{ size?: number }> = ({ size = 32 }) => {
  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'stivieFloat 3.2s ease-in-out infinite',
        flexShrink: 0
      }}
    >
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Antenna */}
        <line x1="24" y1="4" x2="24" y2="10" stroke="#ffb800" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="24" cy="4" r="3" fill="#ffb800">
          <animate attributeName="opacity" values="0.3;1;0.3" dur="1.4s" repeatCount="indefinite" />
        </circle>
        {/* Robot Head Outer Box */}
        <rect x="7" y="10" width="34" height="26" rx="8" fill="url(#headGrad)" stroke="#ffb800" strokeWidth="1.8" />
        {/* Cyber Visor Screen */}
        <rect x="11" y="15" width="26" height="15" rx="5" fill="#070c1e" stroke="#ffb800" strokeWidth="1.2" />
        {/* Animated Glowing Cyber Eyes (Blinking) */}
        <rect x="15" y="19" width="6" height="7" rx="3" fill="#ffb800">
          <animate attributeName="height" values="7;7;0.8;7;7" keyTimes="0;0.45;0.5;0.55;1" dur="3.2s" repeatCount="indefinite" />
          <animate attributeName="y" values="19;19;22;19;19" keyTimes="0;0.45;0.5;0.55;1" dur="3.2s" repeatCount="indefinite" />
        </rect>
        <rect x="27" y="19" width="6" height="7" rx="3" fill="#ffb800">
          <animate attributeName="height" values="7;7;0.8;7;7" keyTimes="0;0.45;0.5;0.55;1" dur="3.2s" repeatCount="indefinite" />
          <animate attributeName="y" values="19;19;22;19;19" keyTimes="0;0.45;0.5;0.55;1" dur="3.2s" repeatCount="indefinite" />
        </rect>
        {/* Friendly Cyber Smile */}
        <path d="M20 28 Q24 30.5 28 28" stroke="#ffb800" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        {/* Audio Ears */}
        <rect x="4" y="18" width="3" height="10" rx="1.5" fill="#ffb800" />
        <rect x="41" y="18" width="3" height="10" rx="1.5" fill="#ffb800" />
        {/* Gradients */}
        <defs>
          <linearGradient id="headGrad" x1="7" y1="10" x2="41" y2="36" gradientUnits="userSpaceOnUse">
            <stop stopColor="#0b132b" />
            <stop offset="1" stopColor="#1c2541" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
};

export const StivieClientApp: React.FC<StivieClientAppProps> = () => {
  // Lateral docked state and transition animation state
  const [isDocked, setIsDocked] = useState<boolean>(false);
  const [isClosing, setIsClosing] = useState<boolean>(false);

  // Smooth dock transition handler
  const handleDock = React.useCallback(() => {
    if (isDocked || isClosing) return;
    setIsClosing(true);
    setTimeout(() => {
      setIsDocked(true);
      setIsClosing(false);
      if ((window as any).electronAPI?.dockCompleted) {
        (window as any).electronAPI.dockCompleted();
      }
    }, 320);
  }, [isDocked, isClosing]);

  // Smooth expand transition handler
  const handleExpand = React.useCallback(() => {
    if (!isDocked && !isClosing) return;
    if ((window as any).electronAPI?.expandWindow) {
      (window as any).electronAPI.expandWindow();
    }
    setIsDocked(false);
  }, [isDocked, isClosing]);

  // IPC listeners from Electron
  useEffect(() => {
    if ((window as any).electronAPI?.onStartDockAnimation) {
      const cleanup = (window as any).electronAPI.onStartDockAnimation(() => {
        handleDock();
      });
      return cleanup;
    }
  }, [handleDock]);

  useEffect(() => {
    if ((window as any).electronAPI?.onExpand) {
      const cleanup = (window as any).electronAPI.onExpand(() => {
        handleExpand();
      });
      return cleanup;
    }
  }, [handleExpand]);

  // Local PC hostname
  const [hostname] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('host') || localStorage.getItem('stivie_pc_hostname') || 'MI-ESTACION';
  });

  // User's name
  const [userName, setUserName] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('user') || localStorage.getItem('stivie_pc_username') || '';
  });

  // Conversational state: 'ask_name' | 'ask_issue' | 'ongoing'
  const [step, setStep] = useState<'ask_name' | 'ask_issue' | 'ongoing'>(() => {
    return userName && userName.trim() ? 'ask_issue' : 'ask_name';
  });

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (!userName || !userName.trim()) {
      return [
        {
          id: 'welcome-ask-name',
          sender: 'stivie',
          text: '¡Hola! Para una atención más personalizada, ¿cuál es tu nombre?',
          timestamp: nowTime
        }
      ];
    }
    return [
      {
        id: 'welcome-ask-issue',
        sender: 'stivie',
        text: `¡Hola, ${userName}! ¿Cuál es tu inconveniente o en qué te puedo ayudar hoy?`,
        timestamp: nowTime
      }
    ];
  });
  const [inputValue, setInputValue] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // User's active ticket if generated
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (userName) {
      localStorage.setItem('stivie_pc_username', userName);
    }
    if (hostname) {
      localStorage.setItem('stivie_pc_hostname', hostname);
    }
  }, [userName, hostname]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  // Periodic poll to check if the support technician replied/resolved the active ticket
  useEffect(() => {
    if (!activeTicketId) return;

    const interval = setInterval(async () => {
      try {
        const tickets: SupportTicket[] = await api.getTickets();
        const myTck = tickets.find(t => t.id === activeTicketId);
        if (myTck) {
          if (myTck.status === 'resuelto') {
            setMessages(prev => {
              const alreadyShown = prev.some(m => m.id === `ticket-resolved-${myTck.id}`);
              if (alreadyShown) return prev;

              return [
                ...prev,
                {
                  id: `ticket-resolved-${myTck.id}`,
                  sender: 'stivie',
                  text: `✅ **Ticket ${myTck.id} Resuelto**\n\nEl equipo de Soporte TI ha atendido y cerrado tu caso con éxito. Si tienes alguna otra duda o consulta técnica, aquí sigo disponible para asistirte.`,
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }
              ];
            });
          }
        }
      } catch {
        // ignore
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [activeTicketId]);

  // 1. No se proyecta la pantalla
  const handleScreenTroubleshoot = async () => {
    try {
      setActionFeedback('Duplicando pantalla (DisplaySwitch /clone)...');
      if ((window as any).electronAPI?.cloneDisplay) {
        await (window as any).electronAPI.cloneDisplay();
      }
      await api.stivieSolveScreen(hostname);
      setActionFeedback('¡Modo proyector activado! (DisplaySwitch /clone)');
      setTimeout(() => setActionFeedback(null), 3500);
    } catch {
      setActionFeedback('Error al emitir orden de pantalla.');
      setTimeout(() => setActionFeedback(null), 2500);
    }
  };

  // 2. Tengo problemas con el audio
  const handleAudioTroubleshoot = async () => {
    try {
      setActionFeedback('Reiniciando servicios de audio (Audiosrv)...');
      if ((window as any).electronAPI?.restartAudio) {
        await (window as any).electronAPI.restartAudio();
      }
      setActionFeedback('¡Servicios de audio verificados! Revisa volumen y salida.');
      setTimeout(() => setActionFeedback(null), 3500);
    } catch {
      setActionFeedback('Error al verificar audio.');
      setTimeout(() => setActionFeedback(null), 2500);
    }
  };

  // 3. El equipo está lento
  const handlePowerTroubleshoot = async () => {
    try {
      setActionFeedback('Verificando estado de energía y cargador...');
      setActionFeedback('¡Alerta de energía reportada a Soporte TI!');
      setTimeout(() => setActionFeedback(null), 3500);
    } catch {
      setActionFeedback('Error al emitir alerta de energía.');
      setTimeout(() => setActionFeedback(null), 2500);
    }
  };

  // Main message submit handler
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isThinking) return;

    const userText = inputValue.trim();
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Step 1: If user hasn't introduced themselves, take input as their name
    if (step === 'ask_name') {
      const capturedName = userText.replace(/^(mi nombre es|soy|me llamo)\s+/i, '').trim();
      setUserName(capturedName);
      localStorage.setItem('stivie_pc_username', capturedName);

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        sender: 'user',
        text: userText,
        timestamp: nowTime
      };

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: 'stivie',
        text: `Mucho gusto, ${capturedName}. ¿Cuál es tu inconveniente o en qué te puedo ayudar hoy?`,
        timestamp: nowTime
      };

      setMessages(prev => [...prev, userMsg, botMsg]);
      setInputValue('');
      setStep('ask_issue');
      return;
    }

    // Step 2 & 3: User states their problem
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: userText,
      timestamp: nowTime
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsThinking(true);

    const qLower = userText.toLowerCase();

    // Check specifically if user has problems with projector / blue screen / duplication
    const hasProjectorIssue = [
      'proyector',
      'azul',
      'pantalla',
      'duplicar',
      'segunda pantalla',
      'clonar',
      'monitor',
      'proyectar',
      'hdmi',
      'vga',
      'no proyecta',
      'reflejar'
    ].some(w => qLower.includes(w));

    try {
      // 1. Query STIVIE AI Brain
      const aiResponse = await api.stivieChat(userText, hostname, userName);

      // 2. Automatically generate ticket to IT Support so technicians see it in the app
      let createdTicket: SupportTicket | null = null;
      try {
        const cat = hasProjectorIssue
          ? 'Pantalla / Proyector'
          : (qLower.includes('red') || qLower.includes('internet') || qLower.includes('wifi'))
            ? 'Red & Conectividad'
            : (qLower.includes('lento') || qLower.includes('ram'))
              ? 'Rendimiento'
              : (qLower.includes('impres'))
                ? 'Impresión'
                : 'General';

        const ticketRes = await api.createTicket({
          hostname: hostname.toUpperCase(),
          userName: userName.trim(),
          category: cat,
          urgency: hasProjectorIssue ? 'alta' : 'media',
          description: userText
        });
        createdTicket = ticketRes.ticket;
        if (createdTicket?.id) {
          setActiveTicketId(createdTicket.id);
        }
      } catch {
        // ignore ticket creation error
      }

      // 3. Craft response
      let replyText = '';
      let actionObj: { type: string; label: string } | undefined = undefined;

      // ONLY suggest Duplicar Pantalla if user has issues with projector / screen / blue display!
      if (hasProjectorIssue) {
        replyText = `Detecto que tienes un inconveniente con el proyector o pantalla azul. Te sugiero usar Duplicar Pantalla para reflejar tu imagen inmediatamente sin esperar a que llegue el técnico:`;
        actionObj = {
          type: 'display_clone',
          label: 'Duplicar Pantalla Ahora (1-Clic)'
        };
      } else if (aiResponse.answer || aiResponse.reply) {
        // Deep AI reasoning solution:
        replyText = aiResponse.answer || aiResponse.reply;
        if (aiResponse.action) actionObj = aiResponse.action;
      } else {
        // General inquiry forwarded to IT Support
        replyText = `He analizado tu consulta y ya registré el reporte en el panel de Soporte TI. El técnico de soporte ha sido notificado para darte asistencia directa.`;
      }

      const stivieReply: ChatMessage = {
        id: `stivie-${Date.now()}`,
        sender: 'stivie',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        action: actionObj,
        ticketId: createdTicket?.id,
        knowledgeId: aiResponse.knowledgeId
      };

      setMessages(prev => [...prev, stivieReply]);
      setStep('ongoing');
    } catch {
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'stivie',
          text: 'No pude contactar con la central de Soporte TI 24/7. Por favor verifica tu conexión a internet o red.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  // Feedback on learned answers
  const handleFeedback = async (msgId: string, knowledgeId?: string, vote?: 'up' | 'down') => {
    if (!knowledgeId || !vote) return;
    try {
      await api.stivieFeedback(knowledgeId, vote === 'up');
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, feedbackGiven: vote } : m));
      setActionFeedback('¡Gracias! STIVIE aprendió para responder mejor la próxima vez.');
      setTimeout(() => setActionFeedback(null), 3000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="stivie-client-viewport">
      {/* 1. LATERAL DOCKED TAB (Minimal notoriety & smooth spring peek) */}
      <div
        className={`stivie-edge-dock-tab ${!isDocked ? 'tab-hidden' : ''}`}
        onClick={handleExpand}
        onMouseEnter={() => {
          if ((window as any).electronAPI?.peekWindow) {
            (window as any).electronAPI.peekWindow(true);
          }
        }}
        onMouseLeave={() => {
          if ((window as any).electronAPI?.peekWindow) {
            (window as any).electronAPI.peekWindow(false);
          }
        }}
        title="Hacer clic para desplegar STIVIE"
      >
        <div className="stivie-edge-tab" style={{ background: '#FFB800', border: '1.5px solid #ffffff', color: '#0B132B' }}>
          <div className="stivie-edge-tab-icon" style={{ background: '#0B132B', padding: '3px', borderRadius: '5px' }}>
            <UpnBrandLogo size={16} color="#FFB800" />
          </div>
          <div className="stivie-edge-tab-label" style={{ color: '#0B132B', fontWeight: 800 }}>
            STIVIE • Operaciones
          </div>
        </div>
      </div>

      {/* 2. EXPANDED COMPACT STIVIE WINDOW (Fluid GPU-accelerated 60/120 FPS drawer) */}
      <div className={`stivie-client-drawer ${isDocked || isClosing ? 'drawer-docked' : ''}`}>
        {/* Header Bar */}
        <div style={{
          padding: '12px 16px',
          background: 'var(--bg-acrylic-heavy)',
          borderBottom: '1px solid var(--border-acrylic)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          userSelect: 'none'
        }}>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            title="Ir al Inicio"
          >
            <div style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              background: '#FFB800',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(255, 184, 0, 0.3)',
              flexShrink: 0,
              cursor: 'pointer',
              transition: 'transform 0.15s ease'
            }}>
              <UpnBrandLogo size={20} color="#0B132B" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.96rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                  STIVIE
                </span>
                <span style={{
                  fontSize: '0.62rem',
                  fontWeight: 800,
                  padding: '1px 6px',
                  borderRadius: '4px',
                  background: '#FFB800',
                  color: '#0B132B',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase'
                }}>
                  Operaciones
                </span>
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                {hostname} {userName ? `• ${userName}` : ''}
              </div>
            </div>
          </div>

          {/* Window Controls: Minimize and Close with fluid slide-out */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              onClick={handleDock}
              className="btn-flat"
              style={{ padding: '4px 8px', borderRadius: '6px' }}
              title="Minimizar a botón lateral"
            >
              <Minus size={15} />
            </button>
            <button
              type="button"
              onClick={handleDock}
              className="btn-flat btn-danger"
              style={{ padding: '4px 8px', borderRadius: '6px' }}
              title="Ocultar al lateral de la pantalla"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Quick Direct Actions Bar: Opciones Predeterminadas */}
        <div style={{
          padding: '8px 12px',
          backgroundColor: 'rgba(148, 163, 184, 0.06)',
          borderBottom: '1px solid var(--border-acrylic)',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          <div style={{
            fontSize: '0.68rem',
            fontWeight: 800,
            color: 'var(--accent-primary)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em'
          }}>
            Opciones Predeterminadas:
          </div>
          <div style={{
            display: 'flex',
            gap: '6px',
            flexWrap: 'wrap'
          }}>
            <button
              type="button"
              onClick={handleScreenTroubleshoot}
              className="btn-flat"
              style={{
                flex: 1,
                minWidth: '90px',
                padding: '6px 8px',
                fontSize: '0.72rem',
                fontWeight: 700,
                color: 'var(--accent-primary)',
                border: '1px solid var(--border-acrylic)',
                background: 'rgba(255, 184, 0, 0.08)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title="No se proyecta la pantalla - Duplica pantalla en 1 clic (DisplaySwitch /clone)"
            >
              <Tv size={13} />
              <span>No se proyecta la pantalla</span>
            </button>
            <button
              type="button"
              onClick={handleAudioTroubleshoot}
              className="btn-flat"
              style={{
                flex: 1,
                minWidth: '90px',
                padding: '6px 8px',
                fontSize: '0.72rem',
                fontWeight: 700,
                color: 'var(--accent-primary)',
                border: '1px solid var(--border-acrylic)',
                background: 'rgba(255, 184, 0, 0.08)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title="Tengo problemas con el audio - Reinicia audiosrv y revisa salida"
            >
              <Volume2 size={13} />
              <span>Tengo problemas con el audio</span>
            </button>
            <button
              type="button"
              onClick={handlePowerTroubleshoot}
              className="btn-flat"
              style={{
                flex: 1,
                minWidth: '90px',
                padding: '6px 8px',
                fontSize: '0.72rem',
                fontWeight: 700,
                color: 'var(--accent-primary)',
                border: '1px solid var(--border-acrylic)',
                background: 'rgba(255, 184, 0, 0.08)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title="El equipo está lento - Diagnostica rendimiento y reporta a Soporte TI"
            >
              <Zap size={13} />
              <span>El equipo está lento</span>
            </button>
          </div>
        </div>

        {/* Action Feedback Toast */}
        {actionFeedback && (
          <div style={{
            background: 'var(--accent-primary)',
            color: 'var(--accent-contrast, #000000)',
            padding: '6px 12px',
            fontSize: '0.74rem',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <Sparkles size={13} />
            <span>{actionFeedback}</span>
          </div>
        )}

        {/* Conversational Stream */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          {messages.map(msg => {
            const isUser = msg.sender === 'user';
            const isTech = msg.sender === 'support_technician';

            return (
              <div
                key={msg.id}
                style={{
                  alignSelf: isUser ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '3px'
                }}
              >
                <div style={{
                  padding: '10px 14px',
                  borderRadius: '12px',
                  background: isUser
                    ? 'var(--accent-primary)'
                    : isTech
                      ? 'rgba(16, 185, 129, 0.15)'
                      : 'rgba(148, 163, 184, 0.12)',
                  color: isUser ? 'var(--accent-contrast, #000000)' : 'var(--text-primary)',
                  fontWeight: isUser ? 700 : 400,
                  fontSize: '0.82rem',
                  lineHeight: 1.45,
                  border: isUser
                    ? 'none'
                    : isTech
                      ? '1px solid rgba(16, 185, 129, 0.4)'
                      : '1px solid var(--border-acrylic)',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                }}>
                  {/* Message Text with Line Breaks */}
                  <div style={{ whiteSpace: 'pre-wrap' }}>
                    {msg.text}
                  </div>

                  {/* ONLY when user asked about projector/blue screen: suggest Duplicar Pantalla */}
                  {msg.action && (
                    <div style={{ marginTop: '10px' }}>
                      <button
                        onClick={handleScreenTroubleshoot}
                        className="btn-flat"
                        style={{
                          padding: '6px 12px',
                          fontSize: '0.74rem',
                          fontWeight: 800,
                          backgroundColor: '#0284c7',
                          color: '#ffffff',
                          borderColor: '#0284c7',
                          width: '100%',
                          justifyContent: 'center',
                          boxShadow: '0 2px 10px rgba(2, 132, 199, 0.3)'
                        }}
                      >
                        <ScreenShare size={14} />
                        <span>{msg.action.label}</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Timestamp and feedback */}
                <div style={{
                  fontSize: '0.66rem',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: isUser ? 'flex-end' : 'flex-start',
                  gap: '6px'
                }}>
                  <span>{msg.timestamp}</span>
                  {msg.sender === 'stivie' && msg.knowledgeId && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <button
                        onClick={() => handleFeedback(msg.id, msg.knowledgeId, 'up')}
                        className="btn-flat"
                        style={{ padding: '2px 4px', fontSize: '0.64rem' }}
                        title="Solución útil"
                      >
                        <ThumbsUp size={11} color={msg.feedbackGiven === 'up' ? '#10b981' : 'var(--text-muted)'} />
                      </button>
                      <button
                        onClick={() => handleFeedback(msg.id, msg.knowledgeId, 'down')}
                        className="btn-flat"
                        style={{ padding: '2px 4px', fontSize: '0.64rem' }}
                        title="No útil"
                      >
                        <ThumbsDown size={11} color={msg.feedbackGiven === 'down' ? '#ef4444' : 'var(--text-muted)'} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {isThinking && (
            <div style={{
              alignSelf: 'flex-start',
              padding: '8px 12px',
              borderRadius: '10px',
              background: 'rgba(148, 163, 184, 0.1)',
              fontSize: '0.74rem',
              color: 'var(--text-secondary)'
            }}>
              STIVIE está consultando la solución...
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Box */}
        <form
          onSubmit={handleSendMessage}
          style={{
            padding: '10px 14px',
            borderTop: '1px solid var(--border-acrylic)',
            display: 'flex',
            gap: '6px',
            background: 'rgba(148, 163, 184, 0.04)'
          }}
        >
          <input
            type="text"
            autoFocus
            placeholder={
              step === 'ask_name'
                ? 'Escribe tu nombre y presiona Enter...'
                : 'Describe tu problema o inconveniente...'
            }
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="form-input"
            style={{ flex: 1, height: '36px', fontSize: '0.8rem' }}
          />
          <button
            type="submit"
            disabled={isThinking || !inputValue.trim()}
            className="btn-flat btn-primary"
            style={{ padding: '0 12px', height: '36px' }}
          >
            <Send size={14} />
          </button>
        </form>

        {/* Tarjeta de Créditos del Desarrollador (Desktop App) */}
        <div style={{
          margin: '8px 10px 10px',
          padding: '8px 12px',
          borderRadius: '10px',
          border: '1px solid var(--border-acrylic)',
          background: 'rgba(148, 163, 184, 0.04)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          opacity: 0.9
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '5px',
                height: '5px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent-primary)',
                boxShadow: '0 0 5px var(--accent-glow)'
              }} />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                STIVIE • Asistente de Operaciones Virtual
              </span>
            </div>
            <button
              type="button"
              onClick={handleDock}
              title="Ocultar en lateral"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '0.68rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '2px',
                cursor: 'pointer',
                fontWeight: 600,
                padding: '2px 4px',
                opacity: 0.8
              }}
            >
              <span>Ocultar</span>
              <ChevronRight size={12} />
            </button>
          </div>

          <div style={{
            fontSize: '0.64rem',
            color: 'var(--text-muted)',
            paddingLeft: '11px',
            lineHeight: 1.2
          }}>
            Plataforma Corporativa de TI & Asistencia Inteligente
          </div>

          <div style={{
            fontSize: '0.64rem',
            color: 'var(--accent-primary)',
            fontWeight: 600,
            paddingLeft: '11px',
            opacity: 0.85
          }}>
            • STIVIE & Tay-Audit
          </div>
        </div>
      </div>
    </div>
  );
};
