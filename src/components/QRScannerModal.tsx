import React, { useEffect, useState, useRef, useCallback } from 'react';
import { X, AlertCircle, Barcode, Camera, Loader2, RefreshCw } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import type { Device } from '../types';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  devices: Device[];
  onDeviceFound: (device: Device) => void;
  onNewCodeScanned: (code: string) => void;
  customTitle?: string;
  onCustomScan?: (scannedCode: string) => void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  isOpen,
  onClose,
  devices,
  onDeviceFound,
  onNewCodeScanned,
  customTitle,
  onCustomScan
}) => {
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraStarting, setIsCameraStarting] = useState(true);
  const [activeCameraLabel, setActiveCameraLabel] = useState<string>('Iniciando lente de la cámara...');
  const [isClosing, setIsClosing] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isCancelledRef = useRef<boolean>(false);
  const isStartingRef = useRef<boolean>(false);
  const isClosingRef = useRef<boolean>(false);

  // Refs de props para garantizar estabilidad total y evitar reinicios del hardware de la cámara por re-renders externos
  const devicesRef = useRef(devices);
  const onDeviceFoundRef = useRef(onDeviceFound);
  const onNewCodeScannedRef = useRef(onNewCodeScanned);
  const onCustomScanRef = useRef(onCustomScan);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    devicesRef.current = devices;
    onDeviceFoundRef.current = onDeviceFound;
    onNewCodeScannedRef.current = onNewCodeScanned;
    onCustomScanRef.current = onCustomScan;
    onCloseRef.current = onClose;
  });

  // Detención segura del escáner liberando hardware y evitando excepciones si aún no ha iniciado
  const stopScanner = useCallback(async () => {
    isCancelledRef.current = true;

    // Liberar directamente los tracks de medios de video en el DOM
    try {
      const videoElem = document.querySelector('#tay-qr-reader video') as HTMLVideoElement | null;
      if (videoElem && videoElem.srcObject) {
        const stream = videoElem.srcObject as MediaStream;
        stream.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {}
        });
        videoElem.srcObject = null;
      }
    } catch {}

    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
      } catch (err) {
        // Ignorar excepciones al detener un escáner en transición o ya detenido
      }

      try {
        scannerRef.current.clear();
      } catch {}

      scannerRef.current = null;
    }
  }, []);

  // Cierre suave del modal con animación fluida
  const handleClose = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    setIsClosing(true);
    isCancelledRef.current = true;
    stopScanner();
    setTimeout(() => {
      isClosingRef.current = false;
      setIsClosing(false);
      onCloseRef.current();
    }, 200);
  }, [stopScanner]);

  const handleCodeScanned = useCallback((code: string) => {
    const clean = code.trim();
    if (!clean) return;

    handleClose();

    // Si se especificó callback personalizado
    if (onCustomScanRef.current) {
      onCustomScanRef.current(clean);
      return;
    }

    const currentDevices = devicesRef.current;

    // Flujo general de auditoría: vincular activo existente de forma 100% precisa
    let parsed: any = null;
    try {
      if (clean.startsWith('{') && clean.endsWith('}')) {
        parsed = JSON.parse(clean);
      }
    } catch {}

    let matched: any = null;

    // 1. Si es QR estructurado con ID único o tag de activo
    if (parsed) {
      if (parsed.id) {
        matched = currentDevices.find(d => d.id === parsed.id || d.id.toLowerCase() === String(parsed.id).toLowerCase());
      }
      if (!matched && parsed.tag) {
        matched = currentDevices.find(d => d.qrCodeData === parsed.tag || d.qrCodeData?.toLowerCase() === String(parsed.tag).toLowerCase());
      }
      if (!matched && parsed.hostname) {
        matched = currentDevices.find(d => d.hostname.toLowerCase() === String(parsed.hostname).toLowerCase());
      }
    }

    // 2. Coincidencia exacta por ID de dispositivo (dev-xxxx)
    if (!matched) {
      matched = currentDevices.find(d => d.id.toLowerCase() === clean.toLowerCase() || `dev-${d.id.toLowerCase()}` === clean.toLowerCase());
    }

    // 3. Coincidencia exacta por Código de Etiqueta / QR registrado
    if (!matched) {
      matched = currentDevices.find(d => d.qrCodeData && d.qrCodeData.toLowerCase() === clean.toLowerCase());
    }

    // 4. Coincidencia exacta por Hostname (nombre corporativo único)
    if (!matched) {
      matched = currentDevices.find(d => d.hostname.toLowerCase() === clean.toLowerCase());
    }

    // 5. Coincidencia por Número de Serie (excluyendo genéricos/vacíos/repetidos)
    if (!matched) {
      const isGenericSerial = ['n/a', 'na', 'none', 'sn', 's/n', 'sn-auto', 'sn-desconocido', 'sn-stivie', '0', ''].includes(clean.toLowerCase());
      if (!isGenericSerial) {
        matched = currentDevices.find(d => 
          d.serialNumber && 
          !['n/a', 'na', 'none', 'sn', 's/n', 'sn-auto', 'sn-desconocido', 'sn-stivie'].includes(d.serialNumber.toLowerCase()) &&
          d.serialNumber.toLowerCase() === clean.toLowerCase()
        );
      }
    }

    // 6. Si el string escaneado contiene explícitamente el ID único del dispositivo
    if (!matched) {
      matched = currentDevices.find(d => clean.toLowerCase().includes(d.id.toLowerCase()));
    }

    // 7. Si el string escaneado contiene la etiqueta de activo única
    if (!matched) {
      matched = currentDevices.find(d => d.qrCodeData && d.qrCodeData.length >= 6 && clean.toLowerCase().includes(d.qrCodeData.toLowerCase()));
    }

    if (matched) {
      onDeviceFoundRef.current(matched);
    } else {
      onNewCodeScannedRef.current(clean);
    }
  }, [handleClose]);

  const startCamera = useCallback(async () => {
    // Si la cámara ya está activa o en proceso de inicio, mantenerla sin reiniciar
    if (scannerRef.current?.isScanning || isStartingRef.current) return;

    try {
      isCancelledRef.current = false;
      isStartingRef.current = true;
      setIsCameraStarting(true);
      setCameraError(null);
      setActiveCameraLabel('Iniciando lente trasero...');

      // Limpieza preventiva de instancias previas
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            await scannerRef.current.stop();
          }
          scannerRef.current.clear();
        } catch {}
        scannerRef.current = null;
      }

      const scannerElementId = 'tay-qr-reader';
      const container = document.getElementById(scannerElementId);
      if (!container) return;

      const html5QrCode = new Html5Qrcode(scannerElementId);
      scannerRef.current = html5QrCode;

      const qrConfig = {
        fps: 15,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const qrboxEdgeSize = Math.floor(minEdge * 0.72);
          return {
            width: Math.max(qrboxEdgeSize, 180),
            height: Math.max(qrboxEdgeSize, 180)
          };
        },
        aspectRatio: 1.0
      };

      let started = false;

      // Intento 1: Cámara trasera (ideal para teléfonos móviles)
      try {
        await html5QrCode.start(
          { facingMode: 'environment' },
          qrConfig,
          (decodedText) => handleCodeScanned(decodedText),
          () => {}
        );
        started = true;
      } catch (errEnv) {
        console.warn('Lente trasero no disponible o bloqueado, intentando cámara general:', errEnv);
        setActiveCameraLabel('Intentando cámara general...');

        if (!isCancelledRef.current) {
          // Intento 2: Cualquier cámara disponible (frontal o predeterminada)
          await html5QrCode.start(
            { facingMode: 'user' },
            qrConfig,
            (decodedText) => handleCodeScanned(decodedText),
            () => {}
          );
          started = true;
        }
      }

      // Si el usuario presionó cerrar mientras la cámara se inicializaba, cancelar limpiamente
      if (isCancelledRef.current) {
        if (started && html5QrCode.isScanning) {
          await html5QrCode.stop();
        }
        try { html5QrCode.clear(); } catch {}
        scannerRef.current = null;
        return;
      }

      setIsCameraStarting(false);
    } catch (err: any) {
      if (isCancelledRef.current) return;
      console.warn('Error al activar cámara:', err);
      setIsCameraStarting(false);
      setCameraError(
        'No se pudo activar la cámara directamente (posible permiso denegado o conexión no segura).'
      );
    } finally {
      isStartingRef.current = false;
    }
  }, [handleCodeScanned]);

  // Ciclo de vida estricto: iniciar cámara una sola vez al abrir el modal, y liberarla al cerrar
  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      return;
    }

    isCancelledRef.current = false;
    isClosingRef.current = false;
    setIsClosing(false);

    const timeout = setTimeout(() => {
      startCamera();
    }, 120);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timeout);
      window.removeEventListener('keydown', handleKeyDown);
      stopScanner();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      className={`modal-backdrop-acrylic ${isClosing ? 'closing' : ''}`}
      style={{ zIndex: 10000, padding: '12px' }}
      onClick={(e) => {
        // Cerrar al tocar fuera de la ventana del modal
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div className={`modal-window-acrylic ${isClosing ? 'closing' : ''}`} style={{
        width: '100%',
        maxWidth: '480px',
        maxHeight: 'min(92dvh, 750px)',
        overflowY: 'auto',
        padding: '22px 20px',
        borderRadius: '26px 8px 26px 8px',
        border: '1.5px solid var(--accent-primary)',
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.45)',
        position: 'relative'
      }}>
        {/* Botón Cerrar Superior Derecho (Área táctil optimizada para móviles) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleClose();
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleClose();
          }}
          title="Cerrar escáner"
          aria-label="Cerrar escáner"
          className="modal-close-btn"
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            zIndex: 100,
            width: '42px',
            height: '42px',
            minWidth: '42px',
            minHeight: '42px',
            touchAction: 'manipulation'
          }}
        >
          <X size={20} strokeWidth={2.4} />
        </button>

        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          {/* Icono de Escáner */}
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: 'var(--accent-primary)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '8px',
            boxShadow: 'none'
          }}>
            <Barcode size={24} color="var(--accent-contrast, #000000)" strokeWidth={2.4} />
          </div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>
            {customTitle || 'Escanear Código / QR'}
          </h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
            Apunta la cámara del celular al código de barras o número de serie del equipo
          </p>
        </div>

        {/* Visor de Cámara con Estado de Carga Elegante (Sin Pantalla Negra) */}
        <div style={{
          position: 'relative',
          width: '100%',
          minHeight: '260px',
          borderRadius: '16px',
          overflow: 'hidden',
          backgroundColor: '#0a0f1d',
          border: '1.5px solid var(--border-acrylic)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '0'
        }}>
          {/* Contenedor del escáner HTML5 */}
          <div id="tay-qr-reader" style={{ width: '100%' }} />

          {/* Overlay de Carga Visual: Se muestra mientras la cámara se activa */}
          {isCameraStarting && !cameraError && (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(180deg, #0b1120 0%, #030712 100%)',
              padding: '24px 16px',
              textAlign: 'center',
              zIndex: 10,
              gap: '12px'
            }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '18px',
                background: 'rgba(56, 189, 248, 0.08)',
                border: '1.5px solid var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 24px rgba(56, 189, 248, 0.2)'
              }}>
                <Camera size={30} color="var(--accent-primary)" strokeWidth={2.2} />
              </div>

              <div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontSize: '0.92rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  marginBottom: '4px'
                }}>
                  <Loader2 size={16} className="spin-fast" />
                  <span>{activeCameraLabel}</span>
                </div>
                <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: 0, maxWidth: '280px' }}>
                  Si tu navegador solicita permiso de cámara, pulsa <strong>"Permitir"</strong>
                </p>
              </div>
            </div>
          )}

          {/* Estado de Error con Botón para Reintentar */}
          {cameraError && (
            <div style={{
              position: 'absolute',
              inset: 0,
              padding: '24px 18px',
              textAlign: 'center',
              color: '#cbd5e1',
              fontSize: '0.82rem',
              background: 'linear-gradient(180deg, #0b1120 0%, #030712 100%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              zIndex: 10
            }}>
              <AlertCircle size={36} color="#f59e0b" />
              <div style={{ maxWidth: '300px', lineHeight: 1.45 }}>{cameraError}</div>
              <button
                type="button"
                onClick={startCamera}
                className="btn-flat"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  borderRadius: '8px',
                  border: '1px solid var(--border-acrylic)',
                  background: 'var(--bg-canvas)',
                  cursor: 'pointer'
                }}
              >
                <RefreshCw size={14} />
                <span>Reintentar cámara</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
