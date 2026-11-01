import React, { useEffect, useState, useRef } from 'react';
import { X, AlertCircle, Search, Barcode } from 'lucide-react';
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
  const [manualCode, setManualCode] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const stopScanner = React.useCallback(() => {
    if (scannerRef.current) {
      try {
        scannerRef.current.stop().then(() => {
          scannerRef.current?.clear();
          scannerRef.current = null;
        }).catch(() => {});
      } catch {
        // Ignore
      }
    }
  }, []);

  const handleCodeScanned = React.useCallback((code: string) => {
    const clean = code.trim();
    stopScanner();

    // If custom scan callback provided (e.g. search bar or manual audit form field)
    if (onCustomScan) {
      onCustomScan(clean);
      onClose();
      return;
    }

    // Default flow: Match existing device or create new
    const matched = devices.find(d => 
      d.serialNumber.toLowerCase() === clean.toLowerCase() ||
      d.hostname.toLowerCase() === clean.toLowerCase() ||
      d.qrCodeData?.toLowerCase().includes(clean.toLowerCase()) ||
      clean.toLowerCase().includes(d.hostname.toLowerCase()) ||
      clean.toLowerCase().includes(d.serialNumber.toLowerCase())
    );

    if (matched) {
      onDeviceFound(matched);
      onClose();
    } else {
      onNewCodeScanned(clean);
      onClose();
    }
  }, [devices, onClose, onCustomScan, onDeviceFound, onNewCodeScanned, stopScanner]);

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      return;
    }

    let html5QrCode: Html5Qrcode | null = null;
    const scannerElementId = 'tay-qr-reader';

    const startCamera = async () => {
      try {
        setCameraError(null);
        html5QrCode = new Html5Qrcode(scannerElementId);
        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 15,
            qrbox: { width: 260, height: 260 },
            aspectRatio: 1.0
          },
          (decodedText) => {
            handleCodeScanned(decodedText);
          },
          () => {}
        );
      } catch (err: any) {
        console.warn('Camera error:', err);
        setCameraError(
          'No se pudo activar la cámara directamente (o permiso denegado). Puedes ingresar el código o número de serie manualmente abajo.'
        );
      }
    };

    const timeout = setTimeout(startCamera, 250);

    return () => {
      clearTimeout(timeout);
      stopScanner();
    };
  }, [isOpen, handleCodeScanned, stopScanner]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleCodeScanned(manualCode);
  };

  if (!isOpen) return null;

  return (
    <div 
      className="modal-backdrop-acrylic"
      style={{ zIndex: 10000, padding: '12px' }}
    >
      <div className="modal-window-acrylic" style={{
        width: '100%',
        maxWidth: '480px',
        maxHeight: '94vh',
        overflowY: 'auto',
        padding: '22px 20px',
        borderRadius: '26px 8px 26px 8px',
        border: '1.5px solid var(--accent-primary)',
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.45)',
        position: 'relative',
        animation: 'none'
      }}>
        {/* Prominent Close Button */}
        <button
          type="button"
          onClick={onClose}
          title="Cerrar escáner"
          aria-label="Cerrar escáner"
          className="modal-close-btn"
          style={{
            position: 'absolute',
            top: '14px',
            right: '14px',
            zIndex: 20
          }}
        >
          <X size={18} strokeWidth={2.4} />
        </button>

        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          {/* 100% Flat Icon (No gradient, no 3D sheen) */}
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
            Apunta la cámara del celular o laptop al código de barras o número de serie del equipo
          </p>
        </div>

        {/* Video / Camera Scanner Viewport */}
        <div style={{
          position: 'relative',
          width: '100%',
          minHeight: '250px',
          borderRadius: '14px 6px 14px 6px',
          overflow: 'hidden',
          backgroundColor: '#050811',
          border: '1px solid var(--border-acrylic)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px'
        }}>
          <div id="tay-qr-reader" style={{ width: '100%' }} />

          {cameraError && (
            <div style={{
              padding: '24px',
              textAlign: 'center',
              color: '#94a3b8',
              fontSize: '0.82rem'
            }}>
              <AlertCircle size={32} color="#f59e0b" style={{ margin: '0 auto 8px' }} />
              <div>{cameraError}</div>
            </div>
          )}
        </div>

        {/* Manual Code Input Form */}
        <form onSubmit={handleManualSubmit}>
          <div className="form-label" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>O ingresa el Código / Serial manualmente:</span>
            <span style={{ color: 'var(--accent-primary)', fontSize: '0.74rem', fontWeight: 800 }}>Ingreso Manual</span>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Ej: LNV-M70Q-9912 o PC-CONTAB-01"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              style={{ flex: 1, fontFamily: 'monospace' }}
            />
            <button type="submit" className="btn-flat btn-primary" style={{ padding: '0 16px', gap: '6px' }}>
              <Search size={14} />
              <span>Aplicar</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
