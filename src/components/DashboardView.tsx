import React, { useMemo, useState } from 'react';
import { 
  Monitor, 
  Laptop, 
  Server, 
  Printer, 
  Network, 
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  ArrowRight,
  Zap,
  LifeBuoy,
  User,
  AlertTriangle,
  BarChart3,
  ShieldCheck,
  Layers,
  Sparkles
} from 'lucide-react';
import type { Device, SystemStats, AuditLog, SupportTicket } from '../types';

interface DashboardViewProps {
  stats: SystemStats;
  devices: Device[];
  logs: AuditLog[];
  tickets?: SupportTicket[];
  onNavigateToCategory: (category: string) => void;
  onExportExcel: () => void;
  onSelectDevice: (device: Device) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  stats,
  devices,
  logs,
  tickets = [],
  onNavigateToCategory,
  onExportExcel,
  onSelectDevice
}) => {
  const [activeReportTab, setActiveReportTab] = useState<'hostname' | 'user' | 'category'>('hostname');

  // 1. Audit Compliance Metrics (Replaces Total RAM)
  const auditMetrics = useMemo(() => {
    const total = devices.length;
    const now = Date.now();
    const audited = devices.filter(d => {
      if (!d.lastAuditDate) return false;
      const diffDays = (now - new Date(d.lastAuditDate).getTime()) / (1000 * 60 * 60 * 24);
      return diffDays <= 30; // Audited in the last 30 days
    }).length;
    const pending = total - audited;
    const percent = total > 0 ? Math.round((audited / total) * 100) : 0;
    return { total, audited, pending, percent };
  }, [devices]);

  // 2. Incident Correlation by Hostname (Equipos con más reportes)
  const reportsByHostname = useMemo(() => {
    const map: Record<string, {
      hostname: string;
      count: number;
      openCount: number;
      users: Set<string>;
      categories: Record<string, number>;
      lastTicketDate: string;
      device?: Device;
    }> = {};

    tickets.forEach(t => {
      const hKey = (t.hostname || 'DESCONOCIDO').toUpperCase();
      if (!map[hKey]) {
        map[hKey] = {
          hostname: t.hostname || 'DESCONOCIDO',
          count: 0,
          openCount: 0,
          users: new Set(),
          categories: {},
          lastTicketDate: t.createdAt,
          device: devices.find(d => d.hostname.toUpperCase() === hKey)
        };
      }
      map[hKey].count += 1;
      if (t.status !== 'resuelto') map[hKey].openCount += 1;
      if (t.userName) map[hKey].users.add(t.userName);
      map[hKey].categories[t.category] = (map[hKey].categories[t.category] || 0) + 1;
      if (new Date(t.createdAt) > new Date(map[hKey].lastTicketDate)) {
        map[hKey].lastTicketDate = t.createdAt;
      }
    });

    return Object.values(map)
      .map(item => ({
        ...item,
        usersList: Array.from(item.users),
        topCategory: Object.entries(item.categories).sort((a, b) => b[1] - a[1])[0]?.[0] || 'General'
      }))
      .sort((a, b) => b.count - a.count);
  }, [tickets, devices]);

  // 3. Incident Correlation by User (Usuarios que más reportan)
  const reportsByUser = useMemo(() => {
    const map: Record<string, {
      userName: string;
      count: number;
      openCount: number;
      hostnames: Set<string>;
      categories: Record<string, number>;
    }> = {};

    tickets.forEach(t => {
      const uKey = (t.userName || 'Usuario Anónimo').trim();
      if (!map[uKey]) {
        map[uKey] = {
          userName: uKey,
          count: 0,
          openCount: 0,
          hostnames: new Set(),
          categories: {}
        };
      }
      map[uKey].count += 1;
      if (t.status !== 'resuelto') map[uKey].openCount += 1;
      if (t.hostname) map[uKey].hostnames.add(t.hostname);
      map[uKey].categories[t.category] = (map[uKey].categories[t.category] || 0) + 1;
    });

    return Object.values(map)
      .map(item => ({
        ...item,
        hostnamesList: Array.from(item.hostnames),
        topCategory: Object.entries(item.categories).sort((a, b) => b[1] - a[1])[0]?.[0] || 'General'
      }))
      .sort((a, b) => b.count - a.count);
  }, [tickets]);

  // 4. Ticket Category Distribution
  const categoryStats = useMemo(() => {
    const map: Record<string, number> = {};
    tickets.forEach(t => {
      map[t.category] = (map[t.category] || 0) + 1;
    });
    const total = tickets.length || 1;
    return Object.entries(map).map(([category, count]) => ({
      category,
      count,
      percent: Math.round((count / total) * 100)
    })).sort((a, b) => b.count - a.count);
  }, [tickets]);

  const uptimeRate = stats.totalDevices > 0 
    ? Math.round((stats.onlineCount / stats.totalDevices) * 100) 
    : 100;

  const totalTickets = tickets.length;
  const openTickets = tickets.filter(t => t.status !== 'resuelto').length;
  const resolvedTickets = tickets.filter(t => t.status === 'resuelto').length;
  const resolutionRate = totalTickets > 0 ? Math.round((resolvedTickets / totalTickets) * 100) : 100;

  const categories = [
    { id: 'pc', label: 'Computadoras PC', count: stats.pcCount, icon: Monitor, color: 'var(--accent-primary)' },
    { id: 'laptop', label: 'Laptops Móviles', count: stats.laptopCount, icon: Laptop, color: 'var(--accent-cyan)' },
    { id: 'server', label: 'Servidores & Datos', count: stats.serverCount, icon: Server, color: 'var(--accent-amber)' },
    { id: 'printer', label: 'Impresoras Red', count: stats.printerCount, icon: Printer, color: 'var(--accent-secondary)' },
    { id: 'network', label: 'Switches & Routers', count: stats.networkCount, icon: Network, color: 'var(--accent-rose)' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      
      {/* 1. EXECUTIVE COMMAND HERO (Zero Empty Space on Tablet) */}
      <div className="dashboard-hero-grid">
        {/* CARD 1: Disponibilidad y Estado de Red */}
        <div className="acrylic-card" style={{
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          border: '1px solid var(--border-acrylic)',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>
                DISPONIBILIDAD DE PARQUE CORPORATIVO
              </span>
              <span 
                className={`status-pill ${uptimeRate >= 80 ? 'status-online' : 'status-audited'}`}
                style={{ whiteSpace: 'nowrap', textAlign: 'center', justifyContent: 'center' }}
              >
                {uptimeRate >= 80 ? 'FLOTA ACTIVA' : 'REVISIÓN REQUERIDA'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '14px' }}>
              <div style={{
                position: 'relative',
                width: '74px',
                height: '74px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="var(--border-acrylic)"
                    strokeWidth="3.4"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="var(--accent-primary)"
                    strokeWidth="3.4"
                    strokeDasharray={`${uptimeRate}, 100`}
                    strokeLinecap="round"
                  />
                </svg>

                {/* Texto y número perfectamente centrados en ambos ejes */}
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  pointerEvents: 'none',
                  lineHeight: 1
                }}>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'baseline',
                    justifyContent: 'center',
                    lineHeight: 1
                  }}>
                    <span style={{
                      fontSize: '1.2rem',
                      fontWeight: 800,
                      color: 'var(--text-primary)',
                      fontFamily: 'JetBrains Mono, monospace',
                      lineHeight: 1
                    }}>
                      {uptimeRate}
                    </span>
                    <span style={{
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      color: 'var(--accent-primary)',
                      fontFamily: 'JetBrains Mono, monospace',
                      lineHeight: 1,
                      marginLeft: '1px'
                    }}>
                      %
                    </span>
                  </div>
                  <span style={{
                    fontSize: '0.52rem',
                    fontWeight: 800,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    lineHeight: 1,
                    marginTop: '3px'
                  }}>
                    ONLINE
                  </span>
                </div>
              </div>

              <div>
                <div style={{ fontSize: '2.1rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                  {stats.onlineCount} <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>/ {stats.totalDevices}</span>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
                  Equipos en línea y respondiendo consultas
                </div>
              </div>
            </div>
          </div>

          <div style={{
            display: 'flex',
            gap: '8px',
            paddingTop: '12px',
            borderTop: '1px solid var(--border-acrylic)'
          }}>
            <div style={{ flex: 1, padding: '6px 10px', borderRadius: '8px', background: 'var(--bg-canvas-subtle)' }}>
              <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>ONLINE</div>
              <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--accent-emerald)' }}>{stats.onlineCount}</div>
            </div>
            <div style={{ flex: 1, padding: '6px 10px', borderRadius: '8px', background: 'var(--bg-canvas-subtle)' }}>
              <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>OFFLINE</div>
              <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{stats.totalDevices - stats.onlineCount}</div>
            </div>
            <div style={{ flex: 1, padding: '6px 10px', borderRadius: '8px', background: 'var(--bg-canvas-subtle)' }}>
              <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>TOTAL</div>
              <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--accent-secondary)' }}>{stats.totalDevices}</div>
            </div>
          </div>
        </div>

        {/* CARD 2: CANTIDAD DE EQUIPOS AUDITADOS */}
        <div className="acrylic-card" style={{
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          border: '1px solid var(--border-acrylic)',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>
                COBERTURA Y CANTIDAD DE EQUIPOS AUDITADOS
              </span>
              <ShieldCheck size={18} color="#10b981" />
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>
                {auditMetrics.audited}
              </span>
              <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-emerald)' }}>
                / {auditMetrics.total} AUDITADOS
              </span>
            </div>

            {/* Audit Progress Bar */}
            <div style={{ marginTop: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                <span>Cumplimiento de Auditoría (30 días):</span>
                <strong style={{ color: auditMetrics.percent >= 80 ? 'var(--accent-emerald)' : 'var(--accent-amber)' }}>
                  {auditMetrics.percent}%
                </strong>
              </div>
              <div style={{ width: '100%', height: '8px', borderRadius: '4px', backgroundColor: 'var(--border-acrylic)', overflow: 'hidden' }}>
                <div style={{
                  width: `${auditMetrics.percent}%`,
                  height: '100%',
                  backgroundColor: auditMetrics.percent >= 80 ? 'var(--accent-emerald)' : 'var(--accent-amber)',
                  borderRadius: '4px',
                  transition: 'width 0.4s ease'
                }} />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '14px', fontSize: '0.74rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-emerald)' }}>
                <CheckCircle2 size={14} />
                <span><strong>{auditMetrics.audited}</strong> al día</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-amber)' }}>
                <AlertTriangle size={14} />
                <span><strong>{auditMetrics.pending}</strong> pendientes</span>
              </div>
            </div>
          </div>

          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', paddingTop: '10px', borderTop: '1px solid var(--border-acrylic)' }}>
            Auditoría en tiempo real con Agente STIVIE y levantamiento automático
          </div>
        </div>

        {/* CARD 3: CENTRO DE ACCIONES Y SOPORTE RÁPIDO */}
        <div className="acrylic-card" style={{
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          border: '1px solid var(--border-acrylic)',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>
                CENTRO DE ACCIONES Y SOPORTE
              </span>
              <Zap size={18} color="var(--accent-secondary)" />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                onClick={onExportExcel}
                className="btn-flat btn-excel"
                style={{
                  width: '100%',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: '10px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileSpreadsheet size={16} />
                  <span style={{ fontWeight: 700 }}>Descargar Base Completa (Excel)</span>
                </div>
                <ArrowRight size={14} />
              </button>

              <div style={{
                padding: '12px',
                borderRadius: '10px',
                background: 'var(--bg-canvas-subtle)',
                border: '1px solid var(--border-acrylic)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  <LifeBuoy size={14} color="var(--accent-rose)" />
                  <span>Estado de Soporte TI: <strong>{openTickets} abiertas</strong></span>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  Tasa de resolución: <strong>{resolutionRate}%</strong> ({resolvedTickets} de {totalTickets} tickets resueltos por STIVIE y técnicos).
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            <CheckCircle2 size={13} color="var(--accent-emerald)" />
            <span>Base sincronizada • Agente STIVIE Activo</span>
          </div>
        </div>
      </div>

      {/* 2. NUEVA SECCIÓN CLAVE: RELACIÓN DE REPORTES SEGÚN HOSTNAME Y USUARIO */}
      <div className="acrylic-panel" style={{ padding: '22px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', marginBottom: '18px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BarChart3 size={20} color="var(--accent-secondary)" />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Métricas y Relación de Reportes / Incidencias
              </h3>
            </div>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Análisis y trazabilidad de incidencias reportadas por equipo (Hostname) y usuario solicitante
            </p>
          </div>

          {/* Sub-tabs selector: Hostname, Usuario, Categoría */}
          <div className="report-subtabs-container">
            <button
              type="button"
              onClick={() => setActiveReportTab('hostname')}
              className={`nav-tab-btn ${activeReportTab === 'hostname' ? 'nav-tab-active' : ''}`}
              style={{ fontSize: '0.76rem', padding: '6px 10px', flexShrink: 0, whiteSpace: 'nowrap' }}
            >
              <Monitor size={14} style={{ flexShrink: 0 }} />
              <span className="report-tab-desktop-text">Por Hostname ({reportsByHostname.length})</span>
              <span className="report-tab-mobile-text">Hostname ({reportsByHostname.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveReportTab('user')}
              className={`nav-tab-btn ${activeReportTab === 'user' ? 'nav-tab-active' : ''}`}
              style={{ fontSize: '0.76rem', padding: '6px 10px', flexShrink: 0, whiteSpace: 'nowrap' }}
            >
              <User size={14} style={{ flexShrink: 0 }} />
              <span className="report-tab-desktop-text">Por Usuario ({reportsByUser.length})</span>
              <span className="report-tab-mobile-text">Usuario ({reportsByUser.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveReportTab('category')}
              className={`nav-tab-btn ${activeReportTab === 'category' ? 'nav-tab-active' : ''}`}
              style={{ fontSize: '0.76rem', padding: '6px 10px', flexShrink: 0, whiteSpace: 'nowrap' }}
            >
              <Layers size={14} style={{ flexShrink: 0 }} />
              <span className="report-tab-desktop-text">Por Categoría ({categoryStats.length})</span>
              <span className="report-tab-mobile-text">Categoría ({categoryStats.length})</span>
            </button>
          </div>
        </div>

        {/* 2.1 TAB A: RELACIÓN POR HOSTNAME */}
        {activeReportTab === 'hostname' && (
          <div>
            {reportsByHostname.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '35px 20px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                <Sparkles size={28} color="var(--accent-emerald)" style={{ margin: '0 auto 8px' }} />
                No hay incidencias reportadas aún en ningún equipo.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-acrylic)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                      <th style={{ padding: '10px 14px' }}>EQUIPO (HOSTNAME)</th>
                      <th style={{ padding: '10px 14px' }}>IP / UBICACIÓN</th>
                      <th style={{ padding: '10px 14px' }}>TOTAL INCIDENCIAS</th>
                      <th style={{ padding: '10px 14px' }}>ESTADO</th>
                      <th style={{ padding: '10px 14px' }}>FALLA MÁS FRECUENTE</th>
                      <th style={{ padding: '10px 14px' }}>USUARIOS REPORTANTES</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right' }}>RESOLUCIÓN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportsByHostname.map((item) => {
                      const resPct = item.count > 0 ? Math.round(((item.count - item.openCount) / item.count) * 100) : 100;
                      return (
                        <tr
                          key={item.hostname}
                          style={{
                            borderBottom: '1px solid var(--border-acrylic)',
                            transition: 'background 0.15s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-canvas-subtle)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <td style={{ padding: '12px 14px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Monitor size={15} color="var(--accent-secondary)" />
                              <span>{item.hostname}</span>
                            </div>
                          </td>

                          <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>
                            {item.device?.ipAddress || 'Sin IP'} • {item.device?.location || 'Estación'}
                          </td>

                          <td style={{ padding: '12px 14px' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: '2px 9px',
                              borderRadius: '9999px',
                              fontSize: '0.78rem',
                              fontWeight: 800,
                              background: item.count > 2 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                              color: item.count > 2 ? 'var(--accent-rose)' : 'var(--accent-amber)',
                              border: `1px solid ${item.count > 2 ? 'rgba(239, 68, 68, 0.35)' : 'rgba(245, 158, 11, 0.35)'}`
                            }}>
                              {item.count} {item.count === 1 ? 'reporte' : 'reportes'}
                            </span>
                          </td>

                          <td style={{ padding: '12px 14px' }}>
                            {item.openCount > 0 ? (
                              <span style={{ color: 'var(--accent-rose)', fontWeight: 700, fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <AlertTriangle size={12} />
                                <span>{item.openCount} pendientes</span>
                              </span>
                            ) : (
                              <span style={{ color: 'var(--accent-emerald)', fontWeight: 700, fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <CheckCircle2 size={12} />
                                <span>Todos resueltos</span>
                              </span>
                            )}
                          </td>

                          <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>
                            <span style={{
                              background: 'var(--bg-canvas-subtle)',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontSize: '0.74rem'
                            }}>
                              {item.topCategory}
                            </span>
                          </td>

                          <td style={{ padding: '12px 14px', color: 'var(--text-primary)', fontSize: '0.78rem' }}>
                            {item.usersList.join(', ') || 'Usuario local'}
                          </td>

                          <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                              <span style={{ fontSize: '0.76rem', fontWeight: 800, color: resPct === 100 ? 'var(--accent-emerald)' : 'var(--accent-primary)' }}>
                                {resPct}%
                              </span>
                              <div style={{ width: '40px', height: '5px', borderRadius: '3px', backgroundColor: 'var(--border-acrylic)', overflow: 'hidden' }}>
                                <div style={{
                                  width: `${resPct}%`,
                                  height: '100%',
                                  backgroundColor: resPct === 100 ? 'var(--accent-emerald)' : 'var(--accent-primary)'
                                }} />
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 2.2 TAB B: RELACIÓN POR USUARIO */}
        {activeReportTab === 'user' && (
          <div>
            {reportsByUser.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '35px 20px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                No hay incidencias registradas por usuarios.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-acrylic)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                      <th style={{ padding: '10px 14px' }}>NOMBRE DE USUARIO</th>
                      <th style={{ padding: '10px 14px' }}>EQUIPOS RELACIONADOS</th>
                      <th style={{ padding: '10px 14px' }}>CANTIDAD DE REPORTES</th>
                      <th style={{ padding: '10px 14px' }}>INCIDENCIAS ABIERTAS</th>
                      <th style={{ padding: '10px 14px' }}>TIPO DE FALLA FRECUENTE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportsByUser.map((userItem) => (
                      <tr
                        key={userItem.userName}
                        style={{
                          borderBottom: '1px solid var(--border-acrylic)',
                          transition: 'background 0.15s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-canvas-subtle)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <td style={{ padding: '12px 14px', fontWeight: 800, color: 'var(--text-primary)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <User size={15} color="var(--accent-primary)" />
                            <span>{userItem.userName}</span>
                          </div>
                        </td>

                        <td style={{ padding: '12px 14px', fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-cyan)' }}>
                          {userItem.hostnamesList.join(', ') || 'N/A'}
                        </td>

                        <td style={{ padding: '12px 14px' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '2px 9px',
                            borderRadius: '9999px',
                            fontSize: '0.78rem',
                            fontWeight: 800,
                            background: 'rgba(139, 92, 246, 0.15)',
                            color: 'var(--accent-primary)',
                            border: '1px solid rgba(139, 92, 246, 0.35)'
                          }}>
                            {userItem.count} {userItem.count === 1 ? 'ticket' : 'tickets'}
                          </span>
                        </td>

                        <td style={{ padding: '12px 14px' }}>
                          {userItem.openCount > 0 ? (
                            <span style={{ color: 'var(--accent-rose)', fontWeight: 700, fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <AlertTriangle size={12} />
                              <span>{userItem.openCount} pendientes</span>
                            </span>
                          ) : (
                            <span style={{ color: 'var(--accent-emerald)', fontWeight: 700, fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <CheckCircle2 size={12} />
                              <span>0 pendientes</span>
                            </span>
                          )}
                        </td>

                        <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>
                          <span style={{
                            background: 'var(--bg-canvas-subtle)',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontSize: '0.74rem'
                          }}>
                            {userItem.topCategory}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 2.3 TAB C: DISTRIBUCIÓN POR CATEGORÍA DE FALLA */}
        {activeReportTab === 'category' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', marginTop: '10px' }}>
            {categoryStats.map((item) => (
              <div key={item.category} className="acrylic-card" style={{ padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {item.category}
                  </span>
                  <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--accent-secondary)' }}>
                    {item.count} ({item.percent}%)
                  </span>
                </div>
                <div style={{ width: '100%', height: '8px', borderRadius: '4px', backgroundColor: 'var(--border-acrylic)', overflow: 'hidden' }}>
                  <div style={{
                    width: `${item.percent}%`,
                    height: '100%',
                    backgroundColor: item.category.toLowerCase().includes('pantalla') ? 'var(--accent-rose)' : 'var(--accent-primary)',
                    borderRadius: '4px'
                  }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. PARQUE POR CATEGORÍA DE EQUIPO (CLICK PARA FILTRAR) */}
      <div>
        <div style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '12px', letterSpacing: '0.03em' }}>
          PARQUE POR CATEGORÍA DE EQUIPO (CLICK PARA FILTRAR)
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: '12px'
        }}>
          {categories.map((cat) => {
            const Icon = cat.icon;
            return (
              <div
                key={cat.id}
                onClick={() => onNavigateToCategory(cat.id)}
                className="acrylic-card"
                style={{
                  padding: '16px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  cursor: 'pointer',
                  borderBottom: `2px solid ${cat.color}`
                }}
              >
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--bg-canvas-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Icon size={20} color={cat.color} />
                </div>

                <div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>
                    {cat.count}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                    {cat.label}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. BITÁCORA DE ACTIVIDAD Y AUDITORÍA EN TIEMPO REAL */}
      <div className="acrylic-panel" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={16} color="var(--accent-primary)" />
            <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Bitácora de Eventos y Levantamientos Recientes
            </span>
          </div>

          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {logs.length} registros en historial
          </span>
        </div>

        {logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
            No hay registros recientes aún. Ejecute el agente en un equipo para ver los eventos en tiempo real.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
            {logs.slice(0, 10).map((log) => {
              const matchingDevice = devices.find(d => d.id === log.deviceId);
              return (
                <div
                  key={log.id}
                  onClick={() => matchingDevice && onSelectDevice(matchingDevice)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '9px 14px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-canvas-subtle)',
                    border: '1px solid var(--border-acrylic)',
                    cursor: matchingDevice ? 'pointer' : 'default'
                  }}
                  title={matchingDevice ? `Ver activo: ${matchingDevice.hostname}` : undefined}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: log.action.includes('audit') ? 'rgba(16, 185, 129, 0.15)' : 'rgba(139, 92, 246, 0.15)',
                      color: log.action.includes('audit') ? 'var(--accent-emerald)' : 'var(--accent-primary)',
                      fontFamily: 'JetBrains Mono, monospace'
                    }}>
                      {log.action.toUpperCase()}
                    </span>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                      {log.details || 'Evento del sistema'}
                    </span>
                  </div>

                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
