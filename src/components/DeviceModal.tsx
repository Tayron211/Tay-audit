import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Printer, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle, 
  Cpu, 
  Wifi, 
  User, 
  Edit3,
  Save,
  MapPin,
  Building2,
  Layers,
  FileText,
  ChevronDown,
  Check,
  Lock
} from 'lucide-react';
import QRCode from 'qrcode';
import type { Device, DeviceStatus, DeviceType, UserRole } from '../types';
import { api } from '../services/api';
import { getCategoryIcon } from './DeviceCard';
import { CustomSelect, type SelectOption } from './CustomSelect';

const DEVICE_TYPE_OPTIONS: SelectOption<DeviceType>[] = [
  { value: 'pc', label: 'Computadora Ensamblada / Escritorio' },
  { value: 'laptop', label: 'Laptop / Portátil' },
  { value: 'server', label: 'Servidor de Producción' },
  { value: 'printer', label: 'Impresora / Multifuncional' },
  { value: 'speaker', label: 'Parlantes / Sistema de Audio' },
  { value: 'ecran', label: 'Ecran / Pantalla de Proyección' },
  { value: 'monitor', label: 'Monitor / Pantalla' },
  { value: 'network', label: 'Equipo de Red (Switch / Router)' },
  { value: 'component', label: 'Componente de Cómputo / Hardware' },
  { value: 'other', label: 'Otro Periférico' }
];

const DEVICE_STATUS_OPTIONS: SelectOption<DeviceStatus>[] = [
  { value: 'instalado', label: 'Instalado / Operativo', dotColor: 'var(--accent-emerald)' },
  { value: 'custodia', label: 'En Custodia / Almacén', dotColor: 'var(--accent-amber)' },
  { value: 'maintenance', label: 'En Mantenimiento Técnico', dotColor: 'var(--accent-cyan)' },
  { value: 'baja', label: 'Dado de Baja / Obsoleto', dotColor: 'var(--accent-rose)' }
];

interface DeviceModalProps {
  device: Device | null;
  initialEditMode?: boolean;
  onClose: () => void;
  onDeviceUpdated: (updated?: Device) => void;
  onDeviceDeleted?: (deletedDeviceId: string) => void;
  onOpenSupportForDevice?: (device: Device) => void;
  currentUserRole?: UserRole;
}

export const DeviceModal: React.FC<DeviceModalProps> = ({
  device: initialDevice,
  initialEditMode = false,
  onClose,
  onDeviceUpdated,
  onDeviceDeleted,
  currentUserRole = 'admin'
}) => {
  const [device, setDevice] = useState<Device | null>(initialDevice);
  const prevDeviceIdRef = useRef<string | null>(null);

  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string; details?: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [isStatusDropdownClosing, setIsStatusDropdownClosing] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const [isClosing, setIsClosing] = useState(false);

  const requestClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 200);
  };

  const closeStatusDropdown = () => {
    if (isStatusDropdownClosing || !isStatusDropdownOpen) return;
    setIsStatusDropdownClosing(true);
    setTimeout(() => {
      setIsStatusDropdownClosing(false);
      setIsStatusDropdownOpen(false);
    }, 160);
  };

  const toggleStatusDropdown = () => {
    if (isStatusDropdownOpen) {
      closeStatusDropdown();
    } else {
      setIsStatusDropdownOpen(true);
    }
  };

  // Edit form state
  const [editForm, setEditForm] = useState<{
    hostname: string;
    deviceType: DeviceType;
    status: DeviceStatus;
    brand: string;
    model: string;
    serialNumber: string;
    motherboard: string;
    cpu: string;
    ram: string;
    storage: string;
    os: string;
    ipAddress: string;
    macAddress: string;
    assignedUser: string;
    department: string;
    location: string;
    supplies?: string;
    specs?: string;
    notes: string;
  }>({
    hostname: '',
    deviceType: 'pc',
    status: 'instalado',
    brand: '',
    model: '',
    serialNumber: '',
    motherboard: '',
    cpu: '',
    ram: '',
    storage: '',
    os: '',
    ipAddress: '',
    macAddress: '',
    assignedUser: '',
    department: '',
    location: '',
    supplies: '',
    specs: '',
    notes: ''
  });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
        closeStatusDropdown();
      }
    };
    if (isStatusDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isStatusDropdownOpen, isStatusDropdownClosing]);

  useEffect(() => {
    if (!initialDevice) {
      prevDeviceIdRef.current = null;
      setDevice(null);
      setIsEditing(false);
      setIsClosing(false);
      return;
    }

    const isNewDevice = initialDevice.id !== prevDeviceIdRef.current;
    prevDeviceIdRef.current = initialDevice.id;
    setDevice(initialDevice);
    setIsClosing(false);

    if (isNewDevice) {
      setActionMessage(null);
      setConfirmDelete(false);
      setIsStatusDropdownOpen(false);
      setIsEditing(false);

      setEditForm({
        hostname: initialDevice.hostname || '',
        deviceType: initialDevice.deviceType || 'pc',
        status: initialDevice.status || 'instalado',
        brand: initialDevice.brand || '',
        model: initialDevice.model || '',
        serialNumber: initialDevice.serialNumber || '',
        motherboard: initialDevice.motherboard || '',
        cpu: initialDevice.cpu || '',
        ram: initialDevice.ram || '',
        storage: initialDevice.storage || '',
        os: initialDevice.os || '',
        ipAddress: initialDevice.ipAddress || '',
        macAddress: initialDevice.macAddress || '',
        assignedUser: initialDevice.assignedUser || '',
        department: initialDevice.department || '',
        location: initialDevice.location || '',
        supplies: initialDevice.supplies || '',
        specs: initialDevice.specs || '',
        notes: initialDevice.notes || ''
      });
    }

    const uniqueAssetTag = initialDevice.qrCodeData || `TAY-${(initialDevice.hostname || 'ACT').toUpperCase()}-${initialDevice.id.replace('dev-', '').toUpperCase()}`;
    const qrPayload = JSON.stringify({
      id: initialDevice.id,
      tag: uniqueAssetTag,
      hostname: initialDevice.hostname,
      serial: initialDevice.serialNumber || 'N/A'
    });
    QRCode.toDataURL(qrPayload, {
      width: 400,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#0a0f1d', light: '#ffffff' }
    })
      .then(setQrDataUrl)
      .catch(console.error);
  }, [initialDevice, initialEditMode]);

  // Cerrar ventana con tecla Escape
  useEffect(() => {
    if (!device) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        requestClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [device, isClosing]);

  if (!device) return null;

  const { icon: CategoryIcon, color: categoryColor } = getCategoryIcon(isEditing ? editForm.deviceType : device.deviceType);

  const getStatusBadge = (s: string) => {
    switch (s) {
      case 'baja': return { className: 'status-baja', label: 'DADO DE BAJA' };
      case 'custodia': return { className: 'status-custodia', label: 'EN CUSTODIA' };
      case 'maintenance':
      case 'mantenimiento': return { className: 'status-maintenance', label: 'EN MANTENIMIENTO' };
      case 'instalado':
      case 'online':
      case 'audited':
      default: return { className: 'status-instalado', label: 'INSTALADO' };
    }
  };

  const handleStatusChange = async (newStatus: DeviceStatus) => {
    if (!device) return;
    try {
      const updated = await api.updateDevice(device.id, { ...device, status: newStatus });
      setDevice(updated);
      setEditForm((prev: any) => ({ ...prev, status: newStatus }));
      setActionMessage({ type: 'success', text: `Estado del equipo actualizado a "${newStatus.toUpperCase()}"` });
      onDeviceUpdated(updated);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: 'Error al cambiar estado: ' + err.message });
    }
  };

  const handleSaveForm = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!device) return;
    if (!editForm.hostname.trim()) {
      setActionMessage({ type: 'error', text: 'El Hostname del equipo no puede estar vacío.' });
      return;
    }

    setIsSaving(true);
    setActionMessage(null);

    try {
      const updated = await api.updateDevice(device.id, {
        ...editForm,
        hostname: editForm.hostname.toUpperCase().trim()
      });
      setDevice(updated);
      setActionMessage({ type: 'success', text: '¡Datos del equipo y ubicación actualizados exitosamente en inventario!' });
      setIsEditing(false);
      onDeviceUpdated(updated);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: 'Error al guardar cambios: ' + err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setIsSaving(true);
      await api.deleteDevice(device.id);
      if (onDeviceDeleted) {
        onDeviceDeleted(device.id);
      } else {
        onDeviceUpdated();
      }
      onClose();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrintLabel = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const uniqueAssetTag = device.qrCodeData || `TAY-${(device.hostname || 'ACT').toUpperCase()}-${device.id.replace('dev-', '').toUpperCase()}`;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Etiqueta de Activo - ${device.hostname}</title>
          <style>
            @page {
              size: auto;
              margin: 0;
            }
            * {
              box-sizing: border-box;
            }
            html, body {
              margin: 0;
              padding: 0;
              width: 100%;
              height: 100%;
              min-height: 100vh;
              background: #ffffff;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .print-sheet {
              width: 100%;
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 24px;
            }
            .label-card {
              width: 460px;
              max-width: 95vw;
              border: 3.5px solid #0f172a;
              border-radius: 18px;
              padding: 28px 30px 26px;
              text-align: center;
              background: #ffffff;
              box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
              page-break-inside: avoid;
            }
            @media print {
              body {
                min-height: 100vh;
              }
              .label-card {
                box-shadow: none !important;
                border: 3.5px solid #000000 !important;
              }
            }
            .header-badge {
              display: inline-block;
              background: #0f172a;
              color: #ffffff;
              padding: 6px 16px;
              border-radius: 6px;
              font-size: 11px;
              font-weight: 800;
              letter-spacing: 0.1em;
              text-transform: uppercase;
              margin-bottom: 12px;
            }
            .hostname-title {
              font-size: 26px;
              font-weight: 900;
              color: #0f172a;
              margin: 0 0 12px 0;
              letter-spacing: -0.02em;
              word-break: break-all;
            }
            .qr-container {
              display: flex;
              justify-content: center;
              align-items: center;
              margin: 10px 0 14px;
            }
            .qr-img {
              width: 250px;
              height: 250px;
              display: block;
              image-rendering: pixelated;
            }
            .asset-code-badge {
              display: inline-block;
              background: #f1f5f9;
              border: 1.5px dashed #64748b;
              color: #0f172a;
              font-family: 'Consolas', 'Courier New', monospace;
              font-size: 13px;
              font-weight: 800;
              padding: 5px 14px;
              border-radius: 6px;
              letter-spacing: 0.06em;
              margin-bottom: 14px;
            }
            .info-table {
              width: 100%;
              border-top: 1.5px solid #e2e8f0;
              padding-top: 12px;
              margin-top: 4px;
              font-size: 13.5px;
              line-height: 1.6;
              color: #1e293b;
              text-align: left;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 4px;
            }
            .info-label {
              font-weight: 700;
              color: #475569;
            }
            .info-val {
              font-weight: 600;
              color: #0f172a;
              text-align: right;
              max-width: 65%;
              word-break: break-word;
            }
          </style>
        </head>
        <body>
          <div class="print-sheet">
            <div class="label-card">
              <div class="header-badge">TAY-AUDIT • CONTROL CORPORATIVO</div>
              <div class="hostname-title">${device.hostname}</div>
              <div class="qr-container">
                <img class="qr-img" src="${qrDataUrl}" alt="QR Activo ${device.hostname}" />
              </div>
              <div class="asset-code-badge">ID ÚNICO: ${uniqueAssetTag}</div>
              <div class="info-table">
                <div class="info-row"><span class="info-label">S/N:</span><span class="info-val">${device.serialNumber || 'N/A'}</span></div>
                <div class="info-row"><span class="info-label">Tipo:</span><span class="info-val">${(device.deviceType || 'pc').toUpperCase()}</span></div>
                <div class="info-row"><span class="info-label">Ubicación:</span><span class="info-val">${device.location || 'Sede Central'}</span></div>
                <div class="info-row"><span class="info-label">IP:</span><span class="info-val">${device.ipAddress || 'N/A'}</span></div>
                <div class="info-row"><span class="info-label">Usuario:</span><span class="info-val">${device.assignedUser || 'General'}</span></div>
              </div>
            </div>
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.close();
              }, 250);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div 
      className={`modal-backdrop-acrylic ${isClosing ? 'closing' : ''}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          requestClose();
        }
      }}
    >
      <div className={`modal-window-acrylic device-modal-window ${isClosing ? 'closing' : ''}`} style={{
        width: '100%',
        maxWidth: '860px',
        maxHeight: 'min(92dvh, 880px)',
        overflowY: 'auto',
        padding: '24px 28px',
        position: 'relative'
      }}>
        {/* Close Button */}
        <button
          type="button"
          onClick={requestClose}
          aria-label="Cerrar ventana"
          title="Cerrar ventana"
          className="modal-close-btn"
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            zIndex: 10
          }}
        >
          <X size={18} strokeWidth={2.4} />
        </button>

        {/* Header with Hostname, Status & Action Mode Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', marginBottom: '18px', paddingRight: '44px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: `${categoryColor}20`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `1.5px solid ${categoryColor}40`,
              boxShadow: `0 4px 18px ${categoryColor}25`
            }}>
              <CategoryIcon size={26} color={categoryColor} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{
                  fontSize: '1.4rem',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  fontFamily: 'JetBrains Mono, monospace',
                  letterSpacing: '-0.02em',
                  margin: 0
                }}>
                  {isEditing ? (editForm.hostname || 'EDITAR EQUIPO') : device.hostname}
                </h2>
                
                {!isEditing ? (
                  <div className="acrylic-dropdown-wrapper" ref={statusDropdownRef}>
                    <button
                      type="button"
                      onClick={toggleStatusDropdown}
                      className={`status-pill ${getStatusBadge(device.status).className} acrylic-dropdown-trigger`}
                      style={{
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '0.74rem',
                        gap: '6px'
                      }}
                      title="Haz clic para cambiar el estado de inventario del equipo"
                    >
                      <span>{getStatusBadge(device.status).label}</span>
                      <ChevronDown
                        size={12}
                        style={{
                          transition: 'transform 0.2s ease',
                          transform: isStatusDropdownOpen ? 'rotate(180deg)' : 'none'
                        }}
                      />
                    </button>

                    {(isStatusDropdownOpen || isStatusDropdownClosing) && (
                      <div className={`acrylic-dropdown-menu ${isStatusDropdownClosing ? 'closing' : ''}`}>
                        <div className="acrylic-dropdown-header">Estado de Inventario</div>
                        <button
                          type="button"
                          onClick={() => {
                            handleStatusChange('instalado');
                            closeStatusDropdown();
                          }}
                          className={`acrylic-dropdown-item ${device.status === 'instalado' ? 'is-selected' : ''}`}
                          style={{ color: '#10b981' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="acrylic-dropdown-item-dot" style={{ backgroundColor: '#10b981', boxShadow: '0 0 6px rgba(16, 185, 129, 0.6)' }} />
                            <span>INSTALADO</span>
                          </div>
                          {device.status === 'instalado' && <Check size={14} color="#10b981" />}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            handleStatusChange('custodia');
                            closeStatusDropdown();
                          }}
                          className={`acrylic-dropdown-item ${device.status === 'custodia' ? 'is-selected' : ''}`}
                          style={{ color: '#f59e0b' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="acrylic-dropdown-item-dot" style={{ backgroundColor: '#f59e0b', boxShadow: '0 0 6px rgba(245, 158, 11, 0.6)' }} />
                            <span>EN CUSTODIA</span>
                          </div>
                          {device.status === 'custodia' && <Check size={14} color="#f59e0b" />}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            handleStatusChange('maintenance');
                            closeStatusDropdown();
                          }}
                          className={`acrylic-dropdown-item ${(device.status === 'maintenance' || device.status === 'mantenimiento') ? 'is-selected' : ''}`}
                          style={{ color: 'var(--accent-cyan, #06b6d4)' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="acrylic-dropdown-item-dot" style={{ backgroundColor: 'var(--accent-cyan, #06b6d4)', boxShadow: '0 0 6px rgba(6, 182, 212, 0.6)' }} />
                            <span>EN MANTENIMIENTO</span>
                          </div>
                          {(device.status === 'maintenance' || device.status === 'mantenimiento') && <Check size={14} color="var(--accent-cyan, #06b6d4)" />}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            handleStatusChange('baja');
                            closeStatusDropdown();
                          }}
                          className={`acrylic-dropdown-item ${device.status === 'baja' ? 'is-selected' : ''}`}
                          style={{ color: '#f43f5e' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="acrylic-dropdown-item-dot" style={{ backgroundColor: '#f43f5e', boxShadow: '0 0 6px rgba(244, 63, 94, 0.6)' }} />
                            <span>DADO DE BAJA</span>
                          </div>
                          {device.status === 'baja' && <Check size={14} color="#f43f5e" />}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '4px 10px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(255, 184, 0, 0.14)',
                      border: '1px solid rgba(255, 184, 0, 0.38)',
                      color: 'var(--accent-primary, #FFB800)',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      letterSpacing: '0.02em',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      boxShadow: '0 0 12px rgba(255, 184, 0, 0.12)'
                    }}
                  >
                    <Edit3 size={12} />
                    <span>Modo Edición</span>
                  </span>
                )}
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                {device.brand || 'Equipo'} {device.model || ''} • <strong style={{ color: 'var(--text-primary)' }}>{device.deviceType.toUpperCase()}</strong> • Ubicación: <strong style={{ color: 'var(--accent-cyan)' }}>{device.location || 'Sede Central'}</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Feedback message banner */}
        {actionMessage && (
          <div style={{
            padding: '12px 16px',
            borderRadius: '10px',
            marginBottom: '18px',
            backgroundColor: actionMessage.type === 'success' ? 'rgba(16, 185, 129, 0.14)' : 'rgba(239, 68, 68, 0.14)',
            border: `1px solid ${actionMessage.type === 'success' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
            color: actionMessage.type === 'success' ? '#34d399' : '#f87171',
            animation: 'fadeInFast 0.3s ease'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.84rem' }}>
              {actionMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              <span>{actionMessage.text}</span>
            </div>
            {actionMessage.details && (
              <div style={{ marginTop: '4px', fontSize: '0.74rem', color: '#cbd5e1', paddingLeft: '24px', fontFamily: 'monospace' }}>
                {actionMessage.details}
              </div>
            )}
          </div>
        )}

        {/* MODO EDICIÓN COMPLETO: PERMITE MODIFICAR TANTO DATOS DEL EQUIPO COMO UBICACIÓN */}
        {isEditing ? (
          <form onSubmit={handleSaveForm} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
            
            {/* BLOQUE 1: DATOS BÁSICOS DEL EQUIPO */}
            <div className="device-modal-section">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '7px',
                  background: 'rgba(99, 102, 241, 0.15)',
                  color: 'var(--accent-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Layers size={15} />
                </div>
                <h4 style={{ fontSize: '0.84rem', color: 'var(--text-primary)', margin: 0, fontWeight: 800 }}>
                  1. IDENTIFICACIÓN DEL EQUIPO
                </h4>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
                <div>
                  <label className="device-modal-label">Hostname (Nombre en Red)</label>
                  <input
                    type="text"
                    required
                    value={editForm.hostname}
                    onChange={(e) => setEditForm({ ...editForm, hostname: e.target.value })}
                    className="device-modal-input"
                    style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}
                  />
                </div>

                <div>
                  <label className="device-modal-label">Tipo de Equipo</label>
                  <CustomSelect<DeviceType>
                    value={editForm.deviceType}
                    onChange={(val) => setEditForm({ ...editForm, deviceType: val })}
                    options={DEVICE_TYPE_OPTIONS}
                  />
                </div>

                <div>
                  <label className="device-modal-label">Estado Operativo</label>
                  <CustomSelect<DeviceStatus>
                    value={editForm.status}
                    onChange={(val) => setEditForm({ ...editForm, status: val })}
                    options={DEVICE_STATUS_OPTIONS}
                  />
                </div>

                <div>
                  <label className="device-modal-label">Marca del Equipo</label>
                  <input
                    type="text"
                    value={editForm.brand}
                    onChange={(e) => setEditForm({ ...editForm, brand: e.target.value })}
                    placeholder="ej. HP, Dell, Lenovo, Ensamblada"
                    className="device-modal-input"
                  />
                </div>

                <div>
                  <label className="device-modal-label">Modelo del Equipo</label>
                  <input
                    type="text"
                    value={editForm.model}
                    onChange={(e) => setEditForm({ ...editForm, model: e.target.value })}
                    placeholder="ej. Laptop 15-bs1xx, OptiPlex 7080"
                    className="device-modal-input"
                  />
                </div>
              </div>
            </div>

            {/* BLOQUE 2: UBICACIÓN Y ASIGNACIÓN (DISEÑO COHESIVO Y ELEGANTE) */}
            <div className="device-modal-section">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '7px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <MapPin size={15} />
                </div>
                <h4 style={{ fontSize: '0.84rem', color: 'var(--text-primary)', margin: 0, fontWeight: 800 }}>
                  2. UBICACIÓN FÍSICA Y ASIGNACIÓN (RESPONSABLE)
                </h4>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
                <div>
                  <label className="device-modal-label">
                    <MapPin size={12} color="#10b981" />
                    Ubicación Física (Sede / Piso / Oficina)
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.location}
                    onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                    placeholder="ej. Sede Central - Piso 2, Oficina 301, Almacén"
                    className="device-modal-input"
                  />
                </div>

                <div>
                  <label className="device-modal-label">
                    <Building2 size={12} color="#10b981" />
                    Departamento / Área
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.department}
                    onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                    placeholder="ej. Operaciones, Sistemas, Contabilidad, Ventas"
                    className="device-modal-input"
                  />
                </div>

                <div>
                  <label className="device-modal-label">
                    <User size={12} color="#10b981" />
                    Usuario Responsable / Asignado
                  </label>
                  <input
                    type="text"
                    value={editForm.assignedUser}
                    onChange={(e) => setEditForm({ ...editForm, assignedUser: e.target.value })}
                    placeholder="ej. Arianny, Juan Pérez, Puesto Común"
                    className="device-modal-input"
                  />
                </div>
              </div>
            </div>

            {/* Suministros para Impresoras */}
            {(editForm.deviceType === 'printer' || editForm.supplies) && (
              <div className="device-modal-section" style={{ borderLeft: '3px solid #10b981' }}>
                <label className="device-modal-label" style={{ color: '#10b981', fontWeight: 800 }}>
                  <span>Suministros Compatibles (Tinta / Tóner)</span>
                </label>
                <input
                  type="text"
                  value={editForm.supplies || ''}
                  onChange={(e) => setEditForm({ ...editForm, supplies: e.target.value })}
                  placeholder="ej. Botellas Epson 544, Tóner HP 58A (CF258A)"
                  className="device-modal-input"
                  style={{ fontWeight: 700 }}
                />
              </div>
            )}

            {/* Especificaciones / Conexión para Parlantes / Ecran / Componentes HW */}
            {(editForm.deviceType === 'speaker' || editForm.deviceType === 'ecran' || editForm.deviceType === 'component' || editForm.specs) && (
              <div className="device-modal-section" style={{ borderLeft: '3px solid var(--accent-cyan)' }}>
                <label className="device-modal-label" style={{ color: 'var(--accent-cyan)', fontWeight: 800 }}>
                  {editForm.deviceType === 'ecran'
                    ? 'Dimensiones & Medidas del Ecran'
                    : editForm.deviceType === 'component'
                      ? 'Especificaciones Técnicas del Componente de Hardware'
                      : 'Tipo de Conexión & Especificaciones'}
                </label>
                <input
                  type="text"
                  value={editForm.specs || ''}
                  onChange={(e) => setEditForm({ ...editForm, specs: e.target.value })}
                  placeholder={editForm.deviceType === 'ecran' ? 'ej. 100 pulgadas (2.0m x 1.5m), Retráctil' : 'ej. Bluetooth 5.0, 10W RMS, USB'}
                  className="device-modal-input"
                />
              </div>
            )}

            {/* BLOQUE 3: ESPECIFICACIONES DE HARDWARE & RED */}
            <div className="device-modal-section">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '7px',
                  background: 'rgba(56, 189, 248, 0.15)',
                  color: 'var(--accent-cyan)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Cpu size={15} />
                </div>
                <h4 style={{ fontSize: '0.84rem', color: 'var(--text-primary)', margin: 0, fontWeight: 800 }}>
                  3. HARDWARE Y ESPECIFICACIONES TÉCNICAS
                </h4>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
                <div>
                  <label className="device-modal-label">Número de Serie (S/N)</label>
                  <input
                    type="text"
                    value={editForm.serialNumber}
                    onChange={(e) => setEditForm({ ...editForm, serialNumber: e.target.value })}
                    placeholder="ej. CND80448TH"
                    className="device-modal-input"
                    style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}
                  />
                </div>

                <div>
                  <label className="device-modal-label">Placa Madre (Motherboard)</label>
                  <input
                    type="text"
                    value={editForm.motherboard}
                    onChange={(e) => setEditForm({ ...editForm, motherboard: e.target.value })}
                    placeholder="ej. HP 832A, ASUS B550M"
                    className="device-modal-input"
                  />
                </div>

                <div>
                  <label className="device-modal-label">Procesador (CPU)</label>
                  <input
                    type="text"
                    value={editForm.cpu}
                    onChange={(e) => setEditForm({ ...editForm, cpu: e.target.value })}
                    placeholder="ej. Intel Core i5-8250U @ 1.60GHz"
                    className="device-modal-input"
                  />
                </div>

                <div>
                  <label className="device-modal-label">Memoria RAM</label>
                  <input
                    type="text"
                    value={editForm.ram}
                    onChange={(e) => setEditForm({ ...editForm, ram: e.target.value })}
                    placeholder="ej. 8 GB DDR4, 16 GB"
                    className="device-modal-input"
                  />
                </div>

                <div>
                  <label className="device-modal-label">Almacenamiento / Disco</label>
                  <input
                    type="text"
                    value={editForm.storage}
                    onChange={(e) => setEditForm({ ...editForm, storage: e.target.value })}
                    placeholder="ej. C: 931 GB (688 GB libre)"
                    className="device-modal-input"
                  />
                </div>

                <div>
                  <label className="device-modal-label">Sistema Operativo</label>
                  <input
                    type="text"
                    value={editForm.os}
                    onChange={(e) => setEditForm({ ...editForm, os: e.target.value })}
                    placeholder="ej. Windows 11 Pro 64-bit"
                    className="device-modal-input"
                  />
                </div>

                <div>
                  <label className="device-modal-label">Dirección IP</label>
                  <input
                    type="text"
                    value={editForm.ipAddress}
                    onChange={(e) => setEditForm({ ...editForm, ipAddress: e.target.value })}
                    placeholder="ej. 192.168.18.187"
                    className="device-modal-input"
                    style={{ fontFamily: 'monospace' }}
                  />
                </div>

                <div>
                  <label className="device-modal-label">Dirección MAC</label>
                  <input
                    type="text"
                    value={editForm.macAddress}
                    onChange={(e) => setEditForm({ ...editForm, macAddress: e.target.value })}
                    placeholder="ej. 00:1A:2B:3C:4D:5E"
                    className="device-modal-input"
                    style={{ fontFamily: 'monospace' }}
                  />
                </div>
              </div>
            </div>

            {/* BLOQUE 4: NOTAS DE INVENTARIO */}
            <div className="device-modal-section">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '7px',
                  background: 'rgba(148, 163, 184, 0.15)',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <FileText size={15} />
                </div>
                <h4 style={{ fontSize: '0.84rem', color: 'var(--text-primary)', margin: 0, fontWeight: 800 }}>
                  4. NOTAS Y OBSERVACIONES DE AUDITORÍA
                </h4>
              </div>

              <textarea
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                placeholder="Observaciones de auditoría, modificaciones, componentes actualizados..."
                rows={2}
                className="device-modal-input"
                style={{ resize: 'vertical', lineHeight: 1.5 }}
              />
            </div>
          </form>
        ) : (
          /* MODO VISTA: FICHA TÉCNICA E IDENTIFICACIÓN */
          <>
            {/* Technical Specifications Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '14px',
              marginBottom: '20px'
            }}>
              {/* Hardware column */}
              <div className="device-modal-section">
                <h4 style={{ fontSize: '0.78rem', color: 'var(--accent-cyan)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800 }}>
                  <Cpu size={15} /> CARACTERÍSTICAS DE HARDWARE
                </h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem' }}>
                  <div>
                    <span className="form-label" style={{ margin: 0, fontSize: '0.68rem' }}>Modelo de Placa Madre</span>
                    <span style={{ color: 'var(--accent-cyan)', fontWeight: 800 }}>{device.motherboard || 'Placa Base Estándar'}</span>
                  </div>
                  <div>
                    <span className="form-label" style={{ margin: 0, fontSize: '0.68rem' }}>Tipo de Equipo</span>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                      {device.deviceType === 'pc' ? 'Computadora Ensamblada' : (device.brand || 'Equipo Corporativo')}
                    </span>
                  </div>
                  <div>
                    <span className="form-label" style={{ margin: 0, fontSize: '0.68rem' }}>Memoria RAM</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{device.ram || 'No detectada'}</span>
                  </div>
                  <div>
                    <span className="form-label" style={{ margin: 0, fontSize: '0.68rem' }}>Procesador (CPU)</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{device.cpu || 'No detectado'}</span>
                  </div>
                  <div>
                    <span className="form-label" style={{ margin: 0, fontSize: '0.68rem' }}>Sistema Operativo</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{device.os || 'No especificado'}</span>
                  </div>
                  <div>
                    <span className="form-label" style={{ margin: 0, fontSize: '0.68rem' }}>Almacenamiento (Disco)</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{device.storage || 'No especificado'}</span>
                  </div>

                  {device.supplies && (
                    <div style={{ marginTop: '4px', padding: '6px 10px', borderRadius: '8px', backgroundColor: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                      <span className="form-label" style={{ margin: 0, fontSize: '0.66rem', color: '#10b981', fontWeight: 800 }}>Tinta / Tóner Compatible</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.78rem', display: 'block' }}>{device.supplies}</span>
                    </div>
                  )}

                  {device.specs && (
                    <div style={{ marginTop: '2px' }}>
                      <span className="form-label" style={{ margin: 0, fontSize: '0.66rem' }}>Especificaciones / Medidas</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.78rem' }}>{device.specs}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Network & Identification column */}
              <div className="device-modal-section">
                <h4 style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800 }}>
                  <Wifi size={15} /> CONECTIVIDAD & IDENTIFICACIÓN
                </h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem' }}>
                  <div>
                    <span className="form-label" style={{ margin: 0, fontSize: '0.68rem' }}>Número de Serie (S/N)</span>
                    <span style={{ color: 'var(--accent-secondary, var(--accent-primary))', fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, fontSize: '0.88rem' }}>
                      {device.serialNumber || 'Sin S/N'}
                    </span>
                  </div>
                  <div>
                    <span className="form-label" style={{ margin: 0, fontSize: '0.68rem' }}>Dirección IP</span>
                    <span style={{ color: 'var(--accent-cyan)', fontFamily: 'monospace', fontWeight: 700 }}>
                      {device.ipAddress}
                    </span>
                  </div>
                  <div>
                    <span className="form-label" style={{ margin: 0, fontSize: '0.68rem' }}>Dirección MAC</span>
                    <span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                      {device.macAddress}
                    </span>
                  </div>
                  <div>
                    <span className="form-label" style={{ margin: 0, fontSize: '0.68rem' }}>Última Verificación</span>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {new Date(device.lastAuditDate).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Assignment & Location column */}
              <div className="device-modal-section" style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}>
                <div>
                  <h4 style={{ fontSize: '0.78rem', color: 'var(--accent-emerald)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800 }}>
                    <MapPin size={15} /> UBICACIÓN & RESPONSABLE
                  </h4>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem' }}>
                    <div>
                      <span className="form-label" style={{ margin: 0, fontSize: '0.68rem' }}>Ubicación Física</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: '0.85rem' }}>
                        {device.location || 'Sede Central'}
                      </span>
                    </div>
                    <div>
                      <span className="form-label" style={{ margin: 0, fontSize: '0.68rem' }}>Departamento / Área</span>
                      <span style={{ color: 'var(--text-secondary)' }}>{device.department || 'General'}</span>
                    </div>
                    <div>
                      <span className="form-label" style={{ margin: 0, fontSize: '0.68rem' }}>Usuario Asignado</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{device.assignedUser || 'Sin Asignar'}</span>
                    </div>
                  </div>
                </div>

                {/* QR Label Generator - Proporción compacta y simétrica */}
                <div style={{
                  marginTop: '12px',
                  paddingTop: '10px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  {qrDataUrl && (
                    <div 
                      onClick={handlePrintLabel}
                      title="Clic para imprimir etiqueta oficial de este activo"
                      style={{
                        padding: '3px',
                        backgroundColor: '#ffffff',
                        borderRadius: '6px',
                        border: '1px solid var(--border-acrylic)',
                        cursor: 'pointer',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      <img
                        src={qrDataUrl}
                        alt="QR Code"
                        style={{
                          width: '68px',
                          height: '68px',
                          display: 'block',
                          borderRadius: '4px'
                        }}
                      />
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                      Etiqueta Corporativa
                    </span>
                    <button
                      type="button"
                      onClick={handlePrintLabel}
                      className="btn-flat"
                      style={{ 
                        padding: '5px 10px', 
                        fontSize: '0.72rem', 
                        fontWeight: 700, 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '6px',
                        borderRadius: '6px',
                        whiteSpace: 'nowrap',
                        width: 'fit-content'
                      }}
                      title="Imprimir etiqueta oficial"
                    >
                      <Printer size={13} style={{ flexShrink: 0 }} />
                      <span>Imprimir Etiqueta</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes if present */}
            {device.notes && (
              <div style={{
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(148, 163, 184, 0.06)',
                border: '1px solid var(--border-acrylic)',
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                marginBottom: '18px'
              }}>
                <strong style={{ color: 'var(--text-primary)' }}>Notas:</strong> {device.notes}
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <div 
          className="device-modal-footer"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '16px',
            borderTop: '1px solid var(--border-acrylic)',
            marginTop: '20px'
          }}
        >
          <div className="device-modal-footer-danger">
            {currentUserRole === 'admin' ? (
              confirmDelete ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.78rem', color: '#f87171', fontWeight: 700 }}>¿Eliminar este equipo del inventario?</span>
                  <button onClick={handleDelete} className="btn-flat btn-danger" style={{ padding: '6px 12px', fontSize: '0.72rem' }}>
                    Sí, Eliminar
                  </button>
                  <button onClick={() => setConfirmDelete(false)} className="btn-flat" style={{ padding: '6px 10px', fontSize: '0.72rem' }}>
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="btn-flat btn-danger-soft"
                  style={{ fontSize: '0.76rem', padding: '7px 14px', gap: '6px' }}
                  title="Eliminar este equipo del inventario de forma permanente"
                >
                  <Trash2 size={13} />
                  <span>Eliminar del Inventario</span>
                </button>
              )
            ) : (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(148, 163, 184, 0.08)',
                  color: 'var(--text-muted)',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  border: '1px dashed var(--border-acrylic)'
                }}
                title="Función protegida: la eliminación de activos está restringida exclusivamente a usuarios con rol Administrador"
              >
                <Lock size={12} color="#f59e0b" />
                <span>Eliminación solo Administrador</span>
              </div>
            )}
          </div>

          <div className="device-modal-footer-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="btn-flat"
                  style={{ padding: '7px 16px', fontSize: '0.78rem' }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveForm}
                  disabled={isSaving}
                  className="btn-flat btn-primary"
                  style={{ padding: '7px 18px', fontSize: '0.78rem', gap: '6px' }}
                >
                  <Save size={14} />
                  <span>{isSaving ? 'Guardando...' : 'Guardar Cambios'}</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="btn-flat btn-primary"
                  style={{ padding: '7px 16px', fontSize: '0.76rem', gap: '5px' }}
                >
                  <Edit3 size={13} />
                  <span>Editar Datos y Ubicación</span>
                </button>
                <button onClick={requestClose} className="btn-flat" style={{ padding: '7px 20px', fontWeight: 700, fontSize: '0.78rem' }}>
                  Cerrar
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeviceModal;
