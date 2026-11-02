import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Save, 
  PlusCircle, 
  AlertCircle, 
  Barcode, 
  Cpu, 
  Monitor, 
  Tag, 
  Printer, 
  Volume2, 
  Projector, 
  Tv, 
  Network, 
  Sparkles,
  Droplet,
  UserCheck,
  HardDrive,
  ChevronDown,
  Check,
  Layers
} from 'lucide-react';
import type { Device, DeviceType, DeviceStatus } from '../types';
import { api } from '../services/api';
import { PRINTER_CATALOG, SPEAKER_PRESETS, ECRAN_PRESETS, searchPrinterCatalog } from '../data/printerCatalog';
import {
  HARDWARE_COMPONENTS_CATALOG,
  getHardwareComponentDef,
  type HardwareComponentKey
} from '../data/hardwareComponentsCatalog';
import { CustomSelect, type SelectOption } from './CustomSelect';

const FORM_STATUS_OPTIONS: SelectOption<DeviceStatus>[] = [
  { value: 'instalado', label: 'Instalado (En uso activo)', dotColor: 'var(--accent-emerald)' },
  { value: 'custodia', label: 'En Custodia (Almacén TI)', dotColor: 'var(--accent-amber)' },
  { value: 'maintenance', label: 'En Mantenimiento (Taller / Revisión)', dotColor: 'var(--accent-cyan)' },
  { value: 'baja', label: 'Dado de Baja (Obsoleto)', dotColor: 'var(--accent-rose)' }
];

interface AuditFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeviceSaved: () => void;
  prefillCode?: string;
  onOpenFieldScanner?: (field: 'hostname' | 'serialNumber') => void;
}

export const AuditFormModal: React.FC<AuditFormModalProps> = ({
  isOpen,
  onClose,
  onDeviceSaved,
  prefillCode,
  onOpenFieldScanner
}) => {
  const [isClosing, setIsClosing] = useState(false);

  const requestClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 200);
  };

  const [formData, setFormData] = useState<Partial<Device>>({
    hostname: '',
    deviceType: 'pc',
    status: 'instalado',
    os: 'Windows 11 Pro 64-bit',
    ram: '16 GB DDR4',
    cpu: 'Intel Core i5',
    storage: '512 GB SSD NVMe',
    ipAddress: '',
    macAddress: '',
    serialNumber: '',
    motherboard: 'HP 832A (Intel C236)',
    compatibility: 'Compatible',
    brand: 'Dell',
    model: 'OptiPlex',
    assignedUser: '',
    department: 'Operaciones',
    location: 'Sede Principal',
    supplies: '',
    specs: '',
    notes: 'Levantamiento de inventario registrado.'
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Autocomplete state for Printer catalog
  const [showPrinterSuggestions, setShowPrinterSuggestions] = useState(false);
  const [printerSuggestions, setPrinterSuggestions] = useState(PRINTER_CATALOG.slice(0, 8));
  const printerDropdownRef = useRef<HTMLDivElement>(null);

  // Hardware Components dropdown & dynamic fields state
  const [isHwMenuOpen, setIsHwMenuOpen] = useState(false);
  const [selectedComponentKey, setSelectedComponentKey] = useState<HardwareComponentKey>('ram');
  const [componentFields, setComponentFields] = useState<Record<string, string>>(() => {
    const initialDef = getHardwareComponentDef('ram');
    const defaults: Record<string, string> = {};
    initialDef.fields.forEach(f => { defaults[f.key] = f.defaultValue; });
    return defaults;
  });
  const hwMenuRef = useRef<HTMLDivElement>(null);

  // Close suggestions and Hardware menu when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (printerDropdownRef.current && !printerDropdownRef.current.contains(e.target as Node)) {
        setShowPrinterSuggestions(false);
      }
      if (hwMenuRef.current && !hwMenuRef.current.contains(e.target as Node)) {
        setIsHwMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isHwMenuOpen || showPrinterSuggestions) {
          setIsHwMenuOpen(false);
          setShowPrinterSuggestions(false);
        } else {
          requestClose();
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (prefillCode) {
      const code = prefillCode.toUpperCase();
      if (code.startsWith('PC-') || code.startsWith('SRV-') || code.startsWith('LAP-')) {
        setFormData(prev => ({ ...prev, hostname: code, serialNumber: `SN-${code}` }));
      } else if (code.startsWith('IMP-') || code.startsWith('PRN-')) {
        setFormData(prev => ({ ...prev, deviceType: 'printer', hostname: code, serialNumber: code }));
      } else if (code.startsWith('PAR-') || code.startsWith('SPK-')) {
        setFormData(prev => ({ ...prev, deviceType: 'speaker', hostname: code, serialNumber: code }));
      } else if (code.startsWith('ECR-') || code.startsWith('PRJ-')) {
        setFormData(prev => ({ ...prev, deviceType: 'ecran', hostname: code, serialNumber: code }));
      } else {
        setFormData(prev => ({ ...prev, serialNumber: prefillCode, hostname: `ACTIVO-${prefillCode.slice(-4).toUpperCase()}` }));
      }
    }
  }, [prefillCode]);

  // Select a specific Hardware Component from the dropdown menu and adapt all fields
  const handleSelectHardwareComponent = (compKey: HardwareComponentKey) => {
    const def = getHardwareComponentDef(compKey);
    const nextFields: Record<string, string> = {};
    def.fields.forEach(f => {
      nextFields[f.key] = f.defaultValue;
    });
    setSelectedComponentKey(compKey);
    setComponentFields(nextFields);
    setIsHwMenuOpen(false);

    const autoCodePrefixes = ['EQUIPO-', 'PC-', 'IMP-', 'PARLANTE-', 'ECRAN-', 'MON-', ...HARDWARE_COMPONENTS_CATALOG.map(c => `${c.codePrefix}-`)];
    setFormData(prev => {
      const shouldGenCode = !prev.hostname || autoCodePrefixes.some(p => prev.hostname?.startsWith(p));
      return {
        ...prev,
        deviceType: 'component',
        brand: def.defaultBrand,
        model: def.defaultModel,
        status: prev.status || 'custodia',
        location: prev.location === 'Sede Principal' ? 'Almacén TI / Stock' : (prev.location || 'Almacén TI / Stock'),
        department: prev.department === 'Operaciones' ? 'Soporte TI / Hardware' : (prev.department || 'Soporte TI / Hardware'),
        hostname: shouldGenCode ? `${def.codePrefix}-${Date.now().toString().slice(-4)}` : prev.hostname
      };
    });
  };

  // When deviceType changes, adapt defaults
  const handleTypeChange = (newType: DeviceType) => {
    setIsHwMenuOpen(false);
    if (newType === 'component') {
      handleSelectHardwareComponent(selectedComponentKey);
      return;
    }
    setFormData(prev => {
      const updated = { ...prev, deviceType: newType };
      if (newType === 'printer') {
        updated.brand = 'Epson';
        updated.model = 'EcoTank L3250';
        updated.supplies = 'Botellas de Tinta Epson 544 (T544120 Negro, T544220 Cyan, T544320 Magenta, T544420 Amarillo)';
        updated.os = 'Firmware Impresora';
        updated.cpu = 'Controlador RISC';
        updated.ram = '128 MB';
        updated.storage = 'Memoria Flash';
        if (!prev.hostname || prev.hostname.startsWith('EQUIPO-') || prev.hostname.startsWith('PC-')) {
          updated.hostname = `IMP-${Date.now().toString().slice(-4)}`;
        }
      } else if (newType === 'speaker') {
        updated.brand = 'Logitech';
        updated.model = 'Z207 Bluetooth Stereo';
        updated.specs = 'Parlantes Estéreo Bluetooth 5.0 + Jack 3.5mm, 10W Pico';
        updated.os = 'N/A (Dispositivo de Audio)';
        updated.cpu = 'N/A';
        updated.ram = 'N/A';
        updated.storage = 'N/A';
        if (!prev.hostname || prev.hostname.startsWith('EQUIPO-') || prev.hostname.startsWith('PC-')) {
          updated.hostname = `PARLANTE-${Date.now().toString().slice(-4)}`;
        }
      } else if (newType === 'ecran') {
        updated.brand = 'KlipXtreme';
        updated.model = 'KPS-310 Manual Retráctil 100"';
        updated.specs = 'Pantalla de Proyección 100 pulgadas (2.0m x 1.5m), Retráctil de Pared/Techo';
        updated.os = 'N/A (Pantalla de Proyección)';
        updated.cpu = 'N/A';
        updated.ram = 'N/A';
        updated.storage = 'N/A';
        if (!prev.hostname || prev.hostname.startsWith('EQUIPO-') || prev.hostname.startsWith('PC-')) {
          updated.hostname = `ECRAN-${Date.now().toString().slice(-4)}`;
        }
      } else if (newType === 'monitor') {
        updated.brand = 'Dell';
        updated.model = 'P2419H 24" IPS';
        updated.specs = 'Monitor 23.8 pulgadas Full HD (1920x1080), HDMI / DisplayPort / VGA';
        updated.os = 'N/A (Display)';
        updated.cpu = 'N/A';
        updated.ram = 'N/A';
        updated.storage = 'N/A';
        if (!prev.hostname || prev.hostname.startsWith('EQUIPO-') || prev.hostname.startsWith('PC-')) {
          updated.hostname = `MON-${Date.now().toString().slice(-4)}`;
        }
      }
      return updated;
    });
  };

  const handleSelectPrinterCatalogItem = (item: typeof PRINTER_CATALOG[0]) => {
    setFormData(prev => ({
      ...prev,
      brand: item.brand,
      model: item.model,
      supplies: item.supplies,
      notes: `${item.technology}. ${item.description || ''}. Conexión recomendada: ${item.defaultConnection}.`
    }));
    setShowPrinterSuggestions(false);
  };

  if (!isOpen) return null;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!formData.hostname?.trim()) {
      setError('El identificador o código del equipo es obligatorio');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let payload: Partial<Device> = {
        ...formData,
        hostname: formData.hostname.toUpperCase().trim(),
        serialNumber: formData.serialNumber?.trim() || `SN-${Date.now().toString().slice(-6)}`
      };

      if (formData.deviceType === 'component') {
        const compDef = getHardwareComponentDef(selectedComponentKey);
        const specsParts = compDef.fields
          .map(f => {
            const val = (componentFields[f.key] || '').trim();
            return val ? `${f.label.replace(/\s*\*$/, '')}: ${val}` : '';
          })
          .filter(Boolean);
        const compactSpecs = compDef.fields
          .map(f => (componentFields[f.key] || '').trim())
          .filter(Boolean)
          .join(' • ');

        payload = {
          ...payload,
          deviceType: 'component',
          os: `Componente: ${compDef.shortLabel}`,
          specs: `[${compDef.shortLabel}] ${compactSpecs}`,
          notes: formData.notes && formData.notes !== 'Levantamiento de inventario registrado.'
            ? `${compDef.label} (${specsParts.join(' | ')}) — ${formData.notes}`
            : `${compDef.label} • ${specsParts.join(' | ')}`
        };

        if (selectedComponentKey === 'cpu') {
          payload.cpu = `${formData.brand || ''} ${formData.model || ''} (${componentFields.coresThreads || ''})`.trim();
          payload.motherboard = componentFields.socket || 'Socket CPU';
          payload.ram = componentFields.frequency || 'N/A';
          payload.storage = componentFields.igpu || 'N/A';
        } else if (selectedComponentKey === 'ram') {
          payload.ram = `${componentFields.capacity || ''} ${componentFields.ddrType || ''} ${componentFields.speed || ''}`.trim();
          payload.cpu = componentFields.formFactor || 'Módulo RAM';
          payload.motherboard = componentFields.ddrType || 'RAM';
          payload.storage = componentFields.capacity || 'N/A';
        } else if (selectedComponentKey === 'storage') {
          payload.storage = `${componentFields.capacity || ''} ${componentFields.driveType || ''}`.trim();
          payload.cpu = componentFields.interface || 'Unidad de Almacenamiento';
          payload.ram = componentFields.health || '100% Óptimo';
          payload.motherboard = componentFields.driveType || 'Storage';
        } else if (selectedComponentKey === 'motherboard') {
          payload.motherboard = `${formData.brand || ''} ${formData.model || ''} (${componentFields.chipset || ''})`.trim();
          payload.cpu = `Socket ${componentFields.socket || ''}`.trim();
          payload.ram = componentFields.ramSlots || 'N/A';
          payload.storage = componentFields.formFactor || 'N/A';
        } else if (selectedComponentKey === 'gpu') {
          payload.cpu = `GPU ${componentFields.vram || ''} ${componentFields.memoryType || ''}`.trim();
          payload.ram = `${componentFields.vram || ''} VRAM`.trim();
          payload.storage = componentFields.outputs || 'N/A';
          payload.motherboard = componentFields.powerConnector || 'PCIe x16';
        } else if (selectedComponentKey === 'psu') {
          payload.cpu = `Fuente ${componentFields.wattage || ''}`.trim();
          payload.ram = componentFields.certification || 'Estándar';
          payload.storage = componentFields.modularity || 'N/A';
          payload.motherboard = componentFields.psuFormat || 'ATX';
        } else if (selectedComponentKey === 'nic') {
          payload.macAddress = componentFields.macInfo || formData.macAddress || '00:00:00:00:00:00';
          payload.cpu = componentFields.speedStandard || 'Adaptador de Red';
          payload.ram = componentFields.busInterface || 'N/A';
          payload.storage = 'Red / Conectividad';
          payload.motherboard = componentFields.busInterface || 'PCIe / USB';
        } else {
          const vals = compDef.fields.map(f => componentFields[f.key] || '').filter(Boolean);
          payload.cpu = compDef.shortLabel;
          payload.ram = vals[0] || 'Estándar';
          payload.storage = vals[1] || vals[0] || 'Componente';
          payload.motherboard = vals[2] || compDef.shortLabel;
        }
      }

      await api.createDevice(payload);
      onDeviceSaved();
      requestClose();
    } catch (err: any) {
      setError(err.message || 'Error al guardar el equipo en inventario');
    } finally {
      setLoading(false);
    }
  };

  const currentType = formData.deviceType || 'pc';
  const isComputer = currentType === 'pc' || currentType === 'laptop' || currentType === 'server';
  const isPrinter = currentType === 'printer';
  const isSpeaker = currentType === 'speaker';
  const isEcran = currentType === 'ecran';
  const isMonitor = currentType === 'monitor';
  const isNetwork = currentType === 'network';
  const isComponent = currentType === 'component';
  const activeComponentDef = getHardwareComponentDef(selectedComponentKey);

  const componentTypeSelectOptions: SelectOption<HardwareComponentKey>[] = HARDWARE_COMPONENTS_CATALOG.map(c => ({
    value: c.id,
    label: c.label,
    dotColor: c.dotColor
  }));

  return (
    <div 
      className={`modal-backdrop-acrylic ${isClosing ? 'closing' : ''}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          requestClose();
        }
      }}
    >
      <div className={`modal-window-acrylic ${isClosing ? 'closing' : ''}`} style={{
        width: '100%',
        maxWidth: isEcran || isSpeaker ? '640px' : '780px',
        maxHeight: 'min(92dvh, 900px)',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '20px',
        overflow: 'hidden',
        position: 'relative',
        transition: 'max-width 0.3s ease'
      }}>
        {/* Encabezado Fijo Adaptativo */}
        <div style={{
          padding: '16px 22px',
          borderBottom: '1px solid var(--border-acrylic)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          background: 'var(--bg-canvas)'
        }}>
          <div>
            <h3 style={{
              fontSize: '1.15rem',
              fontWeight: 800,
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              margin: 0
            }}>
              {isPrinter && <Printer size={22} color="var(--accent-secondary)" />}
              {isSpeaker && <Volume2 size={22} color="#f97316" />}
              {isEcran && <Projector size={22} color="#a855f7" />}
              {isMonitor && <Tv size={22} color="#06b6d4" />}
              {isNetwork && <Network size={22} color="var(--accent-rose)" />}
              {isComponent && <HardDrive size={22} color={activeComponentDef.dotColor} />}
              {isComputer && <PlusCircle size={22} color="var(--accent-primary)" />}
              <span>
                {isComponent ? `Registro de Hardware: ${activeComponentDef.label}` :
                 isEcran ? 'Registro de Ecran / Pantalla de Proyección' :
                 isSpeaker ? 'Registro de Parlantes / Sistema de Audio' :
                 isPrinter ? 'Registro de Impresora y Suministros' :
                 'Registro de Activo en Inventario TI'}
              </span>
            </h3>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: '3px 0 0 0' }}>
              {isComponent ? `Formulario adaptado para ${activeComponentDef.shortLabel}: ${activeComponentDef.subtitle}` :
               isEcran ? 'Formulario simplificado: solo modelo, código patrimonial y ubicación' :
               isSpeaker ? 'Formulario de audio: código de barras, número de serie y modelo' :
               isPrinter ? 'Base de datos inteligente: detección automática de cartuchos de tinta y tóner' :
               'Campos dinámicos adaptados según el tipo de bien seleccionado'}
            </p>
          </div>

          <button
            type="button"
            onClick={requestClose}
            className="modal-close-btn"
            title="Cerrar ventana"
            aria-label="Cerrar ventana"
          >
            <X size={18} strokeWidth={2.4} />
          </button>
        </div>

        {/* Cuerpo del Formulario Scrollable */}
        <form onSubmit={handleSubmit} style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          overflowY: 'auto',
          padding: '18px 22px',
          gap: '16px'
        }}>
          {error && (
            <div style={{
              padding: '10px 14px',
              borderRadius: '8px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid #ef4444',
              color: '#f87171',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* SELECTOR MAESTRO: TIPO DE BIEN A INVENTARIAR */}
          <div
            ref={hwMenuRef}
            style={{
              backgroundColor: 'var(--bg-canvas-subtle)',
              padding: '14px 16px',
              borderRadius: '12px',
              border: '1px solid var(--border-acrylic)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              position: 'relative'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                ¿Qué tipo de bien vas a inventariar?
              </label>
              <span style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', fontWeight: 700 }}>
                El formulario se adapta automáticamente
              </span>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
              gap: '8px'
            }}>
              {[
                { id: 'pc', label: 'PC Escritorio', icon: Monitor },
                { id: 'laptop', label: 'Laptop', icon: Monitor },
                { id: 'printer', label: 'Impresora', icon: Printer },
                { id: 'speaker', label: 'Parlantes', icon: Volume2 },
                { id: 'ecran', label: 'Ecran', icon: Projector },
                { id: 'monitor', label: 'Monitor', icon: Tv },
                { id: 'server', label: 'Servidor', icon: Cpu },
                { id: 'network', label: 'Red / Switch', icon: Network }
              ].map(t => {
                const isSelected = formData.deviceType === t.id;
                const IconComponent = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleTypeChange(t.id as DeviceType)}
                    className="btn-flat"
                    style={{
                      padding: '8px 10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      borderRadius: '8px',
                      fontSize: '0.76rem',
                      fontWeight: isSelected ? 800 : 600,
                      backgroundColor: isSelected ? 'var(--accent-primary)' : 'var(--bg-canvas)',
                      color: isSelected ? 'var(--accent-contrast, #000000)' : 'var(--text-primary)',
                      borderColor: isSelected ? 'var(--accent-primary)' : 'var(--border-acrylic)',
                      boxShadow: isSelected ? '0 2px 10px var(--accent-glow)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <IconComponent size={15} />
                    <span>{t.label}</span>
                  </button>
                );
              })}

              {/* PESTAÑA DESPLEGABLE: COMPONENTES DE CÓMPUTO (HARDWARE) */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isComponent) {
                    handleSelectHardwareComponent(selectedComponentKey);
                    setIsHwMenuOpen(true);
                  } else {
                    setIsHwMenuOpen(prev => !prev);
                  }
                }}
                className="btn-flat"
                aria-haspopup="listbox"
                aria-expanded={isHwMenuOpen}
                style={{
                  padding: '8px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '6px',
                  borderRadius: '8px',
                  fontSize: '0.76rem',
                  fontWeight: isComponent ? 800 : 600,
                  backgroundColor: isComponent ? 'var(--accent-primary)' : 'var(--bg-canvas)',
                  color: isComponent ? 'var(--accent-contrast, #000000)' : 'var(--text-primary)',
                  borderColor: isComponent || isHwMenuOpen ? 'var(--accent-primary)' : 'var(--border-acrylic)',
                  boxShadow: isComponent ? '0 2px 10px var(--accent-glow)' : 'none',
                  transition: 'all 0.15s ease'
                }}
                title="Desplegar lista de Componentes de Cómputo (Hardware)"
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', minWidth: 0, overflow: 'hidden' }}>
                  <HardDrive size={15} style={{ flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {isComponent ? activeComponentDef.shortLabel : 'Hardware'}
                  </span>
                </span>
                <ChevronDown
                  size={14}
                  style={{
                    flexShrink: 0,
                    transform: isHwMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.18s ease',
                    opacity: 0.85
                  }}
                />
              </button>
            </div>

            {/* MENÚ DESPLEGABLE ACORDE A LA PÁGINA CON LA LISTA DE COMPONENTES DE HARDWARE */}
            {isHwMenuOpen && (
              <div
                role="listbox"
                className="acrylic-select-popover"
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  left: 0,
                  right: 0,
                  zIndex: 220,
                  maxHeight: '340px',
                  overflowY: 'auto',
                  padding: '8px'
                }}
              >
                <div style={{
                  padding: '4px 8px 8px 8px',
                  marginBottom: '6px',
                  borderBottom: '1px solid var(--border-acrylic)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '6px'
                }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Selecciona el Componente de Cómputo (Hardware)
                  </span>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    {HARDWARE_COMPONENTS_CATALOG.length} categorías disponibles
                  </span>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: '4px'
                }}>
                  {HARDWARE_COMPONENTS_CATALOG.map(comp => {
                    const isActiveComp = isComponent && selectedComponentKey === comp.id;
                    return (
                      <button
                        key={comp.id}
                        type="button"
                        role="option"
                        aria-selected={isActiveComp}
                        onClick={() => handleSelectHardwareComponent(comp.id)}
                        className={`acrylic-select-option ${isActiveComp ? 'is-selected' : ''}`}
                        style={{
                          padding: '8px 10px',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                          textAlign: 'left'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', minWidth: 0 }}>
                          <span
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: comp.dotColor,
                              marginTop: '5px',
                              flexShrink: 0
                            }}
                          />
                          <div style={{ minWidth: 0 }}>
                            <div style={{
                              fontSize: '0.78rem',
                              fontWeight: isActiveComp ? 800 : 700,
                              color: isActiveComp ? 'var(--accent-primary)' : 'var(--text-primary)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {comp.label}
                            </div>
                            <div style={{
                              fontSize: '0.66rem',
                              color: 'var(--text-secondary)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              marginTop: '1px'
                            }}>
                              {comp.subtitle}
                            </div>
                          </div>
                        </div>

                        {isActiveComp && (
                          <Check size={14} color="var(--accent-primary)" strokeWidth={2.5} style={{ flexShrink: 0 }} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ============================================================== */}
          {/* CASO 0: COMPONENTES DE CÓMPUTO / HARDWARE (CAMPOS DINÁMICOS)   */}
          {/* ============================================================== */}
          {isComponent && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Bloque 1: Selector de Componente, Código, Serie, Marca y Modelo */}
              <div style={{
                backgroundColor: 'var(--bg-canvas-subtle)',
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid var(--border-acrylic)',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    <HardDrive size={16} color={activeComponentDef.dotColor} />
                    <span>1. Identificación de {activeComponentDef.label}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsHwMenuOpen(true)}
                    className="btn-flat"
                    style={{ padding: '4px 10px', fontSize: '0.7rem', borderRadius: '6px', gap: '5px' }}
                  >
                    <Layers size={12} color="var(--accent-primary)" />
                    <span>Cambiar componente</span>
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px' }}>
                  {/* Selector directo sincronizado con el menú */}
                  <div className="form-group">
                    <label className="form-label">Categoría de Componente *</label>
                    <CustomSelect<HardwareComponentKey>
                      value={selectedComponentKey}
                      onChange={(val) => handleSelectHardwareComponent(val)}
                      options={componentTypeSelectOptions}
                    />
                  </div>

                  {/* Estado Operativo */}
                  <div className="form-group">
                    <label className="form-label">Estado del Componente *</label>
                    <CustomSelect<DeviceStatus>
                      value={formData.status || 'custodia'}
                      onChange={(val) => setFormData({ ...formData, status: val })}
                      options={FORM_STATUS_OPTIONS}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                  {/* Código del Componente / Patrimonial */}
                  <div className="form-group">
                    <label className="form-label">Código Patrimonial / Identificador *</label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input
                        type="text"
                        required
                        className="form-input"
                        placeholder={`Ej: ${activeComponentDef.codePrefix}-0015 o PAT-9041`}
                        value={formData.hostname}
                        onChange={(e) => setFormData({ ...formData, hostname: e.target.value.toUpperCase() })}
                        style={{ fontFamily: 'monospace', fontWeight: 700, flex: 1, height: '38px' }}
                      />
                      {onOpenFieldScanner && (
                        <button
                          type="button"
                          onClick={() => onOpenFieldScanner('hostname')}
                          className="btn-flat btn-primary"
                          style={{ padding: '0 12px', height: '38px', fontSize: '0.74rem', gap: '5px' }}
                          title="Escanear Código de Barras del Componente"
                        >
                          <Barcode size={15} />
                          <span>Escanear</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Número de Serie / Part Number */}
                  <div className="form-group">
                    <label className="form-label">Número de Serie (S/N) / Part Number *</label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input
                        type="text"
                        required
                        className="form-input"
                        placeholder="Serial de fábrica o P/N"
                        value={formData.serialNumber}
                        onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                        style={{ fontFamily: 'monospace', fontWeight: 700, flex: 1, height: '38px' }}
                      />
                      {onOpenFieldScanner && (
                        <button
                          type="button"
                          onClick={() => onOpenFieldScanner('serialNumber')}
                          className="btn-flat btn-primary"
                          style={{ padding: '0 12px', height: '38px', fontSize: '0.74rem', gap: '5px' }}
                          title="Escanear Número de Serie"
                        >
                          <Barcode size={15} />
                          <span>Escanear</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                  {/* Marca */}
                  <div className="form-group">
                    <label className="form-label">Marca *</label>
                    <input
                      type="text"
                      required
                      className="form-input"
                      placeholder={activeComponentDef.brandPlaceholder}
                      value={formData.brand}
                      onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                      style={{ height: '38px' }}
                    />
                  </div>

                  {/* Modelo */}
                  <div className="form-group">
                    <label className="form-label">Modelo Exacto *</label>
                    <input
                      type="text"
                      required
                      className="form-input"
                      placeholder={activeComponentDef.modelPlaceholder}
                      value={formData.model}
                      onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                      style={{ height: '38px' }}
                    />
                  </div>
                </div>

                {/* Presets Rápidos Adaptados al Componente */}
                {activeComponentDef.presets.length > 0 && (
                  <div>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                      Plantillas rápidas de {activeComponentDef.shortLabel}:
                    </span>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {activeComponentDef.presets.map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({ ...prev, brand: preset.brand, model: preset.model }));
                            setComponentFields(prev => ({ ...prev, ...preset.fields }));
                          }}
                          className="btn-flat"
                          style={{ padding: '4px 10px', fontSize: '0.69rem', borderRadius: '6px' }}
                        >
                          <Sparkles size={11} color="var(--accent-primary)" />
                          <span>{preset.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Bloque 2: Campos Técnicos Específicos según el Componente Elegido */}
              <div style={{
                backgroundColor: 'var(--bg-canvas-subtle)',
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid var(--border-acrylic)',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  <Cpu size={16} color="var(--accent-primary)" />
                  <span>2. Especificaciones Técnicas de {activeComponentDef.shortLabel}</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px' }}>
                  {activeComponentDef.fields.map(field => {
                    if (field.type === 'select' && field.options) {
                      const selectOpts: SelectOption<string>[] = field.options.map(o => ({ value: o, label: o }));
                      return (
                        <div key={field.key} className="form-group">
                          <label className="form-label">{field.label}</label>
                          <CustomSelect<string>
                            value={componentFields[field.key] || field.defaultValue}
                            onChange={(val) => setComponentFields(prev => ({ ...prev, [field.key]: val }))}
                            options={selectOpts}
                          />
                        </div>
                      );
                    }
                    return (
                      <div key={field.key} className="form-group">
                        <label className="form-label">{field.label}</label>
                        <input
                          type="text"
                          required={Boolean(field.required)}
                          className="form-input"
                          placeholder={field.placeholder || ''}
                          value={componentFields[field.key] ?? ''}
                          onChange={(e) => setComponentFields(prev => ({ ...prev, [field.key]: e.target.value }))}
                          style={{ height: '38px' }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bloque 3: Ubicación, Stock de Almacén o Equipo donde está Instalado */}
              <div style={{
                backgroundColor: 'var(--bg-canvas-subtle)',
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid var(--border-acrylic)',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  <UserCheck size={16} color="var(--accent-secondary)" />
                  <span>3. Ubicación en Almacén o Equipo Asignado</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Almacén o Equipo donde está instalado *</label>
                    <input
                      type="text"
                      required
                      className="form-input"
                      placeholder="Ej: Almacén TI Estante B2 o Instalado en PC-CONTAB-01"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      style={{ height: '38px' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Área / Laboratorio</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Ej: Soporte TI, Laboratorio Cómputo 2"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      style={{ height: '38px' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Responsable / Custodio</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Ej: Técnico de Soporte TI"
                      value={formData.assignedUser}
                      onChange={(e) => setFormData({ ...formData, assignedUser: e.target.value })}
                      style={{ height: '38px' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* CASO 1: ECRAN / PANTALLA DE PROYECCIÓN (Solo modelo y código) */}
          {/* ============================================================== */}
          {isEcran && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{
                backgroundColor: 'var(--bg-canvas-subtle)',
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid var(--border-acrylic)',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  <Projector size={16} color="#a855f7" />
                  <span>Datos del Ecran (Campos Exclusivos)</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                  {/* Código del Bien / Patrimonial con botón de Escanear */}
                  <div className="form-group">
                    <label className="form-label">Código del Bien / Barras Patrimonial *</label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input
                        type="text"
                        required
                        className="form-input"
                        placeholder="Ej: ECR-SALA-01 o PAT-88210"
                        value={formData.hostname}
                        onChange={(e) => setFormData({ ...formData, hostname: e.target.value.toUpperCase() })}
                        style={{ fontFamily: 'monospace', fontWeight: 700, flex: 1, height: '38px' }}
                      />
                      {onOpenFieldScanner && (
                        <button
                          type="button"
                          onClick={() => onOpenFieldScanner('hostname')}
                          className="btn-flat btn-primary"
                          style={{ padding: '0 12px', height: '38px', fontSize: '0.74rem', gap: '5px' }}
                          title="Escanear Código de Barras del Ecran"
                        >
                          <Barcode size={15} />
                          <span>Escanear</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Número de Serie del Ecran */}
                  <div className="form-group">
                    <label className="form-label">Número de Serie (S/N)</label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Serial de fábrica (opcional)"
                        value={formData.serialNumber}
                        onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                        style={{ fontFamily: 'monospace', flex: 1, height: '38px' }}
                      />
                      {onOpenFieldScanner && (
                        <button
                          type="button"
                          onClick={() => onOpenFieldScanner('serialNumber')}
                          className="btn-flat"
                          style={{ padding: '0 10px', height: '38px' }}
                          title="Escanear Serial"
                        >
                          <Barcode size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                  {/* Modelo de Ecran */}
                  <div className="form-group">
                    <label className="form-label">Modelo del Ecran *</label>
                    <input
                      type="text"
                      required
                      className="form-input"
                      placeholder="Ej: Manual Retráctil 100'', KPS-310"
                      value={formData.model}
                      onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                      style={{ height: '38px' }}
                    />
                  </div>

                  {/* Marca */}
                  <div className="form-group">
                    <label className="form-label">Marca</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Ej: KlipXtreme, Da-Lite, Elite Screens"
                      value={formData.brand}
                      onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                      style={{ height: '38px' }}
                    />
                  </div>

                  {/* Estado */}
                  <div className="form-group">
                    <label className="form-label">Estado *</label>
                    <CustomSelect<DeviceStatus>
                      value={formData.status || 'instalado'}
                      onChange={(val) => setFormData({ ...formData, status: val })}
                      options={FORM_STATUS_OPTIONS}
                    />
                  </div>
                </div>

                {/* Presets Rápidos de Ecran */}
                <div>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    Sugerencias rápidas de modelos de Ecran:
                  </span>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {ECRAN_PRESETS.map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, brand: p.brand, model: p.model, specs: p.specs }))}
                        className="btn-flat"
                        style={{ padding: '3px 8px', fontSize: '0.68rem', borderRadius: '6px' }}
                      >
                        {p.model}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dimensiones / Medidas y Ubicación */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Medidas / Dimensiones</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Ej: 100 pulgadas (2.0m x 1.5m), Formato 4:3"
                      value={formData.specs || ''}
                      onChange={(e) => setFormData({ ...formData, specs: e.target.value })}
                      style={{ height: '38px' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Ubicación / Sala *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Ej: Sala de Directorio, Auditorio Principal"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      style={{ height: '38px' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* CASO 2: PARLANTES / AUDIO (Código, Serie, Modelo, Tipo)         */}
          {/* ============================================================== */}
          {isSpeaker && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{
                backgroundColor: 'var(--bg-canvas-subtle)',
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid var(--border-acrylic)',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  <Volume2 size={16} color="#f97316" />
                  <span>Datos de Parlantes / Audio (Código, Serie y Modelo)</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                  {/* Código del Bien / Barras */}
                  <div className="form-group">
                    <label className="form-label">Código del Bien / Barras *</label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input
                        type="text"
                        required
                        className="form-input"
                        placeholder="Ej: PARLANTE-SALA-01 o PAT-4402"
                        value={formData.hostname}
                        onChange={(e) => setFormData({ ...formData, hostname: e.target.value.toUpperCase() })}
                        style={{ fontFamily: 'monospace', fontWeight: 700, flex: 1, height: '38px' }}
                      />
                      {onOpenFieldScanner && (
                        <button
                          type="button"
                          onClick={() => onOpenFieldScanner('hostname')}
                          className="btn-flat btn-primary"
                          style={{ padding: '0 12px', height: '38px', fontSize: '0.74rem', gap: '5px' }}
                          title="Escanear Código de Barras"
                        >
                          <Barcode size={15} />
                          <span>Escanear</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Número de Serie */}
                  <div className="form-group">
                    <label className="form-label">Número de Serie (S/N) *</label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input
                        type="text"
                        required
                        className="form-input"
                        placeholder="Serial de fábrica (ej. SN-219803)"
                        value={formData.serialNumber}
                        onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                        style={{ fontFamily: 'monospace', fontWeight: 700, flex: 1, height: '38px' }}
                      />
                      {onOpenFieldScanner && (
                        <button
                          type="button"
                          onClick={() => onOpenFieldScanner('serialNumber')}
                          className="btn-flat btn-primary"
                          style={{ padding: '0 12px', height: '38px', fontSize: '0.74rem', gap: '5px' }}
                          title="Escanear Número de Serie"
                        >
                          <Barcode size={15} />
                          <span>Escanear</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                  {/* Modelo */}
                  <div className="form-group">
                    <label className="form-label">Modelo del Parlante *</label>
                    <input
                      type="text"
                      required
                      className="form-input"
                      placeholder="Ej: Z207, Flip 6, Speak 510"
                      value={formData.model}
                      onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                      style={{ height: '38px' }}
                    />
                  </div>

                  {/* Marca */}
                  <div className="form-group">
                    <label className="form-label">Marca</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Ej: Logitech, JBL, Jabra, Sony"
                      value={formData.brand}
                      onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                      style={{ height: '38px' }}
                    />
                  </div>

                  {/* Estado */}
                  <div className="form-group">
                    <label className="form-label">Estado *</label>
                    <CustomSelect<DeviceStatus>
                      value={formData.status || 'instalado'}
                      onChange={(val) => setFormData({ ...formData, status: val })}
                      options={FORM_STATUS_OPTIONS}
                    />
                  </div>
                </div>

                {/* Presets Rápidos de Parlantes */}
                <div>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    Sugerencias frecuentes de modelos de parlantes:
                  </span>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {SPEAKER_PRESETS.map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, brand: p.brand, model: p.model, specs: p.specs }))}
                        className="btn-flat"
                        style={{ padding: '3px 8px', fontSize: '0.68rem', borderRadius: '6px' }}
                      >
                        {p.brand} {p.model}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Especificaciones / Conexión y Ubicación */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Tipo de Conexión / Características</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Ej: Bluetooth 5.0, USB, Jack 3.5mm, 10W"
                      value={formData.specs || ''}
                      onChange={(e) => setFormData({ ...formData, specs: e.target.value })}
                      style={{ height: '38px' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Ubicación / Asignación</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Ej: Sala de Reuniones 2, Puesto Mariana López"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      style={{ height: '38px' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* CASO 3: IMPRESORAS (Base de Datos Inteligente de Tintas/Tóner)  */}
          {/* ============================================================== */}
          {isPrinter && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{
                backgroundColor: 'var(--bg-canvas-subtle)',
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid var(--border-acrylic)',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    <Printer size={16} color="var(--accent-secondary)" />
                    <span>Impresora y Base de Datos de Tintas / Tóner</span>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Sparkles size={13} />
                    <span>Detección automática de suministros activa</span>
                  </span>
                </div>

                {/* BUSCADOR AUTOCOMPLETADO INTELIGENTE DE IMPRESORAS */}
                <div ref={printerDropdownRef} style={{ position: 'relative' }}>
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Modelo de Impresora (Escribe para auto-detectar tinta) *</span>
                    <span style={{ color: 'var(--accent-primary)', fontSize: '0.7rem' }}>
                      Catálogo con más de 40 modelos predefinidos
                    </span>
                  </label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="Ej: L3250, M404, 515, DCP-T520W, PIXMA G3110..."
                    value={formData.model}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData(prev => ({ ...prev, model: val }));
                      setPrinterSuggestions(searchPrinterCatalog(val));
                      setShowPrinterSuggestions(true);
                    }}
                    onFocus={() => {
                      setPrinterSuggestions(searchPrinterCatalog(formData.model || ''));
                      setShowPrinterSuggestions(true);
                    }}
                    style={{ height: '38px', fontWeight: 700 }}
                  />

                  {/* Dropdown flotante con sugerencias del catálogo */}
                  {showPrinterSuggestions && printerSuggestions.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      marginTop: '4px',
                      backgroundColor: 'var(--bg-canvas)',
                      border: '1px solid var(--border-acrylic-active)',
                      borderRadius: '10px',
                      boxShadow: '0 12px 30px rgba(0, 0, 0, 0.45)',
                      maxHeight: '260px',
                      overflowY: 'auto',
                      zIndex: 150
                    }}>
                      <div style={{ padding: '6px 10px', fontSize: '0.66rem', fontWeight: 800, color: 'var(--text-muted)', borderBottom: '1px solid var(--border-acrylic)' }}>
                        SELECCIONA PARA AUTO-COMPLETAR TINTA / TÓNER:
                      </div>
                      {printerSuggestions.map((item, idx) => (
                        <div
                          key={idx}
                          onClick={() => handleSelectPrinterCatalogItem(item)}
                          style={{
                            padding: '8px 12px',
                            cursor: 'pointer',
                            borderBottom: idx < printerSuggestions.length - 1 ? '1px solid var(--border-acrylic)' : 'none',
                            transition: 'background-color 0.15s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-canvas-subtle)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.82rem' }}>
                              {item.brand} {item.model}
                            </span>
                            <span style={{ fontSize: '0.66rem', color: 'var(--accent-secondary)', fontWeight: 700 }}>
                              {item.technology.split('(')[0].trim()}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#10b981', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Droplet size={11} />
                            <span>{item.supplies}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* CAMPO DESTACADO: TINTA / TÓNER COMPATIBLE */}
                <div style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', fontWeight: 800, color: '#10b981' }}>
                    <Droplet size={14} />
                    <span>Tinta / Tóner Compatible (Auto-rellenado desde base de datos)</span>
                  </div>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Suministro compatible oficial..."
                    value={formData.supplies || ''}
                    onChange={(e) => setFormData({ ...formData, supplies: e.target.value })}
                    style={{
                      height: '38px',
                      fontWeight: 700,
                      backgroundColor: 'var(--bg-canvas)',
                      color: 'var(--text-primary)'
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                  {/* Hostname / Identificador de Red */}
                  <div className="form-group">
                    <label className="form-label">Identificador / Hostname *</label>
                    <input
                      type="text"
                      required
                      className="form-input"
                      placeholder="Ej: IMP-RECEPCION-01"
                      value={formData.hostname}
                      onChange={(e) => setFormData({ ...formData, hostname: e.target.value.toUpperCase() })}
                      style={{ fontFamily: 'monospace', fontWeight: 700, height: '38px' }}
                    />
                  </div>

                  {/* Número de Serie con Escáner */}
                  <div className="form-group">
                    <label className="form-label">Número de Serie (S/N)</label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Serial de la impresora"
                        value={formData.serialNumber}
                        onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                        style={{ fontFamily: 'monospace', flex: 1, height: '38px' }}
                      />
                      {onOpenFieldScanner && (
                        <button
                          type="button"
                          onClick={() => onOpenFieldScanner('serialNumber')}
                          className="btn-flat"
                          style={{ padding: '0 10px', height: '38px' }}
                          title="Escanear Serial"
                        >
                          <Barcode size={15} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Marca */}
                  <div className="form-group">
                    <label className="form-label">Marca</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Epson, HP, Brother, Canon..."
                      value={formData.brand}
                      onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                      style={{ height: '38px' }}
                    />
                  </div>

                  {/* Estado */}
                  <div className="form-group">
                    <label className="form-label">Estado *</label>
                    <CustomSelect<DeviceStatus>
                      value={formData.status || 'instalado'}
                      onChange={(val) => setFormData({ ...formData, status: val })}
                      options={FORM_STATUS_OPTIONS}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                  {/* IP Address (Opcional para impresoras de red) */}
                  <div className="form-group">
                    <label className="form-label">Dirección IP de Red (si aplica)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Ej: 192.168.1.200 (o USB)"
                      value={formData.ipAddress}
                      onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                      style={{ fontFamily: 'monospace', height: '38px' }}
                    />
                  </div>

                  {/* Ubicación */}
                  <div className="form-group">
                    <label className="form-label">Ubicación / Área</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Ej: Pasillo Piso 2, Oficina Contabilidad"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      style={{ height: '38px' }}
                    />
                  </div>

                  {/* Usuario / Departamento */}
                  <div className="form-group">
                    <label className="form-label">Área / Asignado</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Ej: Finanzas / Uso Compartido"
                      value={formData.assignedUser}
                      onChange={(e) => setFormData({ ...formData, assignedUser: e.target.value })}
                      style={{ height: '38px' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* CASO 4: COMPUTADORAS (PC, Laptop, Servidor, Red, Monitor)      */}
          {/* ============================================================== */}
          {isComputer && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Sección Identificación */}
              <div style={{
                backgroundColor: 'var(--bg-canvas-subtle)',
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid var(--border-acrylic)',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  <Monitor size={16} color="var(--accent-primary)" />
                  <span>1. Identificación y Estado de Computador</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">Hostname del Equipo *</label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input
                        type="text"
                        required
                        className="form-input"
                        placeholder="Ej: PC-CONTAB-02, LAP-VENTAS-01"
                        value={formData.hostname}
                        onChange={(e) => setFormData({ ...formData, hostname: e.target.value })}
                        style={{ fontFamily: 'monospace', fontWeight: 700, flex: 1, height: '38px' }}
                      />
                      {onOpenFieldScanner && (
                        <button
                          type="button"
                          onClick={() => onOpenFieldScanner('hostname')}
                          className="btn-flat btn-primary"
                          style={{ padding: '0 12px', height: '38px', fontSize: '0.74rem', gap: '5px' }}
                        >
                          <Barcode size={15} />
                          <span>Escanear</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Estado *</label>
                    <CustomSelect<DeviceStatus>
                      value={formData.status || 'instalado'}
                      onChange={(val) => setFormData({ ...formData, status: val })}
                      options={FORM_STATUS_OPTIONS}
                    />
                  </div>
                </div>
              </div>

              {/* Sección Serial, Placa y Hardware */}
              <div style={{
                backgroundColor: 'var(--bg-canvas-subtle)',
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid var(--border-acrylic)',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  <Tag size={16} color="var(--accent-cyan)" />
                  <span>2. Serial, Placa Base y Marca</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">Número de Serie (S/N) *</label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Serial chasis"
                        value={formData.serialNumber}
                        onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                        style={{ fontFamily: 'monospace', fontWeight: 700, flex: 1, height: '38px' }}
                      />
                      {onOpenFieldScanner && (
                        <button
                          type="button"
                          onClick={() => onOpenFieldScanner('serialNumber')}
                          className="btn-flat btn-primary"
                          style={{ padding: '0 12px', height: '38px' }}
                        >
                          <Barcode size={15} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Placa Madre (Motherboard)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="HP 832A, Intel B660..."
                      value={formData.motherboard || ''}
                      onChange={(e) => setFormData({ ...formData, motherboard: e.target.value })}
                      style={{ height: '38px' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Marca y Modelo</label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Marca (Dell, Lenovo, HP)"
                        value={formData.brand}
                        onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                        style={{ height: '38px', flex: 1 }}
                      />
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Modelo (OptiPlex, ThinkPad)"
                        value={formData.model}
                        onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                        style={{ height: '38px', flex: 1 }}
                      />
                    </div>
                  </div>
                </div>

                {/* Especificaciones de Computación */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">Sistema Operativo</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.os}
                      onChange={(e) => setFormData({ ...formData, os: e.target.value })}
                      style={{ height: '38px' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Procesador (CPU)</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.cpu}
                      onChange={(e) => setFormData({ ...formData, cpu: e.target.value })}
                      style={{ height: '38px' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Memoria RAM</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.ram}
                      onChange={(e) => setFormData({ ...formData, ram: e.target.value })}
                      style={{ height: '38px' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Almacenamiento (Disco)</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.storage}
                      onChange={(e) => setFormData({ ...formData, storage: e.target.value })}
                      style={{ height: '38px' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">Dirección IP</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="192.168.1.X"
                      value={formData.ipAddress}
                      onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                      style={{ fontFamily: 'monospace', height: '38px' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Dirección MAC</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="00:1A:2B:3C:4D:5E"
                      value={formData.macAddress}
                      onChange={(e) => setFormData({ ...formData, macAddress: e.target.value })}
                      style={{ fontFamily: 'monospace', height: '38px' }}
                    />
                  </div>
                </div>
              </div>

              {/* Asignación y Ubicación */}
              <div style={{
                backgroundColor: 'var(--bg-canvas-subtle)',
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid var(--border-acrylic)',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  <UserCheck size={16} color="var(--accent-secondary)" />
                  <span>3. Asignación y Ubicación</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">Usuario Asignado</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Ej: Carlos Méndez"
                      value={formData.assignedUser}
                      onChange={(e) => setFormData({ ...formData, assignedUser: e.target.value })}
                      style={{ height: '38px' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Departamento</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Ej: Contabilidad, TI"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      style={{ height: '38px' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Ubicación Física</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Ej: Piso 2, Oficina 205"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      style={{ height: '38px' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* CASO 5: MONITOR O RED                                          */}
          {/* ============================================================== */}
          {(isMonitor || isNetwork || currentType === 'other') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{
                backgroundColor: 'var(--bg-canvas-subtle)',
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid var(--border-acrylic)',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {isMonitor ? <Tv size={16} color="#06b6d4" /> : <Network size={16} color="var(--accent-rose)" />}
                  <span>Datos del Equipo</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">Identificador / Hostname *</label>
                    <input
                      type="text"
                      required
                      className="form-input"
                      placeholder={isMonitor ? 'Ej: MON-RECEPCION-01' : 'Ej: SW-CORE-01'}
                      value={formData.hostname}
                      onChange={(e) => setFormData({ ...formData, hostname: e.target.value.toUpperCase() })}
                      style={{ fontFamily: 'monospace', fontWeight: 700, height: '38px' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Número de Serie (S/N)</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.serialNumber}
                      onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                      style={{ fontFamily: 'monospace', height: '38px' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Marca y Modelo</label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Marca"
                        value={formData.brand}
                        onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                        style={{ height: '38px', flex: 1 }}
                      />
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Modelo"
                        value={formData.model}
                        onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                        style={{ height: '38px', flex: 1 }}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Estado *</label>
                    <CustomSelect<DeviceStatus>
                      value={formData.status || 'instalado'}
                      onChange={(val) => setFormData({ ...formData, status: val })}
                      options={FORM_STATUS_OPTIONS}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">{isMonitor ? 'Pulgadas y Conectores' : 'Características / Puertos'}</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder={isMonitor ? 'Ej: 24 pulgadas IPS, HDMI/DP' : 'Ej: Switch 24 puertos Gigabit PoE'}
                      value={formData.specs || ''}
                      onChange={(e) => setFormData({ ...formData, specs: e.target.value })}
                      style={{ height: '38px' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Ubicación y Asignado</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Ej: Rack Piso 1 / Oficina Central"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      style={{ height: '38px' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Botones de Acción Inferiores */}
          <div 
            className="audit-modal-footer"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px',
              paddingTop: '8px',
              borderTop: '1px solid var(--border-acrylic)',
              marginTop: 'auto'
            }}
          >
            <button
              type="button"
              onClick={requestClose}
              disabled={loading}
              className="btn-flat"
              style={{ padding: '8px 18px', fontSize: '0.82rem' }}
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={loading}
              className="btn-flat btn-primary"
              style={{
                padding: '8px 24px',
                fontSize: '0.82rem',
                gap: '8px',
                fontWeight: 800,
                boxShadow: '0 4px 16px var(--accent-glow)'
              }}
            >
              <Save size={16} />
              <span>{loading ? 'Guardando...' : 'Guardar en Inventario'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
