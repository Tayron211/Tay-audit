import React, { useState, useEffect } from 'react';
import { 
  ClipboardCheck, 
  Clock,
  BarChart3
} from 'lucide-react';
import type { Device, SystemStats, AuditLog } from '../types';
import { AuditListView } from './AuditListView';
import { InventoryDashboardView } from './InventoryDashboardView';

interface AuditSectionProps {
  devices: Device[];
  stats: SystemStats;
  logs: AuditLog[];
  onSelectDevice: (device: Device, initialEdit?: boolean) => void;
  onOpenAuditModal: () => void;
  onOpenScanner: () => void;
  onExportExcel: () => void;
  onDeviceUpdated: () => void;
  resetViewTrigger?: number;
}

const VALID_AUDIT_VIEWS = ['dashboard', 'list', 'logs'] as const;
type AuditView = typeof VALID_AUDIT_VIEWS[number];

const getInitialAuditView = (): AuditView => {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('view') as AuditView;
    if (VALID_AUDIT_VIEWS.includes(fromUrl)) return fromUrl;
    const fromStorage = localStorage.getItem('tay_audit_audit_view') as AuditView;
    if (VALID_AUDIT_VIEWS.includes(fromStorage)) return fromStorage;
  }
  return 'dashboard';
};

export const AuditSection: React.FC<AuditSectionProps> = ({
  devices,
  stats,
  logs,
  onSelectDevice,
  onOpenAuditModal,
  onOpenScanner,
  onExportExcel,
  onDeviceUpdated,
  resetViewTrigger
}) => {
  // Vista activa: 'dashboard' (Métricas por Tipo de Equipo) | 'list' | 'logs'
  const [activeView, setActiveView] = useState<AuditView>(() => getInitialAuditView());
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');

  // Si se presiona el botón de Ir al Inicio, resetea a la vista principal del dashboard
  useEffect(() => {
    if (resetViewTrigger && resetViewTrigger > 0) {
      setActiveView('dashboard');
      setSelectedCategoryFilter('all');
    }
  }, [resetViewTrigger]);

  useEffect(() => {
    localStorage.setItem('tay_audit_audit_view', activeView);
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') !== activeView) {
      params.set('view', activeView);
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState({ path: newUrl }, '', newUrl);
    }
  }, [activeView]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      
      {/* 1. SECTION HEADER & VIEW TOGGLE (Centrado, Ordenado, Simétrico y Sin Recortes) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px 14px',
        padding: '2px 0',
        width: '100%'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: 'clamp(0.98rem, 3.8vw, 1.10rem)', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.01em' }}>
            Inventario de Equipos & Activos
          </h2>
          <span style={{
            fontSize: '0.70rem',
            padding: '2.5px 8px',
            borderRadius: '6px',
            backgroundColor: 'rgba(148, 163, 184, 0.12)',
            border: '1px solid var(--border-acrylic)',
            color: 'var(--text-secondary)',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            lineHeight: 1.2
          }}>
            {devices.length} registrados
          </span>
        </div>

        <div className="audit-tabs-pill-container">
          {/* Sub-pestaña 1: Dashboard de Inventario */}
          <button
            type="button"
            onClick={() => setActiveView('dashboard')}
            className={`nav-tab-btn ${activeView === 'dashboard' ? 'nav-tab-active' : ''}`}
            style={{ fontSize: '0.74rem', padding: '4px 8px', flexShrink: 0, whiteSpace: 'nowrap', borderRadius: '6px' }}
          >
            <BarChart3 size={13} style={{ flexShrink: 0 }} />
            <span className="audit-tab-desktop-only">Dashboard por Tipo</span>
            <span className="audit-tab-mobile-only">Dashboard</span>
          </button>

          {/* Sub-pestaña 2: Lista de Equipos */}
          <button
            type="button"
            onClick={() => {
              setSelectedCategoryFilter('all');
              setActiveView('list');
            }}
            className={`nav-tab-btn ${activeView === 'list' ? 'nav-tab-active' : ''}`}
            style={{ fontSize: '0.74rem', padding: '4px 8px', flexShrink: 0, whiteSpace: 'nowrap', borderRadius: '6px' }}
          >
            <ClipboardCheck size={13} style={{ flexShrink: 0 }} />
            <span className="audit-tab-desktop-only">Lista de Equipos</span>
            <span className="audit-tab-mobile-only">Equipos</span>
          </button>

          {/* Sub-pestaña 3: Bitácora */}
          <button
            type="button"
            onClick={() => setActiveView('logs')}
            className={`nav-tab-btn ${activeView === 'logs' ? 'nav-tab-active' : ''}`}
            style={{ fontSize: '0.74rem', padding: '4px 8px', flexShrink: 0, whiteSpace: 'nowrap', borderRadius: '6px' }}
          >
            <Clock size={13} style={{ flexShrink: 0 }} />
            <span>Bitácora ({logs.length})</span>
          </button>
        </div>
      </div>

      {/* 3. VISTA 1: DASHBOARD DE MÉTRICAS & CENSO POR TIPO DE EQUIPO */}
      {activeView === 'dashboard' && (
        <InventoryDashboardView
          devices={devices}
          stats={stats}
          onFilterByType={(typeId) => {
            setSelectedCategoryFilter(typeId);
            setActiveView('list');
          }}
        />
      )}

      {/* 4. VISTA 2: LISTA DE EQUIPOS MULTICOLUMNA ORDENADA */}
      {activeView === 'list' && (
        <AuditListView
          devices={devices}
          onSelectDevice={onSelectDevice}
          onOpenAuditModal={onOpenAuditModal}
          onOpenScanner={onOpenScanner}
          onExportExcel={onExportExcel}
          onDeviceUpdated={onDeviceUpdated}
          initialCategoryFilter={selectedCategoryFilter}
        />
      )}

      {/* 4. VISTA 2: BITÁCORA DE MOVIMIENTOS (Organizada, limpia y espaciosa) */}
      {activeView === 'logs' && (
        <div className="acrylic-card" style={{ padding: 'clamp(14px, 3vw, 24px)', borderRadius: '16px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={18} color="var(--accent-primary)" />
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Bitácora de Movimientos y Registro
              </h3>
            </div>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              {logs.length} eventos registrados
            </span>
          </div>

          {logs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
              No hay movimientos de inventario registrados aún.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {logs.map((log) => {
                const matchingDevice = devices.find(d => d.id === log.deviceId);
                return (
                  <div
                    key={log.id}
                    onClick={() => matchingDevice && onSelectDevice(matchingDevice)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(148, 163, 184, 0.05)',
                      border: '1px solid var(--border-acrylic)',
                      cursor: matchingDevice ? 'pointer' : 'default',
                      transition: 'all 0.18s ease',
                      minWidth: 0,
                      overflow: 'hidden'
                    }}
                  >
                    {/* Top Row: Action Pill on Left, Hostname Pill on Right */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      minWidth: 0,
                      flexWrap: 'wrap'
                    }}>
                      <span style={{
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        padding: '3px 8px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(16, 185, 129, 0.15)',
                        color: '#10b981',
                        fontFamily: 'JetBrains Mono, monospace',
                        whiteSpace: 'nowrap'
                      }}>
                        {log.action.toUpperCase()}
                      </span>
                      {matchingDevice && (
                        <span style={{
                          fontSize: '0.72rem',
                          color: 'var(--accent-primary)',
                          fontFamily: 'JetBrains Mono, monospace',
                          fontWeight: 700,
                          backgroundColor: 'rgba(139, 92, 246, 0.12)',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          border: '1px solid rgba(139, 92, 246, 0.25)',
                          maxWidth: '100%',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          [{matchingDevice.hostname}]
                        </span>
                      )}
                    </div>

                    {/* Middle Row: Full readable details without any clipping or horizontal overflow */}
                    <div style={{
                      fontSize: '0.82rem',
                      fontWeight: 500,
                      color: 'var(--text-primary)',
                      lineHeight: 1.45,
                      wordBreak: 'break-word',
                      overflowWrap: 'anywhere',
                      minWidth: 0
                    }}>
                      {log.details || 'Registro en inventario'}
                    </div>

                    {/* Bottom Row: Metadata (Performer and Timestamp) */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '0.72rem',
                      color: 'var(--text-muted)',
                      flexWrap: 'wrap',
                      marginTop: '2px'
                    }}>
                      <span style={{ fontWeight: 600 }}>{log.performedBy || 'Sistema'}</span>
                      <span>•</span>
                      <span style={{ fontFamily: 'monospace' }}>
                        {new Date(log.timestamp).toLocaleDateString()} {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AuditSection;
