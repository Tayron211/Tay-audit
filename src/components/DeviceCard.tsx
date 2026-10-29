import React, { useState } from 'react';
import { 
  Monitor, 
  Laptop, 
  Server, 
  Printer, 
  Network, 
  HardDrive, 
  Cpu, 
  Wifi, 
  Copy,
  Check,
  Volume2,
  Tv,
  Projector
} from 'lucide-react';
import type { Device, DeviceType } from '../types';

interface DeviceCardProps {
  device: Device;
  onSelect: (device: Device) => void;
}

export const getCategoryIcon = (type: DeviceType) => {
  switch (type) {
    case 'pc': return { icon: Monitor, color: 'var(--accent-primary)', label: 'PC' };
    case 'laptop': return { icon: Laptop, color: 'var(--accent-cyan)', label: 'Laptop' };
    case 'server': return { icon: Server, color: 'var(--accent-amber)', label: 'Servidor' };
    case 'printer': return { icon: Printer, color: 'var(--accent-secondary)', label: 'Impresora' };
    case 'network': return { icon: Network, color: 'var(--accent-rose)', label: 'Red' };
    case 'speaker': return { icon: Volume2, color: '#f97316', label: 'Parlante' };
    case 'ecran': return { icon: Projector, color: '#a855f7', label: 'Ecran' };
    case 'monitor': return { icon: Tv, color: '#06b6d4', label: 'Monitor' };
    case 'component': return { icon: HardDrive, color: '#f59e0b', label: 'Hardware' };
    default: return { icon: Monitor, color: '#94a3b8', label: 'Equipo' };
  }
};

export const DeviceCard: React.FC<DeviceCardProps> = ({ device, onSelect }) => {
  const { icon: CategoryIcon, color: categoryColor } = getCategoryIcon(device.deviceType);
  const [copiedHost, setCopiedHost] = useState(false);

  const getStatusInfo = () => {
    switch (device.status) {
      case 'baja':
        return { className: 'status-baja', label: 'BAJA' };
      case 'custodia':
        return { className: 'status-custodia', label: 'EN CUSTODIA' };
      case 'maintenance':
      case 'mantenimiento':
        return { className: 'status-maintenance', label: 'EN MANTENIMIENTO' };
      case 'instalado':
      case 'online':
      case 'audited':
      default:
        return { className: 'status-instalado', label: 'INSTALADO' };
    }
  };

  const handleCopyHost = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(device.hostname);
    setCopiedHost(true);
    setTimeout(() => setCopiedHost(false), 1800);
  };

  return (
    <div
      onClick={() => onSelect(device)}
      className="acrylic-card"
      style={{
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        cursor: 'pointer',
        position: 'relative',
        borderLeft: `3px solid ${categoryColor}`,
        minHeight: '225px'
      }}
    >
      {/* Top Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
            {/* Category Icon Badge */}
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              border: `1px solid rgba(255, 255, 255, 0.1)`,
              boxShadow: `0 4px 16px var(--accent-glow)`
            }}>
              <CategoryIcon size={20} color={categoryColor} />
            </div>

            <div style={{ minWidth: 0, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{
                  fontSize: '1.05rem',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  fontFamily: 'JetBrains Mono, monospace',
                  letterSpacing: '-0.02em'
                }}>
                  {device.hostname}
                </span>

                <button
                  type="button"
                  onClick={handleCopyHost}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: '2px',
                    cursor: 'pointer',
                    color: copiedHost ? '#10b981' : 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title="Copiar Hostname"
                >
                  {copiedHost ? <Check size={13} /> : <Copy size={13} />}
                </button>
              </div>

              <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {device.brand || 'Equipo'} {device.model || ''}
              </div>
            </div>
          </div>

          <span className={`status-pill ${getStatusInfo().className}`}>
            {getStatusInfo().label}
          </span>
        </div>

        {/* Identificadores Críticos: Serial, Placa Madre y Compatibilidad (LO PRIMERO) */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '5px',
          padding: '8px 10px',
          borderRadius: '9px',
          backgroundColor: 'rgba(139, 92, 246, 0.08)',
          border: '1px solid rgba(139, 92, 246, 0.25)',
          marginBottom: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.73rem', fontFamily: 'monospace', fontWeight: 800, color: 'var(--accent-secondary)' }}>
              S/N: {device.serialNumber || 'Sin S/N'}
            </span>
            {(() => {
              const isComp = (device.compatibility || 'Compatible').toLowerCase().includes('compatible') && !(device.compatibility || '').toLowerCase().includes('no');
              return (
                <span style={{
                  fontSize: '0.66rem',
                  fontWeight: 800,
                  padding: '2px 7px',
                  borderRadius: '9999px',
                  backgroundColor: isComp ? 'rgba(16, 185, 129, 0.18)' : 'rgba(244, 63, 94, 0.18)',
                  color: isComp ? '#10b981' : '#f43f5e',
                  border: `1px solid ${isComp ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)'}`
                }}>
                  {isComp ? 'Compatible' : 'No Comp.'}
                </span>
              );
            })()}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Placa: {device.motherboard || 'Placa Base Estándar'}
          </div>
        </div>

        {/* Hardware Spec Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '8px',
          padding: '10px 12px',
          borderRadius: '10px',
          backgroundColor: 'rgba(148, 163, 184, 0.08)',
          border: '1px solid var(--border-acrylic)',
          marginBottom: '14px'
        }}>
          {/* RAM */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Cpu size={13} color="var(--accent-primary)" />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>RAM:</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>
              {device.ram || 'N/A'}
            </span>
          </div>

          {/* IP Address */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Wifi size={13} color="var(--accent-cyan)" />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>IP:</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>
              {device.ipAddress || 'LAN'}
            </span>
          </div>

          {/* Disco / Almacenamiento */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <HardDrive size={13} color="var(--accent-amber)" />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Disco:</span>
            <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {device.storage || 'Estándar'}
            </span>
          </div>

          {/* MAC Address */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Network size={13} color="var(--accent-primary)" />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>MAC:</span>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={device.macAddress || 'No detectada'}>
              {device.macAddress || 'N/A'}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Inventory Audit Action Strip */}
      <div style={{
        paddingTop: '10px',
        borderTop: '1px solid var(--border-acrylic)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px'
      }}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(device);
          }}
          className="btn-flat"
          style={{ padding: '6px 12px', fontSize: '0.73rem', fontWeight: 700, width: '100%', justifyContent: 'center' }}
        >
          <span>Ver Ficha Técnica</span>
        </button>
      </div>
    </div>
  );
};
