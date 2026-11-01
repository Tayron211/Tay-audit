import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Terminal,
  Download,
  Copy,
  Check,
  Bot,
  ShieldCheck,
  Globe,
  Wifi
} from 'lucide-react';
import type { Device, SystemStats, AuditLog, SupportTicket, StivieKnowledge } from './types';
import { api, API_BASE, CLOUD_DEFAULT_URL } from './services/api';
import { Navbar, type NavTab } from './components/Navbar';
import { DeviceModal } from './components/DeviceModal';
import { QRScannerModal } from './components/QRScannerModal';
import { AuditFormModal } from './components/AuditFormModal';
import { AuditSection } from './components/AuditSection';
import { SupportSection } from './components/SupportSection';
import { StivieClientApp } from './components/StivieClientApp';
import { SplashScreen } from './components/SplashScreen';
import { DeveloperFooter } from './components/DeveloperFooter';
import { computeIntelligentContrast } from './utils/theme';

const VALID_TABS: NavTab[] = ['audit', 'dashboard', 'inventory', 'support', 'agent'];

const getInitialTab = (): NavTab => {
  if (typeof window === 'undefined') return 'audit';
  const params = new URLSearchParams(window.location.search);
  const tabFromUrl = params.get('tab') as NavTab;
  if (VALID_TABS.includes(tabFromUrl)) return tabFromUrl;

  const saved = localStorage.getItem('tay_audit_active_tab') as NavTab;
  if (VALID_TABS.includes(saved)) return saved;

  return 'audit';
};

const MainApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>(() => getInitialTab());
  const [devices, setDevices] = useState<Device[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [knowledgeList, setKnowledgeList] = useState<StivieKnowledge[]>([]);
  const [stats, setStats] = useState<SystemStats>({
    totalDevices: 0,
    onlineCount: 0,
    pcCount: 0,
    laptopCount: 0,
    serverCount: 0,
    printerCount: 0,
    networkCount: 0,
    otherCount: 0,
    recentlyAudited: 0,
  });

  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [isAppLoading, setIsAppLoading] = useState(true);

  // Modals
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [deviceModalInitialEdit, setDeviceModalInitialEdit] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerCustomTitle, setScannerCustomTitle] = useState<string | undefined>(undefined);
  const [scannerCustomCallback, setScannerCustomCallback] = useState<((code: string) => void) | undefined>(undefined);

  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [scannedCodePrefill, setScannedCodePrefill] = useState<string | undefined>(undefined);
  const [copiedPs, setCopiedPs] = useState(false);

  // Active color theme & Dark/Light mode state (Default: UPN Oro Lúcuma Institucional)
  const [currentTheme, setCurrentTheme] = useState<string>(() => {
    const saved = localStorage.getItem('tay_audit_theme');
    if (!saved || saved === 'violet') {
      localStorage.setItem('tay_audit_theme', 'upn');
      return 'upn';
    }
    return saved;
  });

  const [customColor, setCustomColor] = useState<string>(() => {
    return localStorage.getItem('tay_audit_custom_color') || '#ffb800';
  });

  const [colorMode, setColorMode] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('tay_audit_colormode') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', currentTheme);
    document.documentElement.setAttribute('data-mode', colorMode);
    localStorage.setItem('tay_audit_theme', currentTheme);
    localStorage.setItem('tay_audit_colormode', colorMode);

    // Contraste dinámico e inteligente según luminancia del tema (Negro #000000 sobre amarillo/ámbar, Blanco #ffffff sobre colores oscuros)
    const contrastColor = computeIntelligentContrast(currentTheme, customColor);
    document.documentElement.style.setProperty('--accent-contrast', contrastColor);

    if (currentTheme === 'custom' && customColor) {
      document.documentElement.style.setProperty('--accent-primary', customColor);
      document.documentElement.style.setProperty('--accent-secondary', customColor);
      let glow = `${customColor}55`;
      try {
        let c = customColor.replace('#', '');
        if (c.length === 3) c = c.split('').map(x => x + x).join('');
        if (c.length === 6) {
          const num = parseInt(c, 16);
          const r = (num >> 16) & 255;
          const g = (num >> 8) & 255;
          const b = num & 255;
          glow = `rgba(${r}, ${g}, ${b}, 0.35)`;
        }
      } catch {}
      document.documentElement.style.setProperty('--accent-glow', glow);
      document.documentElement.style.setProperty('--border-acrylic-active', customColor);
      localStorage.setItem('tay_audit_custom_color', customColor);
    } else {
      document.documentElement.style.removeProperty('--accent-primary');
      document.documentElement.style.removeProperty('--accent-secondary');
      document.documentElement.style.removeProperty('--accent-glow');
      document.documentElement.style.removeProperty('--border-acrylic-active');
    }
  }, [currentTheme, colorMode, customColor]);

  // Asegura que al recargar la página o cambiar de pestaña siempre aparezca desde arriba
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if ('scrollRestoration' in window.history) {
        window.history.scrollRestoration = 'manual';
      }
      window.scrollTo(0, 0);
    }
  }, [activeTab]);

  useEffect(() => {
    if (!isAppLoading) {
      window.scrollTo(0, 0);
    }
  }, [isAppLoading]);

  // Load all data
  const loadData = async () => {
    try {
      const [fetchedDevices, fetchedStats, fetchedLogs, fetchedTickets, fetchedKnowledge] = await Promise.all([
        api.getDevices(),
        api.getStats(),
        api.getLogs(),
        api.getTickets().catch(() => []),
        api.getStivieKnowledge().catch(() => [])
      ]);
      setDevices(fetchedDevices);
      setStats(fetchedStats);
      setLogs(fetchedLogs);
      setTickets(fetchedTickets);
      setKnowledgeList(fetchedKnowledge);

      // Sincronizar el equipo seleccionado si el modal está abierto en tiempo real
      setSelectedDevice(prev => {
        if (!prev) return null;
        const fresh = fetchedDevices.find(d => d.id === prev.id);
        return fresh || prev;
      });
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setIsAppLoading(false);
    }
  };

  const openTicketsCount = useMemo(() => {
    return tickets.filter(t => t.status !== 'resuelto').length;
  }, [tickets]);

  const lastSyncVersionRef = useRef<string | null>(null);
  const lastFullLoadTsRef = useRef<number>(0);

  useEffect(() => {
    let isMounted = true;
    loadData().then(() => {
      lastFullLoadTsRef.current = Date.now();
    });

    const checkCloudSync = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      try {
        const sync = await api.getSyncState();
        if (!isMounted) return;
        setIsLiveConnected(true);
        const now = Date.now();
        if (lastSyncVersionRef.current === null) {
          lastSyncVersionRef.current = sync.version;
        } else if (sync.version !== lastSyncVersionRef.current || now - lastFullLoadTsRef.current > 12000) {
          lastSyncVersionRef.current = sync.version;
          lastFullLoadTsRef.current = now;
          loadData();
        }
      } catch {
        if (isMounted) setIsLiveConnected(false);
      }
    };

    checkCloudSync();
    const syncTimer = setInterval(checkCloudSync, 3000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkCloudSync();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Optional instant SSE push when using local Express backend (?local=1)
    let eventSource: EventSource | null = null;
    if (!API_BASE.startsWith('https://')) {
      try {
        eventSource = new EventSource(`${API_BASE}/api/events`);
        eventSource.onopen = () => {
          if (isMounted) setIsLiveConnected(true);
        };
        eventSource.onmessage = () => {
          lastFullLoadTsRef.current = Date.now();
          loadData();
        };
      } catch {
        // Fallback handled by checkCloudSync
      }
    }

    return () => {
      isMounted = false;
      clearInterval(syncTimer);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (eventSource) eventSource.close();
    };
  }, []);

  // General scanner open
  const handleOpenGeneralScanner = () => {
    setScannerCustomTitle('Escáner de Activos (QR / Código de Barras)');
    setScannerCustomCallback(undefined);
    setIsScannerOpen(true);
  };

  // Form field scanner open
  const handleOpenFieldScanner = (field: 'hostname' | 'serialNumber') => {
    setScannerCustomTitle(`Escanear ${field === 'hostname' ? 'Hostname' : 'Número de Serie (S/N)'}`);
    setScannerCustomCallback(() => (code: string) => {
      setScannedCodePrefill(code);
    });
    setIsScannerOpen(true);
  };

  // Disparador para resetear vista a inicio al hacer clic en el botón de marca/logo
  const [resetViewTrigger, setResetViewTrigger] = useState(0);

  // Acción de Ir al Inicio: regresa a la pestaña principal (audit), resetea a dashboard y hace scroll suave al tope
  const handleGoHome = () => {
    setActiveTab('audit');
    setResetViewTrigger(prev => prev + 1);
    localStorage.setItem('tay_audit_active_tab', 'audit');
    localStorage.setItem('tay_audit_audit_view', 'dashboard');
    const params = new URLSearchParams(window.location.search);
    params.set('tab', 'audit');
    params.set('view', 'dashboard');
    params.delete('subtab');
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({ path: newUrl }, '', newUrl);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleExportExcel = () => {
    window.open(api.getInventoryExcelDownloadUrl(), '_blank');
  };

  // Sincronizar activeTab con la URL para navegación del navegador (atrás/adelante)
  useEffect(() => {
    const handlePopState = () => {
      setActiveTab(getInitialTab());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Sincronizar URL y localStorage cuando cambia activeTab (mantiene la misma pestaña al recargar)
  useEffect(() => {
    localStorage.setItem('tay_audit_active_tab', activeTab);
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') !== activeTab) {
      params.set('tab', activeTab);
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState({ path: newUrl }, '', newUrl);
    }
  }, [activeTab]);

  // Detección de swipe para navegar entre pestañas en móvil
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    setTouchStartX(e.touches[0].clientX);
    setTouchStartY(e.touches[0].clientY);
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartX === null || touchStartY === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const diffX = touchEndX - touchStartX;
    const diffY = touchEndY - touchStartY;

    // Solo considerar swipe horizontal si es más pronunciado que vertical
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
      const currentIndex = VALID_TABS.indexOf(activeTab);
      if (diffX > 0 && currentIndex > 0) {
        // Swipe derecha -> pestaña anterior
        setActiveTab(VALID_TABS[currentIndex - 1]);
      } else if (diffX < 0 && currentIndex < VALID_TABS.length - 1) {
        // Swipe izquierda -> pestaña siguiente
        setActiveTab(VALID_TABS[currentIndex + 1]);
      }
    }
    setTouchStartX(null);
    setTouchStartY(null);
  };

  // Server network discovery & remote host configuration (Cloud 24/7 or custom)
  const [serverInfo, setServerInfo] = useState<{
    primaryIp?: string;
    primaryUrl?: string;
    ips?: Array<{ address: string; name: string }>;
    hostname?: string;
    isCloud?: boolean;
  }>({});

  const [customServerHost, setCustomServerHost] = useState<string>(() => {
    return localStorage.getItem('tay_audit_custom_server_host') || '';
  });

  useEffect(() => {
    api.getServerInfo()
      .then(info => setServerInfo(info))
      .catch(() => {});
  }, []);

  const effectiveServerUrl = useMemo(() => {
    if (customServerHost && customServerHost.trim()) {
      let host = customServerHost.trim();
      if (!host.startsWith('http://') && !host.startsWith('https://')) {
        const isIpOrLocal = /^(\d{1,3}\.){3}\d{1,3}(:\d+)?$/.test(host) || host.startsWith('localhost');
        host = `${isIpOrLocal ? 'http' : 'https'}://${host}`;
      }
      return host.replace(/\/+$/, '');
    }
    if (serverInfo?.primaryUrl) {
      return serverInfo.primaryUrl.replace(/\/+$/, '');
    }
    if (typeof window !== 'undefined') {
      if (window.location.protocol === 'https:' || window.location.hostname.endsWith('.pages.dev')) {
        return window.location.origin;
      }
      if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        return API_BASE;
      }
    }
    return API_BASE || CLOUD_DEFAULT_URL;
  }, [customServerHost, serverInfo]);

  const psOneLiner = effectiveServerUrl.startsWith('https://')
    ? `[Net.ServicePointManager]::SecurityProtocol = 3072; irm ${effectiveServerUrl}/audit | iex`
    : `irm ${effectiveServerUrl}/audit | iex`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPs(true);
    setTimeout(() => setCopiedPs(false), 2000);
  };

  const handleDownloadBatch = () => {
    const batchContent = `@echo off
title Tay-Audit - Agente de Levantamiento de Inventario
cls
echo ====================================================================
echo                   TAY-AUDIT: RECOLECTOR AUTOMATICO
echo ====================================================================
echo Conectando con servidor central: ${effectiveServerUrl}
echo.
echo Extrayendo especificaciones completas de hardware...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = 3072; irm ${effectiveServerUrl}/audit | iex"
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Se produjo un error durante el levantamiento.
    pause
    exit /b %ERRORLEVEL%
)
echo.
echo Levantamiento finalizado con exito. Cerrando ventana en 2 segundos...
timeout /t 2 /nobreak >nul 2>&1
exit
`;
    const blob = new Blob([batchContent], { type: 'application/bat' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tay-audit-agent.bat';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadStivieInstaller = () => {
    window.open(`${effectiveServerUrl}/api/stivie/download?server=${encodeURIComponent(effectiveServerUrl)}`, '_blank');
  };

  return (
    <div
      className="main-app-outer-wrapper"
      style={{
        minHeight: '100dvh',
        width: '100%',
        maxWidth: '100vw',
        overflowX: 'hidden',
        padding: '0 16px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        touchAction: 'pan-y',
        boxSizing: 'border-box',
        flex: 1
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div 
        className="main-app-inner-wrapper"
        style={{
          width: '100%',
          maxWidth: '1280px',
          minWidth: 0,
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          boxSizing: 'border-box'
        }}>
        {/* Top Acrylic Navbar */}
        <Navbar
          currentTab={activeTab}
          onChangeTab={(tab: NavTab) => {
            setActiveTab(tab);
          }}
          onGoHome={handleGoHome}
          onOpenScanner={handleOpenGeneralScanner}
          onOpenAuditModal={() => {
            setScannedCodePrefill(undefined);
            setIsAuditModalOpen(true);
          }}
          isLiveConnected={isLiveConnected}
          totalDevices={devices.length}
          openTicketsCount={openTicketsCount}
          currentTheme={currentTheme}
          onSelectTheme={setCurrentTheme}
          customColor={customColor}
          onSelectCustomColor={(col: string) => {
            setCustomColor(col);
            setCurrentTheme('custom');
          }}
          colorMode={colorMode}
          onToggleColorMode={() => setColorMode(prev => prev === 'dark' ? 'light' : 'dark')}
        />

        <main style={{ width: '100%', maxWidth: '100%', minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', boxSizing: 'border-box', paddingBottom: '120px' }}>
        {/* DIVISION INDEPENDIENTE 1: AUDITORIA E INVENTARIO */}
        {(activeTab === 'audit' || activeTab === 'dashboard' || activeTab === 'inventory') && (
          <AuditSection
            devices={devices}
            stats={stats}
            logs={logs}
            onSelectDevice={(d, initialEdit) => {
              setSelectedDevice(d);
              setDeviceModalInitialEdit(!!initialEdit);
            }}
            onOpenAuditModal={() => {
              setScannedCodePrefill(undefined);
              setIsAuditModalOpen(true);
            }}
            onOpenScanner={handleOpenGeneralScanner}
            onExportExcel={handleExportExcel}
            onDeviceUpdated={loadData}
            resetViewTrigger={resetViewTrigger}
          />
        )}

        {/* DIVISION INDEPENDIENTE 2: SOPORTE TI */}
        {activeTab === 'support' && (
          <SupportSection
            tickets={tickets}
            knowledgeList={knowledgeList}
            devices={devices}
            onRefresh={loadData}
            onSelectDevice={(d) => setSelectedDevice(d)}
            onSwitchToAudit={() => setActiveTab('audit')}
            serverInfo={serverInfo}
            effectiveServerUrl={effectiveServerUrl}
          />
        )}

        {/* TAB 5: AUTOMATED SCRIPT DEPLOYMENT & STIVIE AGENT */}
        {activeTab === 'agent' && (
          <div className="acrylic-panel" style={{ padding: '30px', maxWidth: '920px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '22px' }}>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                background: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 18px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,0.3)',
                flexShrink: 0
              }}>
                <Terminal size={22} color="var(--accent-contrast, #000000)" />
              </div>
              <div>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Centro de Descargas y Despliegue de Agentes
                </h2>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                  Despliega STIVIE en cada puesto de trabajo o ejecuta el comando rápido de inventario en equipos ajenos
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Panel de Conexión de Red para Equipos Ajenos y Remotos */}
              <div className="acrylic-card" style={{
                padding: '20px 22px',
                border: '1.5px solid var(--accent-primary)',
                background: 'rgba(255, 184, 0, 0.04)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '10px',
                      background: 'var(--accent-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--accent-contrast, #000000)',
                      flexShrink: 0
                    }}>
                      <Globe size={20} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        Destino de Conexión para Equipos Ajenos y Remotos
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                        Este comando se ejecutará en equipos ajenos fuera de este host y transmitirá la información de manera inmediata.
                      </div>
                    </div>
                  </div>

                  {/* Badge de Estado del Servidor */}
                  <div style={{
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    padding: '4px 10px',
                    borderRadius: '6px',
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                    <span>Servidor En Línea</span>
                  </div>
                </div>

                {/* Selector / Campo de IP o Dominio */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  flexWrap: 'wrap',
                  background: 'rgba(148, 163, 184, 0.08)',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-acrylic)'
                }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Servidor Central:
                  </span>
                  
                  {serverInfo.primaryUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomServerHost('');
                        localStorage.removeItem('tay_audit_custom_server_host');
                      }}
                      className={`btn-flat ${!customServerHost ? 'btn-primary' : ''}`}
                      style={{ padding: '4px 10px', fontSize: '0.74rem' }}
                      title={serverInfo.isCloud ? 'Conectado al Dominio Cloud' : 'Usar la IP de red local Wi-Fi / LAN detectada en esta máquina'}
                    >
                      {serverInfo.isCloud ? <Globe size={13} /> : <Wifi size={13} />}
                      <span>
                        {serverInfo.isCloud || serverInfo.primaryUrl.startsWith('https://')
                          ? (serverInfo.hostname || 'tay-audit.pages.dev')
                          : `Red Local (${serverInfo.primaryIp}:3001)`}
                      </span>
                    </button>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: '240px' }}>
                    <input
                      type="text"
                      placeholder="Escribe IP pública, dominio o túnel (ej: http://192.168.1.50:3001 o https://audit.upn.edu.pe)"
                      value={customServerHost}
                      onChange={(e) => {
                        setCustomServerHost(e.target.value);
                        localStorage.setItem('tay_audit_custom_server_host', e.target.value);
                      }}
                      className="form-input"
                      style={{ flex: 1, height: '32px', fontSize: '0.76rem', padding: '4px 10px' }}
                    />
                    {customServerHost && (
                      <button
                        type="button"
                        onClick={() => {
                          setCustomServerHost('');
                          localStorage.removeItem('tay_audit_custom_server_host');
                        }}
                        className="btn-flat"
                        style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                        title="Restablecer a IP de Red Local"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Opción 1: Instalador Oficial STIVIE en el Endpoint */}
              <div className="acrylic-card" style={{ padding: '22px', border: '1px solid var(--border-acrylic)', boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      background: 'rgba(255, 184, 0, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--accent-primary)'
                    }}>
                      <Bot size={20} />
                    </div>
                    <div>
                      <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        Instalador de STIVIE para la PC Cliente (.BAT)
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--accent-primary)', fontWeight: 700 }}>
                        Asistente de Operaciones Virtual con IA
                      </div>
                    </div>
                  </div>

                  <button 
                    type="button"
                    onClick={handleDownloadStivieInstaller} 
                    className="btn-flat btn-primary"
                    style={{ padding: '8px 16px' }}
                  >
                    <Download size={15} />
                    <span>Descargar Instalador STIVIE.bat</span>
                  </button>
                </div>

                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  <p style={{ margin: '0 0 8px 0' }}>
                    Descarga y ejecuta este instalador en cualquier computadora para vincularla al inventario y desplegar la mascota asistente STIVIE:
                  </p>
                  <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <li><strong>Inventario automático:</strong> CPU, RAM, placa madre, número de serie, IP y SO al panel central.</li>
                    <li><strong>Asistente de Operaciones Virtual:</strong> STIVIE.exe con IA, soporte y diagnóstico en tiempo real.</li>
                    <li><strong>Auto-inicio y acciones rápidas:</strong> Se inicia con Windows, duplicador de proyector y limpieza de cola de impresión.</li>
                  </ul>
                </div>
              </div>

              {/* Opción 2: Script Independiente de Levantamiento Rápido */}
              <div className="acrylic-card" style={{ padding: '22px', border: '1px solid var(--border-acrylic)', boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      background: 'rgba(16, 185, 129, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#10b981'
                    }}>
                      <ShieldCheck size={20} />
                    </div>
                    <div>
                      <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        Opción 2: Script Independiente de Levantamiento (Sin Instalación)
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#10b981', fontWeight: 700 }}>
                        100% Portable • No instala ningún archivo • Registro rápido de inventario en 2 segundos
                      </div>
                    </div>
                  </div>

                  <button 
                    type="button"
                    onClick={handleDownloadBatch} 
                    className="btn-flat"
                    style={{ padding: '8px 16px', borderColor: 'rgba(16, 185, 129, 0.4)' }}
                  >
                    <Download size={15} color="#10b981" />
                    <span>Descargar tay-inventory-agent.bat</span>
                  </button>
                </div>

                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                  Ideal para técnicos que llevan un pendrive/USB o realizan inventarios masivos temporales. Extrae todas las características de hardware y red, las transmite a la central (<code>{effectiveServerUrl}</code>) y finaliza sin dejar software instalado en el equipo.
                </p>
              </div>

              {/* Opción 3: Comando Rápido de PowerShell */}
              <div className="acrylic-card" style={{ padding: '22px', border: '1.5px solid var(--border-acrylic)', boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Terminal size={17} color="var(--accent-primary)" />
                    <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--accent-primary)' }}>
                      Opción 3: Comando One-Liner PowerShell (Ejecución Directa en Equipo Remoto)
                    </span>
                  </div>
                  <button type="button" onClick={() => copyToClipboard(psOneLiner)} className="btn-flat btn-primary">
                    {copiedPs ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copiedPs ? '¡Copiado!' : 'Copiar Comando'}</span>
                  </button>
                </div>
                
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0 0 10px 0' }}>
                  Pega este comando en la consola de PowerShell (o CMD) de cualquier equipo ajeno en la red. Recolectará el hardware y lo subirá de inmediato a este panel:
                </p>

                <pre style={{
                  backgroundColor: 'var(--input-bg)',
                  padding: '14px',
                  borderRadius: '8px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: 'var(--accent-primary)',
                  overflowX: 'auto',
                  border: '1px solid var(--border-acrylic)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  fontFamily: 'monospace',
                  margin: 0
                }}>
                  {psOneLiner}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Firma del Desarrollador (Pie de Página Institucional) */}
        <DeveloperFooter />
      </main>
      </div>

      {/* Modals */}
      <DeviceModal
        device={selectedDevice}
        initialEditMode={deviceModalInitialEdit}
        onClose={() => {
          setSelectedDevice(null);
          setDeviceModalInitialEdit(false);
        }}
        onDeviceUpdated={(updated) => {
          if (updated) setSelectedDevice(updated);
          loadData();
        }}
        onOpenSupportForDevice={() => {
          setSelectedDevice(null);
          setActiveTab('support');
        }}
      />

      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        devices={devices}
        onDeviceFound={(d) => setSelectedDevice(d)}
        onNewCodeScanned={(code) => {
          setScannedCodePrefill(code);
          setIsAuditModalOpen(true);
        }}
        customTitle={scannerCustomTitle}
        onCustomScan={scannerCustomCallback}
      />

      <AuditFormModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        onDeviceSaved={loadData}
        prefillCode={scannedCodePrefill}
        onOpenFieldScanner={handleOpenFieldScanner}
      />

      {/* Pantalla de Carga y Bienvenida Institucional (Splash Screen) */}
      <SplashScreen isLoading={isAppLoading} />
    </div>
  );
};

export const App: React.FC = () => {
  const isStivieClientView = 
    window.location.pathname.startsWith('/stivie') || 
    window.location.search.includes('view=stivie') ||
    window.location.hash.startsWith('#/stivie');

  if (isStivieClientView) {
    return <StivieClientApp />;
  }

  return <MainApp />;
};

export default App;
