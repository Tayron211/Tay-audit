import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  Barcode, 
  ChevronDown, 
  Cpu, 
  HardDrive,
  Wifi, 
  User, 
  Check, 
  FileSpreadsheet, 
  Monitor,
  MapPin,
  Network,
  LayoutGrid,
  List
} from 'lucide-react';
import type { Device } from '../types';
import { getCategoryIcon } from './DeviceCard';
import {
  isComputerType,
  isSpeakerType,
  isMonitorType,
  isEcranType,
  isPrinterType,
  isComponentType,
  isNetworkType,
  supportsComputeSpecs,
  supportsNetworkAddress,
  isValidIpAddress,
  isValidMacAddress,
  getAssetSmartFields
} from '../utils/assetCategories';
import { Volume2, Tv, Projector, Droplet } from 'lucide-react';
import { api } from '../services/api';
import { scrollElementIntoView } from '../utils/autoScroll';
import { Pagination } from './Pagination';

interface AuditListViewProps {
  devices: Device[];
  onSelectDevice: (device: Device, initialEdit?: boolean) => void;
  onOpenAuditModal?: () => void;
  onOpenScanner: () => void;
  onExportExcel?: () => void;
  onDeviceUpdated?: () => void;
  initialCategoryFilter?: string;
}

export const AuditListView: React.FC<AuditListViewProps> = ({
  devices,
  onSelectDevice,
  onOpenScanner,
  onDeviceUpdated: _onDeviceUpdated,
  initialCategoryFilter
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(initialCategoryFilter || 'all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'instalado' | 'custodia' | 'maintenance' | 'baja'>('all');
  const [viewMode, setViewMode] = useState<'auto' | 'table' | 'cards'>('auto');

  useEffect(() => {
    if (initialCategoryFilter) {
      setCategoryFilter(initialCategoryFilter);
    }
  }, [initialCategoryFilter]);
  
  // Interactive accordion state: IDs of expanded cards
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      const isOpening = !next.has(id);
      if (isOpening) {
        next.add(id);
        // Scroll automático suave para asegurar que lo desplegado sea 100% visible
        setTimeout(() => {
          const el = document.getElementById(`inventory-card-${id}`) || 
                     document.getElementById(`inventory-card-mob-${id}`);
          if (el) {
            scrollElementIntoView(el, { delay: 60 });
          }
        }, 40);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleCopy = (text: string, id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Helper for status badge presentation
  const getDeviceStatusBadge = (status: string) => {
    switch (status) {
      case 'baja':
        return { className: 'status-baja', label: 'BAJA', dotColor: 'var(--accent-rose)' };
      case 'custodia':
        return { className: 'status-custodia', label: 'CUSTODIA', dotColor: 'var(--accent-amber)' };
      case 'maintenance':
      case 'mantenimiento':
        return { className: 'status-maintenance', label: 'MANTENIMIENTO', dotColor: 'var(--accent-cyan)' };
      case 'instalado':
      case 'online':
      case 'audited':
      default:
        return { className: 'status-instalado', label: 'INSTALADO', dotColor: 'var(--accent-emerald)' };
    }
  };

  // Helpers to clean up long telemetry strings into clean columnar metrics
  const formatCpuName = (cpu?: string) => {
    if (!cpu || cpu.toLowerCase() === 'no detectado') return 'No detectado';
    return cpu
      .replace(/\(R\)/gi, '')
      .replace(/\(TM\)/gi, '')
      .replace(/CPU\s*@.*$/gi, '')
      .replace(/Processor/gi, '')
      .trim();
  };

  const formatDiskString = (storage?: string) => {
    if (!storage || storage.toLowerCase() === 'no detectado') return 'No detectado';
    const match = storage.match(/C:\s*\(([^)]+)\)/i);
    if (match) return `C: ${match[1]}`;
    const firstDrive = storage.split('|')[0];
    return firstDrive.trim();
  };

  // Filtered devices list
  const filteredList = useMemo(() => {
    return devices.filter(d => {
      if (categoryFilter !== 'all' && d.deviceType !== categoryFilter) return false;

      if (statusFilter !== 'all') {
        if (statusFilter === 'instalado') {
          if (d.status !== 'instalado' && d.status !== 'online' && d.status !== 'audited') return false;
        } else if (statusFilter === 'custodia') {
          if (d.status !== 'custodia' && d.status !== 'offline') return false;
        } else if (statusFilter === 'maintenance') {
          if (d.status !== 'maintenance' && d.status !== 'mantenimiento') return false;
        } else if (statusFilter === 'baja') {
          if (d.status !== 'baja') return false;
        }
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const mHost = d.hostname.toLowerCase().includes(q);
        const mUser = (d.assignedUser || '').toLowerCase().includes(q);
        const mIP = (d.ipAddress || '').toLowerCase().includes(q);
        const mSerial = (d.serialNumber || '').toLowerCase().includes(q);
        const mDept = (d.department || '').toLowerCase().includes(q);
        const mBrand = (d.brand || '').toLowerCase().includes(q);
        const mModel = (d.model || '').toLowerCase().includes(q);
        const mLoc = (d.location || '').toLowerCase().includes(q);
        const mSpecs = (d.specs || '').toLowerCase().includes(q);
        const mOs = (d.os || '').toLowerCase().includes(q);
        return mHost || mUser || mIP || mSerial || mDept || mBrand || mModel || mLoc || mSpecs || mOs;
      }

      return true;
    });
  }, [devices, categoryFilter, statusFilter, searchQuery]);

  // Multipagina Numerada (Pagination)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) return 8;
    return 12;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [categoryFilter, statusFilter, searchQuery]);

  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredList.slice(start, start + pageSize);
  }, [filteredList, currentPage, pageSize]);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    const topEl = document.getElementById('inventory-list-top');
    if (topEl) {
      topEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Counts for filter pills
  const counts = useMemo(() => {
    return {
      total: devices.length,
      pc: devices.filter(d => d.deviceType === 'pc').length,
      laptop: devices.filter(d => d.deviceType === 'laptop').length,
      server: devices.filter(d => d.deviceType === 'server').length,
      printer: devices.filter(d => d.deviceType === 'printer').length,
      network: devices.filter(d => d.deviceType === 'network').length,
      speaker: devices.filter(d => d.deviceType === 'speaker').length,
      ecran: devices.filter(d => d.deviceType === 'ecran').length,
      monitor: devices.filter(d => d.deviceType === 'monitor').length,
      component: devices.filter(d => d.deviceType === 'component').length,
      instalado: devices.filter(d => d.status === 'instalado' || d.status === 'online' || d.status === 'audited').length,
      custodia: devices.filter(d => d.status === 'custodia' || d.status === 'offline').length,
      maintenance: devices.filter(d => d.status === 'maintenance' || d.status === 'mantenimiento').length,
      baja: devices.filter(d => d.status === 'baja').length,
    };
  }, [devices]);

  // Consistent Column Grid Template (Ultra-compact, no-wrap)
  const gridTemplate = 'minmax(195px, 1.4fr) minmax(130px, 1fr) 96px minmax(110px, 0.9fr) minmax(110px, 0.9fr) minmax(125px, 1fr) 110px';

  // Ficha técnica desplegable adaptativa e inteligente (reutilizable en desktop y mobile)
  const renderDetailDrawer = (device: Device) => {
    const isComp = isComputerType(device.deviceType);
    const isSpk = isSpeakerType(device.deviceType);
    const isMon = isMonitorType(device.deviceType);
    const isEcr = isEcranType(device.deviceType);
    const isPrn = isPrinterType(device.deviceType);
    const isCmp = isComponentType(device.deviceType);
    const isNet = isNetworkType(device.deviceType);
    const hasRealNetwork = supportsNetworkAddress(device.deviceType) && (isValidIpAddress(device.ipAddress) || isValidMacAddress(device.macAddress));
    const smart = getAssetSmartFields(device);

    return (
      <div
        className="inventory-card-drawer"
        style={{
          padding: '12px 14px',
          borderTop: '1px solid var(--border-acrylic)',
          background: 'rgba(15, 23, 42, 0.65)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}
      >
        {/* Tarjetas de Ficha Técnica Desplegadas Inteligentes */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '8px'
        }}>
          {/* Bloque 1: Identificación del Bien */}
          <div className="acrylic-card" style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-acrylic)', backgroundColor: 'var(--bg-acrylic-card)' }}>
            <div style={{
              fontSize: '0.68rem',
              fontWeight: 800,
              color: 'var(--accent-primary)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}>
              <Barcode size={12} />
              <span>{isComp ? 'Identificadores & Placa Base' : `Identificadores: ${smart.categoryBadge}`}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '0.72rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.62rem', fontWeight: 600, display: 'block', marginBottom: '2px' }}>Número de Serie (S/N):</span>
                <span
                  onClick={(e) => device.serialNumber && handleCopy(device.serialNumber, `sn-${device.id}`, e)}
                  className="copy-chip copy-chip-purple"
                  style={{ fontFamily: 'monospace' }}
                  title={device.serialNumber ? "Clic para copiar número de serie" : undefined}
                >
                  <span>{device.serialNumber || device.barcode || 'Sin S/N'}</span>
                  {copiedId === `sn-${device.id}` && <Check size={11} color="var(--accent-emerald)" />}
                </span>
              </div>
              {isComp ? (
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.62rem', fontWeight: 600, display: 'block', marginBottom: '2px' }}>Modelo de Placa Madre:</span>
                  <span
                    onClick={(e) => device.motherboard && handleCopy(device.motherboard, `mb-${device.id}`, e)}
                    className="copy-chip copy-chip-cyan"
                    title={device.motherboard ? "Clic para copiar placa madre" : undefined}
                  >
                    <span>{device.motherboard || 'Placa Base Estándar'}</span>
                    {copiedId === `mb-${device.id}` && <Check size={11} color="var(--accent-emerald)" />}
                  </span>
                </div>
              ) : (
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.62rem', fontWeight: 600, display: 'block', marginBottom: '2px' }}>Categoría de Bien:</span>
                  <span style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>{smart.box3Value}</span>
                </div>
              )}
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.62rem', fontWeight: 600, display: 'block', marginBottom: '2px' }}>Modelo / Marca:</span>
                <span
                  onClick={(e) => {
                    const modelStr = `${device.brand || ''} ${device.model || ''}`.trim() || 'Equipo Corporativo';
                    handleCopy(modelStr, `model-${device.id}`, e);
                  }}
                  className="copy-chip copy-chip-slate"
                  title="Clic para copiar modelo"
                >
                  <span>{`${device.brand || ''} ${device.model || ''}`.trim() || (isComp ? 'Computadora Ensamblada' : 'Equipo Corporativo')}</span>
                  {copiedId === `model-${device.id}` && <Check size={11} color="var(--accent-emerald)" />}
                </span>
              </div>
            </div>
          </div>

          {/* Bloque 2: Características Específicas del Bien */}
          <div className="acrylic-card" style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-acrylic)', backgroundColor: 'var(--bg-acrylic-card)' }}>
            <div style={{
              fontSize: '0.68rem',
              fontWeight: 800,
              color: 'var(--accent-cyan)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}>
              {isSpk && <Volume2 size={12} color="#f97316" />}
              {isMon && <Tv size={12} color="#06b6d4" />}
              {isEcr && <Projector size={12} color="#a855f7" />}
              {isPrn && <Droplet size={12} color="var(--accent-secondary)" />}
              {isCmp && <HardDrive size={12} color="#f59e0b" />}
              {isComp && <Cpu size={12} />}
              {isNet && <Network size={12} />}
              <span>
                {isSpk ? 'Especificaciones de Audio' :
                 isMon ? 'Especificaciones de Pantalla' :
                 isEcr ? 'Dimensiones y Formato' :
                 isPrn ? 'Suministros & Impresión' :
                 isCmp ? 'Detalles de Componente' :
                 isNet ? 'Puertos & Enlace de Red' :
                 'Hardware & Rendimiento'}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '0.72rem' }}>
              {isComp ? (
                <>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.62rem', fontWeight: 600, display: 'block', marginBottom: '2px' }}>Procesador:</span>
                    <span
                      onClick={(e) => device.cpu && handleCopy(device.cpu, `cpu-${device.id}`, e)}
                      className="copy-chip copy-chip-slate"
                      title={device.cpu ? "Clic para copiar procesador" : undefined}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{device.cpu || 'No detectado'}</span>
                      {copiedId === `cpu-${device.id}` && <Check size={11} color="var(--accent-emerald)" style={{ flexShrink: 0 }} />}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.62rem', fontWeight: 600, display: 'block' }}>Memoria RAM:</span>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{device.ram || 'No especificada'}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.62rem', fontWeight: 600, display: 'block' }}>Almacenamiento:</span>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{device.storage || 'Disco estándar'}</span>
                  </div>
                </>
              ) : isSpk ? (
                <>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.62rem', fontWeight: 600, display: 'block' }}>Conexión / Audio:</span>
                    <span style={{ fontWeight: 700, color: '#f97316' }}>{device.specs || 'Bluetooth 5.0 + Jack 3.5mm'}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.62rem', fontWeight: 600, display: 'block' }}>Tipo de Dispositivo:</span>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Altavoces / Parlantes Estéreo</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.62rem', fontWeight: 600, display: 'block' }}>Alimentación:</span>
                    <span style={{ color: 'var(--text-secondary)' }}>Fuente externa / USB 5V</span>
                  </div>
                </>
              ) : isMon ? (
                <>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.62rem', fontWeight: 600, display: 'block' }}>Panel y Entradas:</span>
                    <span style={{ fontWeight: 700, color: '#06b6d4' }}>{device.specs || 'Full HD (HDMI / DisplayPort / VGA)'}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.62rem', fontWeight: 600, display: 'block' }}>Pantalla Asociada:</span>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{device.model || 'Monitor LCD/LED'}</span>
                  </div>
                </>
              ) : isPrn ? (
                <>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.62rem', fontWeight: 600, display: 'block' }}>Tinta / Tóner Compatible:</span>
                    <span style={{ fontWeight: 800, color: '#10b981' }}>{device.supplies || 'Suministro oficial según catálogo'}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.62rem', fontWeight: 600, display: 'block' }}>Tipo de Conexión:</span>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{isValidIpAddress(device.ipAddress) ? `Red Ethernet / Wi-Fi (${device.ipAddress})` : 'Conexión USB Local'}</span>
                  </div>
                </>
              ) : isEcr ? (
                <>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.62rem', fontWeight: 600, display: 'block' }}>Medidas y Montaje:</span>
                    <span style={{ fontWeight: 700, color: '#a855f7' }}>{device.specs || 'Pantalla Retráctil 100" (Pared / Techo)'}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.62rem', fontWeight: 600, display: 'block' }}>Formato:</span>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Relación 4:3 / 16:9 Estándar</span>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.62rem', fontWeight: 600, display: 'block' }}>Especificaciones:</span>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{device.specs || device.storage || 'Componente de Cómputo'}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Bloque 3: Conectividad o Asignación */}
          <div className="acrylic-card" style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-acrylic)', backgroundColor: 'var(--bg-acrylic-card)' }}>
            <div style={{
              fontSize: '0.68rem',
              fontWeight: 800,
              color: hasRealNetwork ? 'var(--accent-primary)' : '#10b981',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}>
              {hasRealNetwork ? <Network size={12} /> : <MapPin size={12} />}
              <span>{hasRealNetwork ? 'Red & Conectividad' : 'Ubicación & Asignación'}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '0.72rem' }}>
              {hasRealNetwork ? (
                <>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.62rem', fontWeight: 600, display: 'block', marginBottom: '2px' }}>Dirección MAC (Hardware):</span>
                    <span
                      onClick={(e) => isValidMacAddress(device.macAddress) && handleCopy(device.macAddress, `mac-net-${device.id}`, e)}
                      className="copy-chip copy-chip-blue"
                      style={{ fontFamily: 'JetBrains Mono, monospace' }}
                      title={isValidMacAddress(device.macAddress) ? "Clic para copiar dirección MAC" : undefined}
                    >
                      <span>{isValidMacAddress(device.macAddress) ? device.macAddress : 'No detectada'}</span>
                      {copiedId === `mac-net-${device.id}` && <Check size={11} color="var(--accent-emerald)" />}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.62rem', fontWeight: 600, display: 'block', marginBottom: '2px' }}>Dirección IP (LAN):</span>
                    <span
                      onClick={(e) => isValidIpAddress(device.ipAddress) && handleCopy(device.ipAddress, `ip-net-${device.id}`, e)}
                      className="copy-chip copy-chip-cyan"
                      style={{ fontFamily: 'JetBrains Mono, monospace' }}
                      title="Clic para copiar IP"
                    >
                      <span>{isValidIpAddress(device.ipAddress) ? device.ipAddress : '127.0.0.1'}</span>
                      {copiedId === `ip-net-${device.id}` && <Check size={11} color="var(--accent-emerald)" />}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.62rem', fontWeight: 600, display: 'block' }}>Sistema / Protocolo:</span>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{device.os?.replace('Microsoft ', '') || (isNet ? 'TCP/IP Ethernet' : 'Windows')}</span>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.62rem', fontWeight: 600, display: 'block' }}>Ubicación Asignada:</span>
                    <span style={{ fontWeight: 700, color: '#10b981' }}>{device.location || 'Sede Central'}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.62rem', fontWeight: 600, display: 'block' }}>Responsable / Custodio:</span>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{device.assignedUser || 'Almacén TI / Stock'}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.62rem', fontWeight: 600, display: 'block' }}>Departamento:</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{device.department || 'Tecnologías de la Información'}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div id="inventory-list-top" style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      
      {/* 1. FILTER & SEARCH TOOLBAR (COMPACTO & RESPONSIVO) */}
      <div className="acrylic-panel" style={{
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '8px',
        borderRadius: '10px',
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        boxSizing: 'border-box'
      }}>
        {/* Search Input with Scanner Icon Button */}
        <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
          <Search
            size={14}
            color="var(--accent-primary)"
            style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            placeholder="Buscar por equipo, usuario, ubicación, S/N o IP..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="form-input"
            style={{
              paddingLeft: '32px',
              paddingRight: '38px',
              height: '32px',
              fontSize: '0.78rem',
              width: '100%'
            }}
          />
          <button
            type="button"
            onClick={onOpenScanner}
            className="btn-flat"
            style={{
              position: 'absolute',
              right: '4px',
              top: '50%',
              transform: 'translateY(-50%)',
              padding: '3px 6px',
              borderRadius: '5px',
              backgroundColor: 'rgba(148, 163, 184, 0.12)'
            }}
            title="Escanear Código QR o Código de Barras"
            aria-label="Escanear código"
          >
            <Barcode size={13} color="var(--accent-primary)" />
          </button>
        </div>

        {/* Category Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', maxWidth: '100%', minWidth: 0, paddingBottom: '2px' }}>
          {[
            { id: 'all', label: 'Todos', count: counts.total },
            { id: 'pc', label: 'PCs', count: counts.pc },
            { id: 'laptop', label: 'Laptops', count: counts.laptop },
            { id: 'server', label: 'Servidores', count: counts.server },
            { id: 'printer', label: 'Impresoras', count: counts.printer },
            { id: 'network', label: 'Red', count: counts.network },
            { id: 'speaker', label: 'Parlantes', count: counts.speaker },
            { id: 'ecran', label: 'Ecran', count: counts.ecran },
            { id: 'monitor', label: 'Monitores', count: counts.monitor },
            { id: 'component', label: 'Hardware', count: counts.component }
          ].map(c => {
            const isSelected = categoryFilter === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setCategoryFilter(c.id)}
                className={`btn-flat ${isSelected ? 'btn-primary' : ''}`}
                style={{
                  padding: '4px 8px',
                  fontSize: '0.69rem',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  borderRadius: '6px',
                  backgroundColor: isSelected ? 'var(--accent-primary)' : 'var(--bg-canvas-subtle)',
                  borderColor: isSelected ? 'var(--accent-primary)' : 'var(--border-acrylic)',
                  color: isSelected ? 'var(--accent-contrast, #000000)' : 'var(--text-secondary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: isSelected ? '0 1px 4px var(--accent-glow)' : 'none'
                }}
              >
                <span>{c.label}</span>
                <span style={{
                  fontSize: '0.62rem',
                  fontWeight: 900,
                  backgroundColor: isSelected ? 'rgba(0, 0, 0, 0.15)' : 'rgba(148, 163, 184, 0.18)',
                  color: isSelected ? 'var(--accent-contrast, #000000)' : 'var(--text-primary)',
                  padding: '1px 5px',
                  borderRadius: '9999px',
                  border: isSelected ? '1px solid rgba(0, 0, 0, 0.25)' : '1px solid var(--border-acrylic)',
                  minWidth: '16px',
                  textAlign: 'center',
                  lineHeight: '1.2'
                }}>
                  {c.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Status Filter & Actions Toolbar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
          width: '100%'
        }}>
          {/* Status Filters (Izquierda) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setStatusFilter(prev => prev === 'instalado' ? 'all' : 'instalado')}
              className={`btn-flat ${statusFilter === 'instalado' ? 'status-instalado' : ''}`}
              style={{
                padding: '4px 8px',
                fontSize: '0.68rem',
                fontWeight: 700,
                borderRadius: '6px',
                backgroundColor: statusFilter === 'instalado' ? undefined : 'var(--bg-canvas-subtle)',
                borderColor: statusFilter === 'instalado' ? undefined : 'var(--border-acrylic)',
                color: statusFilter === 'instalado' ? undefined : 'var(--text-secondary)'
              }}
            >
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: 'var(--accent-emerald)', display: 'inline-block' }} />
              <span>Instalados ({counts.instalado})</span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter(prev => prev === 'custodia' ? 'all' : 'custodia')}
              className={`btn-flat ${statusFilter === 'custodia' ? 'status-custodia' : ''}`}
              style={{
                padding: '4px 8px',
                fontSize: '0.68rem',
                fontWeight: 700,
                borderRadius: '6px',
                backgroundColor: statusFilter === 'custodia' ? undefined : 'var(--bg-canvas-subtle)',
                borderColor: statusFilter === 'custodia' ? undefined : 'var(--border-acrylic)',
                color: statusFilter === 'custodia' ? undefined : 'var(--text-secondary)'
              }}
            >
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: 'var(--accent-amber)', display: 'inline-block' }} />
              <span>Custodia ({counts.custodia})</span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter(prev => prev === 'maintenance' ? 'all' : 'maintenance')}
              className={`btn-flat ${statusFilter === 'maintenance' ? 'status-maintenance' : ''}`}
              style={{
                padding: '4px 8px',
                fontSize: '0.68rem',
                fontWeight: 700,
                borderRadius: '6px',
                backgroundColor: statusFilter === 'maintenance' ? undefined : 'var(--bg-canvas-subtle)',
                borderColor: statusFilter === 'maintenance' ? undefined : 'var(--border-acrylic)',
                color: statusFilter === 'maintenance' ? undefined : 'var(--text-secondary)'
              }}
              title="Filtrar equipos en mantenimiento técnico o reparación"
            >
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: 'var(--accent-cyan)', display: 'inline-block' }} />
              <span>Mantenimiento ({counts.maintenance})</span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter(prev => prev === 'baja' ? 'all' : 'baja')}
              className={`btn-flat ${statusFilter === 'baja' ? 'status-baja' : ''}`}
              style={{
                padding: '4px 8px',
                fontSize: '0.68rem',
                fontWeight: 700,
                borderRadius: '6px',
                backgroundColor: statusFilter === 'baja' ? undefined : 'var(--bg-canvas-subtle)',
                borderColor: statusFilter === 'baja' ? undefined : 'var(--border-acrylic)',
                color: statusFilter === 'baja' ? undefined : 'var(--text-secondary)'
              }}
              title="Filtrar equipos dados de baja u obsoletos"
            >
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: 'var(--accent-rose)', display: 'inline-block' }} />
              <span>De Baja ({counts.baja})</span>
            </button>
          </div>

          {/* Right Actions: Excel + View Switcher (Extremo Derecho Separado) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginLeft: 'auto',
            flexWrap: 'wrap'
          }}>
            {/* Export Excel Button */}
            <button
              type="button"
              onClick={() => window.open(api.getInventoryExcelDownloadUrl(), '_blank')}
              className="btn-flat btn-excel"
              style={{
                padding: '4px 10px',
                fontSize: '0.68rem',
                fontWeight: 700,
                borderRadius: '6px'
              }}
              title="Exportar inventario consolidado a Excel"
            >
              <FileSpreadsheet size={13} />
              <span>Excel</span>
            </button>

            {/* Segmented View Mode Switcher: Fichas vs Tabla */}
            <div 
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                backgroundColor: 'var(--bg-canvas-subtle)',
                borderRadius: '6px',
                border: '1px solid var(--border-acrylic)',
                padding: '2px',
                gap: '2px'
              }}
              title="Cambiar entre Fichas Táctiles (ideal tablets y móviles) o Tabla Columnar"
            >
              <button
                type="button"
                onClick={() => setViewMode(prev => prev === 'cards' ? 'auto' : 'cards')}
                className={`btn-flat ${viewMode === 'cards' ? 'btn-primary' : ''}`}
                style={{
                  padding: '3px 8px',
                  fontSize: '0.67rem',
                  fontWeight: 700,
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: viewMode === 'cards' ? 'var(--accent-primary)' : 'transparent',
                  color: viewMode === 'cards' ? 'var(--accent-contrast, #000000)' : 'var(--text-secondary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                title="Vista en Fichas Táctiles fluidas (100% responsiva para cualquier pantalla)"
              >
                <LayoutGrid size={12} />
                <span>Fichas</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode(prev => prev === 'table' ? 'auto' : 'table')}
                className={`btn-flat ${viewMode === 'table' ? 'btn-primary' : ''}`}
                style={{
                  padding: '3px 8px',
                  fontSize: '0.67rem',
                  fontWeight: 700,
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: viewMode === 'table' ? 'var(--accent-primary)' : 'transparent',
                  color: viewMode === 'table' ? 'var(--accent-contrast, #000000)' : 'var(--text-secondary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                title="Vista en Tabla Columnar completa"
              >
                <List size={12} />
                <span>Tabla</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. ENCABEZADO Y CONTENEDOR EN PATRÓN DE COLUMNAS (DESKTOP ULTRA-COMPACTO) */}
      <div 
        className={`desktop-inventory-table ${viewMode === 'cards' ? 'force-hidden' : ''} ${viewMode === 'table' ? 'force-visible' : ''}`} 
        style={{ 
          overflowX: 'auto', 
          WebkitOverflowScrolling: 'touch',
          width: '100%', 
          maxWidth: '100%',
          minWidth: 0,
          borderRadius: '8px',
          boxSizing: 'border-box'
        }}
      >
        <div style={{ minWidth: '880px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          
          {/* BARRA DE ENCABEZADOS DE COLUMNA (COMPACTA, 1 SOLA LÍNEA SIN CORTE) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: gridTemplate,
            gap: '8px',
            padding: '4px 10px',
            fontSize: '0.62rem',
            fontWeight: 800,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'var(--text-secondary)',
            backgroundColor: 'var(--bg-canvas-subtle)',
            borderRadius: '6px',
            border: '1px solid var(--border-acrylic)',
            alignItems: 'center',
            whiteSpace: 'nowrap',
            lineHeight: 1.2
          }}>
            <div>EQUIPO / MODELO / S/N</div>
            <div>ESPECIFICACIONES / CPU</div>
            <div>MEMORIA RAM</div>
            <div>ALMACENAMIENTO</div>
            <div>SISTEMA & RED</div>
            <div>UBICACIÓN & USUARIO</div>
            <div style={{ textAlign: 'right' }}>ACCIONES</div>
          </div>

          {/* FILAS DE EQUIPOS EN COLUMNAS ALINEADAS */}
          {filteredList.length === 0 ? (
            <div className="acrylic-card" style={{ padding: '28px 16px', textAlign: 'center', borderRadius: '8px' }}>
              <Monitor size={30} color="var(--text-muted)" style={{ margin: '0 auto 8px auto', opacity: 0.5 }} />
              <h3 style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                No se encontraron equipos en inventario
              </h3>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                Intenta cambiar los términos de búsqueda o filtros seleccionados
              </p>
            </div>
          ) : (
            paginatedList.map((device) => {
              const isExpanded = expandedIds.has(device.id);
              const { icon: CatIcon, color: catColor } = getCategoryIcon(device.deviceType);
              const sb = getDeviceStatusBadge(device.status);

              return (
                <div
                  key={device.id}
                  id={`inventory-card-${device.id}`}
                  data-category={device.deviceType}
                  className="inventory-card"
                  style={{
                    borderRadius: '6px',
                    border: isExpanded ? '1px solid var(--accent-primary)' : '1px solid var(--border-acrylic)',
                    borderLeft: `5px solid ${catColor || 'var(--border-acrylic)'}`,
                    background: isExpanded ? 'var(--bg-canvas-subtle)' : 'var(--bg-acrylic-card)',
                    boxShadow: isExpanded 
                      ? '0 3px 10px -2px rgba(15, 23, 42, 0.16), 0 0 0 1px var(--accent-primary)' 
                      : '0 1px 3px rgba(15, 23, 42, 0.04)',
                    transition: 'all 0.15s ease',
                    marginBottom: 0
                  }}
                >
                  {/* FILA PRINCIPAL: DISTRIBUCIÓN ESTRICTA EN COLUMNAS */}
                  <div
                    onClick={() => toggleExpand(device.id)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: gridTemplate,
                      gap: '8px',
                      alignItems: 'center',
                      padding: '4px 10px',
                      cursor: 'pointer',
                      userSelect: 'none',
                      minHeight: '38px'
                    }}
                  >
                    {/* COLUMNA 1: EQUIPO / MODELO / S/N */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                      <div style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '6px',
                        backgroundColor: catColor ? `${catColor}18` : 'rgba(148, 163, 184, 0.15)',
                        border: `1px solid ${catColor ? `${catColor}40` : 'var(--border-acrylic)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: catColor || 'var(--accent-primary)',
                        flexShrink: 0
                      }}>
                        <CatIcon size={13} />
                      </div>

                      <div style={{ minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '1px' }}>
                        {/* 1. Hostname & Punto de Estado */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span style={{
                            fontSize: '0.78rem',
                            fontWeight: 800,
                            fontFamily: 'JetBrains Mono, monospace',
                            color: 'var(--text-primary)',
                            letterSpacing: '-0.01em',
                            textOverflow: 'ellipsis',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                            lineHeight: 1.2
                          }}>
                            {device.hostname}
                          </span>
                          <span
                            title={`Estado: ${sb.label}`}
                            style={{
                              display: 'inline-block',
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              backgroundColor: sb.dotColor,
                              boxShadow: `0 0 5px ${sb.dotColor}`,
                              flexShrink: 0
                            }}
                          />
                        </div>

                        {/* 2. Marca y Modelo */}
                        <div style={{ fontSize: '0.67rem', color: 'var(--text-primary)', fontWeight: 600, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', lineHeight: 1.2 }}>
                          {device.brand || 'Equipo'} {device.model || ''}
                        </div>

                        {/* 3. Número de Serie / Código Patrimonial */}
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '3px', 
                          fontSize: '0.60rem', 
                          color: 'var(--text-secondary)',
                          fontFamily: 'JetBrains Mono, monospace',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                          lineHeight: 1.2
                        }}>
                          <Barcode size={9} style={{ opacity: 0.7, flexShrink: 0 }} />
                          <span>S/N: <strong style={{ color: 'var(--accent-primary)' }}>{device.serialNumber || device.barcode || 'S/N No reg.'}</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* COLUMNA 2: ESPECIFICACIONES / CPU (Adaptativo Inteligente) */}
                    <div style={{ minWidth: 0, overflow: 'hidden' }}>
                      {isComputerType(device.deviceType) ? (
                        <>
                          <div
                            style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.70rem', fontWeight: 700, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', lineHeight: 1.2 }}
                            title={device.cpu || 'No detectado'}
                          >
                            <Cpu size={11} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
                            <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              {formatCpuName(device.cpu)}
                            </span>
                          </div>
                          <div
                            style={{ fontSize: '0.62rem', color: 'var(--accent-cyan)', fontWeight: 600, marginTop: '1px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', lineHeight: 1.2 }}
                            title={device.motherboard || 'Placa Base Estándar'}
                          >
                            Placa: {device.motherboard || 'Estándar'}
                          </div>
                        </>
                      ) : isSpeakerType(device.deviceType) ? (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.70rem', fontWeight: 700, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', lineHeight: 1.2 }} title={device.specs || 'Parlantes de Audio'}>
                            <Volume2 size={11} color="#f97316" style={{ flexShrink: 0 }} />
                            <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              {device.specs || 'Parlantes Estéreo'}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.62rem', color: '#f97316', fontWeight: 600, marginTop: '1px' }}>Audio / Parlantes</div>
                        </>
                      ) : isMonitorType(device.deviceType) ? (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.70rem', fontWeight: 700, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', lineHeight: 1.2 }} title={device.specs || 'Monitor Display'}>
                            <Tv size={11} color="#06b6d4" style={{ flexShrink: 0 }} />
                            <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              {device.specs || 'Monitor / Pantalla'}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.62rem', color: '#06b6d4', fontWeight: 600, marginTop: '1px' }}>Monitor / Display</div>
                        </>
                      ) : isEcranType(device.deviceType) ? (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.70rem', fontWeight: 700, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', lineHeight: 1.2 }} title={device.specs || 'Pantalla de Proyección'}>
                            <Projector size={11} color="#a855f7" style={{ flexShrink: 0 }} />
                            <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              {device.specs || 'Pantalla Retráctil'}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.62rem', color: '#a855f7', fontWeight: 600, marginTop: '1px' }}>Ecran / Proyección</div>
                        </>
                      ) : isPrinterType(device.deviceType) ? (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.70rem', fontWeight: 700, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', lineHeight: 1.2 }} title={device.supplies || 'Tinta / Tóner'}>
                            <Droplet size={11} color="var(--accent-secondary)" style={{ flexShrink: 0 }} />
                            <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              {device.supplies || 'Suministro Oficial'}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.62rem', color: 'var(--accent-secondary)', fontWeight: 600, marginTop: '1px' }}>Impresora & Tintas</div>
                        </>
                      ) : isNetworkType(device.deviceType) ? (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.70rem', fontWeight: 700, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', lineHeight: 1.2 }}>
                            <Network size={11} color="var(--accent-rose)" style={{ flexShrink: 0 }} />
                            <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              {device.specs || device.model || 'Equipo de Red'}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.62rem', color: 'var(--accent-rose)', fontWeight: 600, marginTop: '1px' }}>Switch / Router</div>
                        </>
                      ) : (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.70rem', fontWeight: 700, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', lineHeight: 1.2 }}>
                            <HardDrive size={11} color="#f59e0b" style={{ flexShrink: 0 }} />
                            <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              {device.specs || device.model || 'Hardware'}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.62rem', color: '#f59e0b', fontWeight: 600, marginTop: '1px' }}>{device.os || 'Componente'}</div>
                        </>
                      )}
                    </div>

                    {/* COLUMNA 3: MEMORIA RAM (Solo para cómputo) */}
                    <div>
                      {supportsComputeSpecs(device.deviceType) ? (
                        <span style={{
                          fontSize: '0.67rem',
                          fontWeight: 800,
                          padding: '1px 6px',
                          borderRadius: '5px',
                          backgroundColor: 'var(--bg-canvas-subtle)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border-acrylic)',
                          display: 'inline-block',
                          lineHeight: 1.3
                        }}>
                          {device.ram || '8 GB'}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 600, opacity: 0.5 }}>—</span>
                      )}
                    </div>

                    {/* COLUMNA 4: ALMACENAMIENTO (DISCO) (Solo para cómputo) */}
                    <div style={{ minWidth: 0, overflow: 'hidden' }}>
                      {supportsComputeSpecs(device.deviceType) ? (
                        <div
                          style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 600, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', lineHeight: 1.2 }}
                          title={device.storage || 'Disco estándar'}
                        >
                          <HardDrive size={11} color="var(--accent-amber)" style={{ flexShrink: 0 }} />
                          <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {formatDiskString(device.storage)}
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 600, opacity: 0.5 }}>—</span>
                      )}
                    </div>

                    {/* COLUMNA 5: SISTEMA & RED (Diferenciado por categoría) */}
                    <div style={{ minWidth: 0, overflow: 'hidden' }}>
                      {isComputerType(device.deviceType) ? (
                        <>
                          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', lineHeight: 1.2 }}>
                            {device.os?.replace('Microsoft ', '') || 'Windows'}
                          </div>
                          <div
                            onClick={(e) => handleCopy(device.ipAddress, `ip-${device.id}`, e)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              fontFamily: 'monospace',
                              fontSize: '0.64rem',
                              fontWeight: 700,
                              color: 'var(--accent-cyan)',
                              marginTop: '1px',
                              cursor: 'pointer',
                              lineHeight: 1.2
                            }}
                            title="Dirección IP - Clic para copiar"
                          >
                            <Wifi size={9} color="var(--accent-cyan)" />
                            <span>{device.ipAddress || '127.0.0.1'}</span>
                            {copiedId === `ip-${device.id}` && <Check size={9} color="var(--accent-emerald)" />}
                          </div>
                        </>
                      ) : isNetworkType(device.deviceType) ? (
                        <>
                          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--accent-rose)', lineHeight: 1.2 }}>
                            Red Ethernet
                          </div>
                          <div
                            onClick={(e) => isValidIpAddress(device.ipAddress) && handleCopy(device.ipAddress, `ip-${device.id}`, e)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              fontFamily: 'monospace',
                              fontSize: '0.64rem',
                              fontWeight: 700,
                              color: 'var(--accent-cyan)',
                              marginTop: '1px',
                              cursor: isValidIpAddress(device.ipAddress) ? 'pointer' : 'default',
                              lineHeight: 1.2
                            }}
                          >
                            <Network size={9} color="var(--accent-cyan)" />
                            <span>{isValidIpAddress(device.ipAddress) ? device.ipAddress : 'LAN'}</span>
                          </div>
                        </>
                      ) : isPrinterType(device.deviceType) ? (
                        <>
                          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--accent-secondary)', lineHeight: 1.2 }}>
                            Impresora
                          </div>
                          {isValidIpAddress(device.ipAddress) ? (
                            <div
                              onClick={(e) => handleCopy(device.ipAddress, `ip-${device.id}`, e)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontFamily: 'monospace', fontSize: '0.64rem', fontWeight: 700, color: 'var(--accent-cyan)', cursor: 'pointer', lineHeight: 1.2 }}
                            >
                              <Wifi size={9} color="var(--accent-cyan)" />
                              <span>{device.ipAddress}</span>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>Conexión USB</span>
                          )}
                        </>
                      ) : isSpeakerType(device.deviceType) ? (
                        <>
                          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#f97316', lineHeight: 1.2 }}>
                            Audio Analógico / BT
                          </div>
                          <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>Periférico Pasivo</span>
                        </>
                      ) : isMonitorType(device.deviceType) ? (
                        <>
                          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#06b6d4', lineHeight: 1.2 }}>
                            Video HDMI / DP
                          </div>
                          <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>Pantalla Display</span>
                        </>
                      ) : isEcranType(device.deviceType) ? (
                        <>
                          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#a855f7', lineHeight: 1.2 }}>
                            Pantalla Proyección
                          </div>
                          <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>Accesorio Pasivo</span>
                        </>
                      ) : (
                        <>
                          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#f59e0b', lineHeight: 1.2 }}>
                            Hardware / Stock
                          </div>
                          <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>Custodia TI</span>
                        </>
                      )}
                    </div>

                    {/* COLUMNA 6: UBICACIÓN & USUARIO */}
                    <div style={{ minWidth: 0, overflow: 'hidden' }}>
                      <div 
                        style={{ fontSize: '0.69rem', fontWeight: 700, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', lineHeight: 1.2 }} 
                        title={device.assignedUser || 'Sin Asignar'}
                      >
                        <User size={10} color="var(--accent-primary)" style={{ display: 'inline', marginRight: '3px' }} />
                        {device.assignedUser || 'Estación Común'}
                      </div>
                      <div 
                        style={{ fontSize: '0.63rem', color: '#10b981', fontWeight: 600, marginTop: '1px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', lineHeight: 1.2 }} 
                        title={`${device.location || 'Sede Central'} • ${device.department || 'General'}`}
                      >
                        <MapPin size={9} style={{ display: 'inline', marginRight: '2px' }} />
                        {device.location || 'Sede Central'}
                      </div>
                    </div>

                    {/* COLUMNA 7: ACCIONES */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                      {/* Botón Ver Ficha Técnica del Equipo */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectDevice(device);
                        }}
                        className="btn-flat"
                        style={{
                          width: '24px',
                          height: '24px',
                          padding: 0,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '5px',
                          border: '1px solid var(--border-acrylic)',
                          backgroundColor: 'var(--bg-canvas-subtle)',
                          color: 'var(--text-primary)'
                        }}
                        title="Ver ficha técnica y código QR"
                      >
                        <Monitor size={11} />
                      </button>

                      {/* Botón Detalles / Desplegar Drawer */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpand(device.id);
                        }}
                        className="btn-flat"
                        style={{
                          padding: '2px 6px',
                          borderRadius: '5px',
                          fontSize: '0.64rem',
                          fontWeight: 700,
                          color: isExpanded ? 'var(--accent-primary)' : 'var(--text-secondary)',
                          backgroundColor: isExpanded ? 'rgba(148, 163, 184, 0.18)' : 'var(--bg-canvas-subtle)',
                          border: isExpanded ? '1px solid var(--accent-primary)' : '1px solid var(--border-acrylic)',
                          gap: '3px'
                        }}
                      >
                        <span>{isExpanded ? 'Ocultar' : 'Detalles'}</span>
                        <ChevronDown
                          size={10}
                          style={{
                            transform: isExpanded ? 'rotate(180deg)' : 'none',
                            transition: 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
                          }}
                        />
                      </button>
                    </div>
                  </div>

                  {/* DESPLIEGUE DETALLADO (DRAWER DE ESPECIFICACIONES CON TRANSICIÓN FLUIDA) */}
                  <div className={`card-drawer-accordion ${isExpanded ? 'is-expanded' : ''}`}>
                    <div className="card-drawer-inner">
                      {renderDetailDrawer(device)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 3. VISTA MÓVIL Y TABLET RESPONSIVA (100% FLUIDA, SIN CORTES LATERALES) */}
      <div 
        className={`mobile-inventory-cards ${viewMode === 'table' ? 'force-hidden' : ''} ${viewMode === 'cards' ? 'force-visible' : ''}`}
        style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}
      >
        {filteredList.length === 0 ? (
          <div className="acrylic-card" style={{ padding: '24px 16px', textAlign: 'center', borderRadius: '8px' }}>
            <Monitor size={28} color="var(--text-muted)" style={{ margin: '0 auto 6px auto', opacity: 0.5 }} />
            <h3 style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              No se encontraron equipos
            </h3>
          </div>
        ) : (
          paginatedList.map((device) => {
            const isExpanded = expandedIds.has(device.id);
            const { icon: CatIcon, color: catColor } = getCategoryIcon(device.deviceType);
            const sb = getDeviceStatusBadge(device.status);

            return (
              <div
                key={`mob-${device.id}`}
                id={`inventory-card-mob-${device.id}`}
                data-category={device.deviceType}
                className="inventory-card"
                style={{
                  borderRadius: '8px',
                  border: isExpanded ? '1px solid var(--accent-primary)' : '1px solid var(--border-acrylic)',
                  borderLeft: `5px solid ${catColor || 'var(--border-acrylic)'}`,
                  background: isExpanded ? 'var(--bg-canvas-subtle)' : 'var(--bg-acrylic-card)',
                  padding: '8px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}
              >
                {/* Cabecera Móvil: Icono, Hostname, Estado y Botones */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                    <div style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '6px',
                      backgroundColor: catColor ? `${catColor}18` : 'rgba(148, 163, 184, 0.15)',
                      border: `1px solid ${catColor ? `${catColor}40` : 'var(--border-acrylic)'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: catColor || 'var(--accent-primary)',
                      flexShrink: 0
                    }}>
                      <CatIcon size={13} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ fontSize: '0.80rem', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-primary)' }}>
                          {device.hostname}
                        </span>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: sb.dotColor }} />
                      </div>
                      <div style={{ fontSize: '0.66rem', color: 'var(--text-secondary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {device.brand || 'Equipo'} {device.model || ''}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectDevice(device);
                      }}
                      className="btn-flat"
                      style={{ width: '26px', height: '26px', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '5px' }}
                      title="Ver Ficha Técnica"
                    >
                      <Monitor size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleExpand(device.id)}
                      className="btn-flat"
                      style={{ padding: '3px 6px', borderRadius: '5px', fontSize: '0.64rem', fontWeight: 700 }}
                    >
                      <ChevronDown size={11} style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)' }} />
                    </button>
                  </div>
                </div>

                {/* Grid de Datos 2x2 Inteligente para Móvil (adaptado según categoría del bien) */}
                {(() => {
                  const smart = getAssetSmartFields(device);
                  const isComp = supportsComputeSpecs(device.deviceType);
                  const hasRealNet = supportsNetworkAddress(device.deviceType) && isValidIpAddress(device.ipAddress);
                  const hasRealMac = supportsNetworkAddress(device.deviceType) && isValidMacAddress(device.macAddress);

                  return (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: '4px 8px',
                      fontSize: '0.68rem',
                      backgroundColor: 'var(--bg-canvas-subtle)',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-acrylic)'
                    }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.58rem', display: 'block' }}>{smart.box1Label}</span>
                        <span style={{ fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-primary)', fontSize: '0.64rem' }}>
                          {smart.box1Value}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.58rem', display: 'block' }}>{smart.box2Label}</span>
                        <span style={{ fontWeight: 700, fontSize: '0.64rem', color: isComp ? 'var(--text-primary)' : 'var(--accent-secondary)' }} title={smart.box2Value}>
                          {isComp ? `${device.ram || '8 GB'} • ${formatDiskString(device.storage)}` : smart.box2Value}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.58rem', display: 'block' }}>{smart.box3Label}</span>
                        {isComp ? (
                          <>
                            <span style={{ fontWeight: 700, fontFamily: 'monospace', color: 'var(--accent-cyan)', fontSize: '0.64rem', display: 'block' }}>
                              {device.ipAddress || '127.0.0.1'}
                            </span>
                            {hasRealMac && (
                              <span style={{ fontWeight: 700, fontFamily: 'monospace', color: 'var(--accent-primary)', fontSize: '0.58rem', display: 'block' }}>
                                {device.macAddress}
                              </span>
                            )}
                          </>
                        ) : hasRealNet ? (
                          <>
                            <span style={{ fontWeight: 700, fontFamily: 'monospace', color: 'var(--accent-cyan)', fontSize: '0.64rem', display: 'block' }}>
                              {device.ipAddress}
                            </span>
                            {hasRealMac && (
                              <span style={{ fontWeight: 700, fontFamily: 'monospace', color: 'var(--accent-primary)', fontSize: '0.58rem', display: 'block' }}>
                                {device.macAddress}
                              </span>
                            )}
                          </>
                        ) : (
                          <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.64rem', display: 'block' }}>
                            {smart.box3Value}
                          </span>
                        )}
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.58rem', display: 'block' }}>{smart.box4Label}</span>
                        <span style={{ fontWeight: 700, color: '#10b981', fontSize: '0.64rem' }}>
                          {smart.box4Value}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* Despliegue Ficha Técnica en Móvil con Transición Fluida */}
                <div className={`card-drawer-accordion ${isExpanded ? 'is-expanded' : ''}`}>
                  <div className="card-drawer-inner">
                    {renderDetailDrawer(device)}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Controles de Navegación Multipágina Numerada */}
      <Pagination
        currentPage={currentPage}
        totalItems={filteredList.length}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        itemName="equipos"
        pageSizeOptions={[8, 12, 24, 48]}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize);
          setCurrentPage(1);
        }}
      />
    </div>
  );
};

export default AuditListView;
