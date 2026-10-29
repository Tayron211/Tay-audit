import React, { useMemo, useState, useRef, useLayoutEffect } from 'react';
import {
  Monitor,
  Laptop,
  Server,
  Printer,
  Network,
  Tv,
  Box,
  CheckCircle2,
  Archive,
  Wrench,
  XCircle,
  MapPin,
  Building,
  Layers,
  ArrowRight,
  HardDrive,
  Volume2,
  Projector
} from 'lucide-react';
import type { Device, DeviceType, SystemStats } from '../types';

interface InventoryDashboardViewProps {
  devices: Device[];
  stats: SystemStats;
  onFilterByType: (type: string) => void;
}

export const InventoryDashboardView: React.FC<InventoryDashboardViewProps> = ({
  devices,
  stats: _stats,
  onFilterByType
}) => {
  const total = devices.length;

  const fleetBarRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const arrowRef = useRef<HTMLDivElement>(null);

  // Tooltip acrílico interactivo con posicionamiento milimétrico sobre el segmento activo
  const [activeTooltip, setActiveTooltip] = useState<{
    item: {
      id: DeviceType;
      name: string;
      color: string;
      count: number;
      pct: number;
    };
    segmentCenter: number;
  } | null>(null);

  // Calcula el centrado exacto y delimitación para que el contenido quede 100% centrado sin truncar
  useLayoutEffect(() => {
    if (!activeTooltip || !tooltipRef.current || !fleetBarRef.current) return;
    const barW = fleetBarRef.current.offsetWidth;
    const tipW = tooltipRef.current.offsetWidth;
    const segCenter = activeTooltip.segmentCenter;

    // Centra la burbuja horizontalmente en el segmento
    const idealLeft = segCenter - tipW / 2;
    // Delimita para no desbordar los extremos de la barra
    const clampedLeft = Math.max(0, Math.min(barW - tipW, idealLeft));
    // Ubica la flecha para que apunte con exactitud al centro del segmento
    const arrowPos = segCenter - clampedLeft;
    const clampedArrow = Math.max(14, Math.min(tipW - 14, arrowPos));

    tooltipRef.current.style.left = `${clampedLeft}px`;
    if (arrowRef.current) {
      arrowRef.current.style.left = `${clampedArrow}px`;
    }
  }, [activeTooltip]);

  // Normalizador seguro de tipos
  const normalizeType = (type?: string): DeviceType => {
    const t = (type || '').toLowerCase();
    if (t === 'pc' || t === 'desktop' || t === 'ensamblada') return 'pc';
    if (t === 'laptop' || t === 'portatil' || t === 'notebook') return 'laptop';
    if (t === 'server' || t === 'servidor') return 'server';
    if (t === 'printer' || t === 'impresora') return 'printer';
    if (t === 'network' || t === 'switch' || t === 'router' || t === 'red') return 'network';
    if (t === 'monitor' || t === 'pantalla') return 'monitor';
    if (t === 'speaker' || t === 'parlante' || t === 'altavoz' || t === 'audio') return 'speaker';
    if (t === 'ecran' || t === 'proyector' || t === 'telon' || t === 'pantalla_proyeccion') return 'ecran';
    return 'other';
  };

  // 1. Métricas detalladas por Tipo de Equipo
  const typeMetrics = useMemo(() => {
    const map: Record<DeviceType, {
      id: DeviceType;
      name: string;
      desc: string;
      icon: React.ComponentType<{ size?: number; color?: string; style?: React.CSSProperties }>;
      color: string;
      bgLight: string;
      borderLight: string;
      count: number;
      pct: number;
      installed: number;
      custody: number;
      maintenance: number;
      baja: number;
      online: number;
    }> = {
      pc: {
        id: 'pc',
        name: 'PCs de Escritorio / Ensambladas',
        desc: 'Workstations y equipos ensamble',
        icon: Monitor,
        color: '#8b5cf6',
        bgLight: 'rgba(139, 92, 246, 0.12)',
        borderLight: 'rgba(139, 92, 246, 0.25)',
        count: 0,
        pct: 0,
        installed: 0,
        custody: 0,
        maintenance: 0,
        baja: 0,
        online: 0
      },
      laptop: {
        id: 'laptop',
        name: 'Laptops / Portátiles',
        desc: 'Equipos móviles y directivos',
        icon: Laptop,
        color: '#38bdf8',
        bgLight: 'rgba(56, 189, 248, 0.12)',
        borderLight: 'rgba(56, 189, 248, 0.25)',
        count: 0,
        pct: 0,
        installed: 0,
        custody: 0,
        maintenance: 0,
        baja: 0,
        online: 0
      },
      server: {
        id: 'server',
        name: 'Servidores de Producción',
        desc: 'Nodos de cómputo y misión crítica',
        icon: Server,
        color: '#f59e0b',
        bgLight: 'rgba(245, 158, 11, 0.12)',
        borderLight: 'rgba(245, 158, 11, 0.25)',
        count: 0,
        pct: 0,
        installed: 0,
        custody: 0,
        maintenance: 0,
        baja: 0,
        online: 0
      },
      printer: {
        id: 'printer',
        name: 'Impresoras & Multifuncionales',
        desc: 'Dispositivos de red y térmicas',
        icon: Printer,
        color: '#10b981',
        bgLight: 'rgba(16, 185, 129, 0.12)',
        borderLight: 'rgba(16, 185, 129, 0.25)',
        count: 0,
        pct: 0,
        installed: 0,
        custody: 0,
        maintenance: 0,
        baja: 0,
        online: 0
      },
      network: {
        id: 'network',
        name: 'Equipos de Red & Telecom',
        desc: 'Switches, Routers, APs y Firewalls',
        icon: Network,
        color: '#ec4899',
        bgLight: 'rgba(236, 72, 153, 0.12)',
        borderLight: 'rgba(236, 72, 153, 0.25)',
        count: 0,
        pct: 0,
        installed: 0,
        custody: 0,
        maintenance: 0,
        baja: 0,
        online: 0
      },
      monitor: {
        id: 'monitor',
        name: 'Monitores & Pantallas',
        desc: 'Displays individuales y secundarios',
        icon: Tv,
        color: '#06b6d4',
        bgLight: 'rgba(6, 182, 212, 0.12)',
        borderLight: 'rgba(6, 182, 212, 0.25)',
        count: 0,
        pct: 0,
        installed: 0,
        custody: 0,
        maintenance: 0,
        baja: 0,
        online: 0
      },
      speaker: {
        id: 'speaker',
        name: 'Parlantes & Audio',
        desc: 'Sistemas de sonido y periféricos de audio',
        icon: Volume2,
        color: '#f97316',
        bgLight: 'rgba(249, 115, 22, 0.12)',
        borderLight: 'rgba(249, 115, 22, 0.25)',
        count: 0,
        pct: 0,
        installed: 0,
        custody: 0,
        maintenance: 0,
        baja: 0,
        online: 0
      },
      ecran: {
        id: 'ecran',
        name: 'Ecran & Proyección',
        desc: 'Pantallas retráctiles y proyectores',
        icon: Projector,
        color: '#ec4899',
        bgLight: 'rgba(236, 72, 153, 0.12)',
        borderLight: 'rgba(236, 72, 153, 0.25)',
        count: 0,
        pct: 0,
        installed: 0,
        custody: 0,
        maintenance: 0,
        baja: 0,
        online: 0
      },
      other: {
        id: 'other',
        name: 'Otros Activos & Periféricos',
        desc: 'UPS/SAI, periféricos y accesorios',
        icon: Box,
        color: '#a855f7',
        bgLight: 'rgba(168, 85, 247, 0.12)',
        borderLight: 'rgba(168, 85, 247, 0.25)',
        count: 0,
        pct: 0,
        installed: 0,
        custody: 0,
        maintenance: 0,
        baja: 0,
        online: 0
      }
    };

    devices.forEach(d => {
      const t = normalizeType(d.deviceType);
      const target = map[t] || map.other;
      target.count += 1;
      
      const st = (d.status || '').toLowerCase();
      if (st === 'instalado' || st === 'online' || st === 'audited') {
        target.installed += 1;
      } else if (st === 'custodia') {
        target.custody += 1;
      } else if (st === 'maintenance' || st === 'mantenimiento') {
        target.maintenance += 1;
      } else if (st === 'baja') {
        target.baja += 1;
      } else {
        target.installed += 1;
      }

      if (st === 'online' || (d.lastAuditDate && (Date.now() - new Date(d.lastAuditDate).getTime()) < 3600000 * 24 * 7)) {
        target.online += 1;
      }
    });

    Object.values(map).forEach(item => {
      item.pct = total > 0 ? Math.round((item.count / total) * 1000) / 10 : 0;
    });

    return map;
  }, [devices, total]);

  // 2. Estado Operativo General
  const statusOverview = useMemo(() => {
    let installed = 0;
    let custody = 0;
    let maintenance = 0;
    let baja = 0;

    devices.forEach(d => {
      const s = (d.status || '').toLowerCase();
      if (s === 'instalado' || s === 'online' || s === 'audited') installed++;
      else if (s === 'custodia') custody++;
      else if (s === 'maintenance' || s === 'mantenimiento') maintenance++;
      else if (s === 'baja') baja++;
      else installed++;
    });

    return {
      installed,
      installedPct: total > 0 ? Math.round((installed / total) * 100) : 0,
      custody,
      custodyPct: total > 0 ? Math.round((custody / total) * 100) : 0,
      maintenance,
      maintenancePct: total > 0 ? Math.round((maintenance / total) * 100) : 0,
      baja,
      bajaPct: total > 0 ? Math.round((baja / total) * 100) : 0
    };
  }, [devices, total]);

  // 3. Distribución por Ubicación Física
  const locationBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    devices.forEach(d => {
      const loc = (d.location || 'Sin Ubicación Asignada').trim();
      counts[loc] = (counts[loc] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, count]) => ({
        name,
        count,
        pct: total > 0 ? Math.round((count / total) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [devices, total]);

  // 4. Distribución por Departamento
  const departmentBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    devices.forEach(d => {
      const dept = (d.department || 'Sin Departamento').trim();
      counts[dept] = (counts[dept] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, count]) => ({
        name,
        count,
        pct: total > 0 ? Math.round((count / total) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [devices, total]);

  // 5. Distribución de Sistemas Operativos
  const osBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    devices.forEach(d => {
      let os = d.os || 'Windows Estándar';
      if (os.toLowerCase().includes('windows 11')) os = 'Windows 11';
      else if (os.toLowerCase().includes('windows 10')) os = 'Windows 10';
      else if (os.toLowerCase().includes('server')) os = 'Windows Server';
      else if (os.toLowerCase().includes('linux') || os.toLowerCase().includes('ubuntu')) os = 'Linux / GNU';
      counts[os] = (counts[os] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, count]) => ({
        name,
        count,
        pct: total > 0 ? Math.round((count / total) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
  }, [devices, total]);

  const cardsList = [
    typeMetrics.pc,
    typeMetrics.laptop,
    typeMetrics.server,
    typeMetrics.printer,
    typeMetrics.network,
    typeMetrics.monitor,
    typeMetrics.other
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      
      {/* 1. SECCIÓN DE CABECERA: RESUMEN EJECUTIVO DE ACTIVOS */}
      <div 
        className="acrylic-card"
        style={{
          padding: '20px 24px',
          borderRadius: '14px',
          border: '1px solid var(--border-acrylic)',
          boxShadow: '0 4px 18px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
            <div style={{
              width: '42px',
              height: '42px',
              minWidth: '42px',
              minHeight: '42px',
              aspectRatio: '1 / 1',
              borderRadius: '10px',
              backgroundColor: 'rgba(139, 92, 246, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-primary)',
              boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.1)',
              flexShrink: 0
            }}>
              <Layers size={22} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Censo & Métricas de Inventario por Tipo de Equipo
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '3px 0 0 0' }}>
                Auditoría cuantitativa en tiempo real de parque computacional, infraestructura y periféricos
              </p>
            </div>
          </div>
        </div>

        {/* Barra de Proporción General de la Flota (100% Visual Fleet Makeup con Tooltip Acrílico) */}
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '0.74rem' }}>
            <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>
              Composición Visual de la Flota ({total} Activos Totales):
            </span>
            <span style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>
              100% Inventariado
            </span>
          </div>

          {/* Contenedor relativo de la barra y el tooltip */}
          <div style={{ position: 'relative', width: '100%' }}>
            <div
              ref={fleetBarRef}
              style={{
                width: '100%',
                height: '14px',
                borderRadius: '7px',
                backgroundColor: 'rgba(148, 163, 184, 0.12)',
                overflow: 'hidden',
                display: 'flex',
                padding: '2px',
                boxSizing: 'border-box',
                gap: '2px'
              }}
            >
              {cardsList.map((item) => {
                if (item.count === 0) return null;
                const isHovered = activeTooltip?.item.id === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => onFilterByType(item.id)}
                    onMouseEnter={(e) => {
                      const seg = e.currentTarget.getBoundingClientRect();
                      const bar = fleetBarRef.current?.getBoundingClientRect();
                      if (bar) {
                        setActiveTooltip({
                          item,
                          segmentCenter: (seg.left - bar.left) + seg.width / 2
                        });
                      }
                    }}
                    onMouseMove={(e) => {
                      const seg = e.currentTarget.getBoundingClientRect();
                      const bar = fleetBarRef.current?.getBoundingClientRect();
                      if (bar) {
                        setActiveTooltip({
                          item,
                          segmentCenter: (seg.left - bar.left) + seg.width / 2
                        });
                      }
                    }}
                    onMouseLeave={() => setActiveTooltip(null)}
                    style={{
                      width: `${item.pct}%`,
                      height: '100%',
                      backgroundColor: item.color,
                      borderRadius: '4px',
                      cursor: 'pointer',
                      transition: 'transform 0.15s ease, filter 0.15s ease, opacity 0.15s ease',
                      filter: isHovered ? 'brightness(1.25) drop-shadow(0 0 5px ' + item.color + ')' : 'none',
                      opacity: activeTooltip && !isHovered ? 0.6 : 1,
                      transform: isHovered ? 'scaleY(1.15)' : 'none'
                    }}
                  />
                );
              })}
            </div>

            {/* Tooltip Acrílico con contenido 100% centrado y balanceado */}
            {activeTooltip && (
              <div
                ref={tooltipRef}
                className="fleet-bar-tooltip"
                style={{
                  position: 'absolute',
                  bottom: 'calc(100% + 9px)',
                  left: 0,
                  width: 'max-content',
                  boxSizing: 'border-box',
                  pointerEvents: 'none',
                  zIndex: 100,
                  padding: '9px 18px',
                  borderRadius: '12px',
                  background: 'var(--bg-canvas)',
                  backgroundImage: 'linear-gradient(var(--bg-canvas-subtle), var(--bg-canvas-subtle))',
                  border: `1.5px solid ${activeTooltip.item.color}`,
                  boxShadow: `0 10px 26px rgba(0, 0, 0, 0.45), 0 0 14px ${activeTooltip.item.color}35`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  gap: '3px',
                  animation: 'fleetTooltipFadeIn 0.15s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)'
                }}
              >
                {/* Línea 1: Punto de color + Nombre de Categoría (centrados) */}
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '7px',
                  fontSize: '0.80rem',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  whiteSpace: 'nowrap',
                  lineHeight: 1.2
                }}>
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: activeTooltip.item.color,
                      boxShadow: `0 0 8px ${activeTooltip.item.color}`,
                      flexShrink: 0,
                      display: 'inline-block'
                    }}
                  />
                  <span>{activeTooltip.item.name}</span>
                </div>

                {/* Línea 2: Conteo y Porcentaje de Flota (centrados) */}
                <div style={{
                  fontSize: '0.72rem',
                  color: 'var(--text-secondary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  lineHeight: 1.2
                }}>
                  <strong style={{ color: activeTooltip.item.color, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
                    {activeTooltip.item.count} {activeTooltip.item.count === 1 ? 'equipo' : 'equipos'}
                  </strong>
                  <span style={{ color: 'var(--text-muted)' }}>•</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {activeTooltip.item.pct}% de la flota
                  </span>
                </div>

                {/* Flecha indicadora apuntando directamente hacia el segmento debajo */}
                <div
                  ref={arrowRef}
                  style={{
                    position: 'absolute',
                    bottom: '-5.5px',
                    left: '50%',
                    transform: 'translateX(-50%) rotate(45deg)',
                    width: '9px',
                    height: '9px',
                    backgroundColor: 'var(--bg-canvas)',
                    borderRight: `1.5px solid ${activeTooltip.item.color}`,
                    borderBottom: `1.5px solid ${activeTooltip.item.color}`
                  }}
                />
              </div>
            )}
          </div>

          {/* Leyenda Compacta de la Barra (Informativa y Estática) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '14px',
            marginTop: '10px',
            fontSize: '0.72rem',
            userSelect: 'none'
          }}>
            {cardsList.map((item) => (
              <div 
                key={item.id} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px', 
                  cursor: 'default',
                  opacity: item.count > 0 ? 1 : 0.45
                }}
              >
                <span style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: item.color,
                  flexShrink: 0
                }} />
                <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {item.name.split('/')[0].trim()}
                </span>
                <span style={{ color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem' }}>
                  ({item.count})
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 2. RECUADROS POR TIPO DE EQUIPO (Muestra Cuántos Equipos de Cada Tipo Hay) */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.01em' }}>
            Desglose Específico por Tipo de Activo
          </h4>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Haz clic en "Ver lista" para filtrar la tabla de equipos
          </span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
          gap: '14px'
        }}>
          {cardsList.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                className="acrylic-card"
                style={{
                  padding: '16px 18px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-acrylic)',
                  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '12px',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                }}
              >
                <div>
                  {/* Encabezado del Tipo */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '9px',
                        backgroundColor: item.bgLight,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: item.color,
                        flexShrink: 0
                      }}>
                        <Icon size={19} />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                          {item.name}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {item.desc}
                        </div>
                      </div>
                    </div>

                    <span style={{
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      backgroundColor: item.bgLight,
                      color: item.color,
                      border: `1px solid ${item.borderLight}`,
                      fontFamily: 'JetBrains Mono, monospace',
                      whiteSpace: 'nowrap'
                    }}>
                      {item.pct}%
                    </span>
                  </div>

                  {/* Conteo Grande y Destacado */}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
                    <span style={{
                      fontSize: '2.1rem',
                      fontWeight: 800,
                      fontFamily: 'JetBrains Mono, monospace',
                      color: 'var(--text-primary)',
                      lineHeight: 1
                    }}>
                      {item.count}
                    </span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      equipos inventariados
                    </span>
                  </div>

                  {/* Mini barra de porcentaje respecto a la flota total */}
                  <div style={{
                    width: '100%',
                    height: '5px',
                    borderRadius: '2.5px',
                    backgroundColor: 'rgba(148, 163, 184, 0.12)',
                    overflow: 'hidden',
                    marginBottom: '10px'
                  }}>
                    <div style={{
                      width: `${item.pct}%`,
                      height: '100%',
                      backgroundColor: item.color,
                      borderRadius: '2.5px'
                    }} />
                  </div>

                  {/* Resumen Limpio y Compacto de Disponibilidad */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.72rem',
                    color: 'var(--text-secondary)',
                    padding: '3px 0'
                  }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                      <span>{item.installed} operativos</span>
                    </span>
                    {item.custody > 0 && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#f59e0b' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
                        <span>{item.custody} custodia</span>
                      </span>
                    )}
                    {item.baja > 0 && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#ef4444' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
                        <span>{item.baja} baja</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Botón de Enlace Rápido al Listado con Alto Contraste */}
                <button
                  type="button"
                  onClick={() => onFilterByType(item.id)}
                  className="btn-flat"
                  style={{
                    width: '100%',
                    justifyContent: 'center',
                    padding: '7px 12px',
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    color: 'var(--text-primary)',
                    borderColor: 'var(--border-acrylic)',
                    backgroundColor: 'var(--bg-canvas-subtle)',
                    marginTop: '4px'
                  }}
                >
                  <span>Ver {item.count} en la lista</span>
                  <ArrowRight size={13} color={item.color} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. RESUMEN DE GOBERNANZA OPERATIVA & DISPONIBILIDAD */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '12px'
      }}>
        {/* KPI: Instalados */}
        <div 
          className="acrylic-card"
          style={{
            padding: '14px 16px',
            borderRadius: '12px',
            border: '1px solid var(--border-acrylic)',
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)' }}>
              INSTALADOS / EN PRODUCCIÓN
            </span>
            <CheckCircle2 size={16} color="#10b981" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'monospace', color: '#10b981' }}>
              {statusOverview.installed}
            </span>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              ({statusOverview.installedPct}% de la flota)
            </span>
          </div>
          <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Asignados a puestos de trabajo y operativos
          </p>
        </div>

        {/* KPI: En Custodia / Stock */}
        <div 
          className="acrylic-card"
          style={{
            padding: '14px 16px',
            borderRadius: '12px',
            border: '1px solid var(--border-acrylic)',
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)' }}>
              EN CUSTODIA / STOCK TI
            </span>
            <Archive size={16} color="#f59e0b" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'monospace', color: '#f59e0b' }}>
              {statusOverview.custody}
            </span>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              ({statusOverview.custodyPct}% de la flota)
            </span>
          </div>
          <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            En almacén listos para entrega o rotación
          </p>
        </div>

        {/* KPI: En Mantenimiento */}
        <div 
          className="acrylic-card"
          style={{
            padding: '14px 16px',
            borderRadius: '12px',
            border: '1px solid var(--border-acrylic)',
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)' }}>
              EN MANTENIMIENTO TÉCNICO
            </span>
            <Wrench size={16} color="var(--accent-cyan)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'monospace', color: 'var(--accent-cyan)' }}>
              {statusOverview.maintenance}
            </span>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              ({statusOverview.maintenancePct}%)
            </span>
          </div>
          <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            En diagnóstico o cambio de repuestos
          </p>
        </div>

        {/* KPI: De Baja */}
        <div 
          className="acrylic-card"
          style={{
            padding: '14px 16px',
            borderRadius: '12px',
            border: '1px solid var(--border-acrylic)',
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)' }}>
              DADOS DE BAJA / OBSOLETOS
            </span>
            <XCircle size={16} color="#ef4444" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'monospace', color: '#ef4444' }}>
              {statusOverview.baja}
            </span>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              ({statusOverview.bajaPct}%)
            </span>
          </div>
          <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Desactivados por fin de ciclo de vida
          </p>
        </div>
      </div>

      {/* 4. CONCENTRACIÓN POR UBICACIÓN & DEPARTAMENTOS */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '16px'
      }}>
        {/* Ubicación Física */}
        <div 
          className="acrylic-card"
          style={{
            padding: '18px 20px',
            borderRadius: '14px',
            border: '1px solid var(--border-acrylic)',
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <MapPin size={17} color="var(--accent-cyan)" />
            <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Equipos por Ubicación Física (Sedes & Pisos)
            </h4>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {locationBreakdown.length === 0 ? (
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Sin ubicaciones registradas</div>
            ) : (
              locationBreakdown.map((loc) => (
                <div key={loc.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{loc.name}</span>
                    <span style={{ fontFamily: 'monospace', color: 'var(--accent-cyan)', fontWeight: 700 }}>
                      {loc.count} equipos ({loc.pct}%)
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '6px', borderRadius: '3px', backgroundColor: 'rgba(148, 163, 184, 0.12)', overflow: 'hidden' }}>
                    <div style={{ width: `${loc.pct}%`, height: '100%', backgroundColor: 'var(--accent-cyan)', borderRadius: '3px' }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Departamentos */}
        <div 
          className="acrylic-card"
          style={{
            padding: '18px 20px',
            borderRadius: '14px',
            border: '1px solid var(--border-acrylic)',
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <Building size={17} color="var(--accent-primary)" />
            <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Equipos por Departamento & Área
            </h4>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {departmentBreakdown.length === 0 ? (
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Sin departamentos asignados</div>
            ) : (
              departmentBreakdown.map((dept) => (
                <div key={dept.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{dept.name}</span>
                    <span style={{ fontFamily: 'monospace', color: 'var(--accent-primary)', fontWeight: 700 }}>
                      {dept.count} equipos ({dept.pct}%)
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '6px', borderRadius: '3px', backgroundColor: 'rgba(148, 163, 184, 0.12)', overflow: 'hidden' }}>
                    <div style={{ width: `${dept.pct}%`, height: '100%', backgroundColor: 'var(--accent-primary)', borderRadius: '3px' }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 5. TELEMETRÍA DE HARDWARE Y SISTEMAS OPERATIVOS */}
      <div 
        className="acrylic-card"
        style={{
          padding: '18px 20px',
          borderRadius: '14px',
          border: '1px solid var(--border-acrylic)',
          boxShadow: '0 4px 14px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <HardDrive size={17} color="var(--accent-secondary)" />
            <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Distribución de Plataformas y Sistemas Operativos
            </h4>
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Detección automática por telemetría
          </span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '10px'
        }}>
          {osBreakdown.map((os) => (
            <div
              key={os.name}
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-canvas-subtle)',
                border: '1px solid var(--border-acrylic)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {os.name}
                </div>
                <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>
                  {os.pct}% de la flota
                </div>
              </div>
              <span style={{
                fontSize: '1.05rem',
                fontWeight: 800,
                fontFamily: 'monospace',
                color: 'var(--accent-secondary)'
              }}>
                {os.count}
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
