import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  Terminal,
  Download,
  Copy,
  Check,
  Bot,
  ShieldCheck,
  Globe,
  Wifi,
  Smartphone
} from 'lucide-react';
import type { Device, SystemStats, AuditLog, SupportTicket, StivieKnowledge, AppNotification, AuthUser } from './types';
import { api, API_BASE, CLOUD_DEFAULT_URL, isNativeCapacitor } from './services/api';
import { Navbar, type NavTab } from './components/Navbar';
import { DeviceModal } from './components/DeviceModal';
import { QRScannerModal } from './components/QRScannerModal';
import { AuditFormModal, type FieldScanResult } from './components/AuditFormModal';
import { AuditSection, getInitialAuditView, VALID_AUDIT_VIEWS, type AuditView } from './components/AuditSection';
import { SupportSection, getInitialSupportSubTab, VALID_SUBTABS, type SupportSubTab } from './components/SupportSection';
import { StivieClientApp } from './components/StivieClientApp';
import { SplashScreen } from './components/SplashScreen';
import { DeveloperFooter } from './components/DeveloperFooter';
import { LiveNotificationToast } from './components/LiveNotificationToast';
import { MobileNotificationBanner } from './components/MobileNotificationBanner';
import { PwaInstallPrompt } from './components/PwaInstallPrompt';
import { AppUpdateModal } from './components/AppUpdateModal';
import { initAppUpdateChecker, type AppUpdateInfo } from './utils/appUpdateChecker';
import { LoginScreen } from './components/LoginScreen';
import { ErrorBoundary } from './components/ErrorBoundary';
import { playNotificationChime, unlockNotificationAudio } from './utils/notificationSound';
import { computeIntelligentContrast } from './utils/theme';
import { registerNotificationServiceWorker, sendNativePushNotification, subscribeDeviceToPush, setupNativeNotificationChannel, requestPushNotificationPermission } from './utils/pushNotifications';

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
  const [displayedTab, setDisplayedTab] = useState<NavTab>(() => getInitialTab());
  const [isTabFading, setIsTabFading] = useState<boolean>(false);
  const [auditView, setAuditView] = useState<AuditView>(() => getInitialAuditView());
  const [devices, setDevices] = useState<Device[]>(() => {
    try {
      const cached = localStorage.getItem('tayaudit_cached_devices');
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });
  const [logs, setLogs] = useState<AuditLog[]>(() => {
    try {
      const cached = localStorage.getItem('tayaudit_cached_logs');
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });
  const [tickets, setTickets] = useState<SupportTicket[]>(() => {
    try {
      const cached = localStorage.getItem('tayaudit_cached_tickets');
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });
  const [knowledgeList, setKnowledgeList] = useState<StivieKnowledge[]>(() => {
    try {
      const cached = localStorage.getItem('tayaudit_cached_knowledge');
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });
  const [stats, setStats] = useState<SystemStats>(() => {
    try {
      const cached = localStorage.getItem('tayaudit_cached_stats');
      if (cached) return JSON.parse(cached);
    } catch {}
    return {
      totalDevices: 0,
      onlineCount: 0,
      pcCount: 0,
      laptopCount: 0,
      serverCount: 0,
      printerCount: 0,
      networkCount: 0,
      otherCount: 0,
      recentlyAudited: 0,
    };
  });

  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [isAppLoading, setIsAppLoading] = useState(true);

  // Sistema de Notificaciones en Vivo estilo Facebook (Máximo 5 notificaciones)
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    try {
      const saved = localStorage.getItem('tay_audit_notifications');
      if (saved) return JSON.parse(saved).slice(0, 5);
    } catch {}
    return [];
  });
  const [activeToastNotification, setActiveToastNotification] = useState<AppNotification | null>(null);
  const knownTicketIdsRef = useRef<Set<string> | null>(null);
  const notifiedTicketIdsRef = useRef<Set<string>>(new Set<string>());
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('tayaudit_notified_ticket_ids');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((id: string) => notifiedTicketIdsRef.current.add(id));
        }
      }
    } catch {}

    const handleUpdateAvailable = (e: any) => {
      if (e?.detail) {
        setUpdateInfo(e.detail);
      }
    };
    window.addEventListener('tayaudit:app-update-available' as any, handleUpdateAvailable);
    const cleanupChecker = initAppUpdateChecker();

    return () => {
      window.removeEventListener('tayaudit:app-update-available' as any, handleUpdateAvailable);
      cleanupChecker();
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('tay_audit_notifications', JSON.stringify(notifications.slice(0, 5)));
    } catch {}
  }, [notifications]);

  // Navegación dirigida a tickets específicos o subpestañas de Soporte TI (Por defecto: 'tickets')
  const [supportInitialSubTab, setSupportInitialSubTab] = useState<SupportSubTab>(() => getInitialSupportSubTab());
  const [targetTicketId, setTargetTicketId] = useState<string | null>(null);

  // Transición suave de Fade al desaparecer y aparecer al cambiar de módulo principal
  useEffect(() => {
    const normActive = (activeTab === 'dashboard' || activeTab === 'inventory') ? 'audit' : activeTab;
    const normDisplayed = (displayedTab === 'dashboard' || displayedTab === 'inventory') ? 'audit' : displayedTab;
    if (normActive === normDisplayed) {
      if (activeTab !== displayedTab) setDisplayedTab(activeTab);
      return;
    }
    setIsTabFading(true);
    const timer = setTimeout(() => {
      setDisplayedTab(activeTab);
      requestAnimationFrame(() => {
        setIsTabFading(false);
      });
    }, 140);
    return () => clearTimeout(timer);
  }, [activeTab, displayedTab]);

  // Sesión y Autenticación Corporativa (Admin: 210391 / User: 1991)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    try {
      const saved = localStorage.getItem('tay_audit_auth_user');
      if (saved) {
        const u = JSON.parse(saved);
        if (u && (u.username === 'Admin' || !u.username || u.displayName?.includes('Administrador del Sistema'))) {
          u.username = 'Tayron Salinas';
          u.displayName = 'Tayron Salinas';
        }
        return u;
      }
    } catch {}
    return null;
  });

  const handleLogin = (user: AuthUser) => {
    setCurrentUser(user);
    try {
      localStorage.setItem('tay_audit_auth_user', JSON.stringify(user));
    } catch {}
  };

  const handleLogout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem('tay_audit_auth_user');
    } catch {}
  };

  // Modals
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [deviceModalInitialEdit, setDeviceModalInitialEdit] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerCustomTitle, setScannerCustomTitle] = useState<string | undefined>(undefined);
  const [scannerCustomCallback, setScannerCustomCallback] = useState<((code: string) => void) | undefined>(undefined);

  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [scannedCodePrefill, setScannedCodePrefill] = useState<string | undefined>(undefined);
  const [scannerFieldPrefill, setScannerFieldPrefill] = useState<FieldScanResult | null>(null);
  const [copiedPs, setCopiedPs] = useState(false);

  // Historial de navegación y gestión de retroceso (Atrás / Swipe en móviles / Botón Atrás en PC)
  const [ticketsNavTrigger, setTicketsNavTrigger] = useState(0);
  const modalHistoryPushedRef = useRef(false);
  const ignorePopstateRef = useRef(false);
  const isPopstateNavRef = useRef(false);
  const selectedDeviceRef = useRef<Device | null>(null);
  const isAuditModalOpenRef = useRef<boolean>(false);
  const isScannerOpenRef = useRef<boolean>(false);

  useEffect(() => {
    selectedDeviceRef.current = selectedDevice;
  }, [selectedDevice]);

  useEffect(() => {
    isAuditModalOpenRef.current = isAuditModalOpen;
  }, [isAuditModalOpen]);

  // Sincronización proactiva cuando cambian los estados de modales principales en App.tsx
  useEffect(() => {
    const isAnyModalActive = Boolean(selectedDevice || isAuditModalOpen || updateInfo);
    if (typeof document !== 'undefined') {
      if (isAnyModalActive) {
        if (!document.body.classList.contains('modal-backdrop-blur-active')) {
          document.body.classList.add('modal-backdrop-blur-active');
          document.body.classList.add('has-active-modal');
          document.documentElement.setAttribute('data-modal-open', 'true');
        }
      } else {
        const remaining = document.querySelector('.modal-backdrop-acrylic:not(.closing):not(.scanner-warming), .upn-update-status-backdrop');
        if (!remaining && document.body.classList.contains('modal-backdrop-blur-active')) {
          document.body.classList.remove('modal-backdrop-blur-active');
          document.body.classList.remove('has-active-modal');
          document.documentElement.removeAttribute('data-modal-open');
        }
      }
    }
  }, [selectedDevice, isAuditModalOpen, isScannerOpen, updateInfo]);

  useEffect(() => {
    isScannerOpenRef.current = isScannerOpen;
  }, [isScannerOpen]);

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
    return localStorage.getItem('tay_audit_custom_color') || '#FDBA30';
  });

  const [colorMode, setColorMode] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('tay_audit_colormode');
    if (saved === 'dark' || saved === 'light') return saved;
    return 'light';
  });

  // Sincronización universal del desenfoque de fondo (#root) cuando CUALQUIER ventana modal se abra
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const syncModalPresence = () => {
      const activeModal = document.querySelector(
        '.modal-backdrop-acrylic:not(.closing):not(.scanner-warming), .upn-update-status-backdrop, [data-modal-backdrop="true"]'
      );
      if (activeModal) {
        if (!document.body.classList.contains('modal-backdrop-blur-active')) {
          document.body.classList.add('modal-backdrop-blur-active');
          document.body.classList.add('has-active-modal');
          document.documentElement.setAttribute('data-modal-open', 'true');
        }
      } else {
        if (document.body.classList.contains('modal-backdrop-blur-active')) {
          document.body.classList.remove('modal-backdrop-blur-active');
          document.body.classList.remove('has-active-modal');
          document.documentElement.removeAttribute('data-modal-open');
        }
      }
    };

    syncModalPresence();
    const observer = new MutationObserver(syncModalPresence);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      document.body.classList.remove('modal-backdrop-blur-active');
      document.body.classList.remove('has-active-modal');
      document.documentElement.removeAttribute('data-modal-open');
    };
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', currentTheme);
    document.documentElement.setAttribute('data-mode', colorMode);
    document.documentElement.style.colorScheme = colorMode;
    if (colorMode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('tay_audit_theme', currentTheme);
    localStorage.setItem('tay_audit_colormode', colorMode);

    // Sincronización armónica con la barra y navegación de TODOS los navegadores móviles (Chrome Android, Samsung Internet, iOS Safari, Edge Mobile, Firefox)
    const mobileThemeColor = colorMode === 'light' ? '#f8fafc' : '#000000';
    const themeMetas = document.querySelectorAll('meta[name="theme-color"]');
    if (themeMetas.length > 0) {
      themeMetas.forEach(meta => meta.setAttribute('content', mobileThemeColor));
    } else {
      const newMeta = document.createElement('meta');
      newMeta.setAttribute('name', 'theme-color');
      newMeta.setAttribute('content', mobileThemeColor);
      document.head.appendChild(newMeta);
    }

    let schemeMeta = document.querySelector('meta[name="color-scheme"]');
    if (!schemeMeta) {
      schemeMeta = document.createElement('meta');
      schemeMeta.setAttribute('name', 'color-scheme');
      document.head.appendChild(schemeMeta);
    }
    schemeMeta.setAttribute('content', colorMode);

    const appleStatusBar = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (appleStatusBar) {
      appleStatusBar.setAttribute('content', colorMode === 'dark' ? 'black-translucent' : 'default');
    }

    const msNavMeta = document.querySelector('meta[name="msapplication-navbutton-color"]');
    if (msNavMeta) {
      msNavMeta.setAttribute('content', mobileThemeColor);
    }

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

  // Límite de seguridad: liberar splash screen después de 1.5s sin importar latencia de red
  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      setIsAppLoading(false);
    }, 1500);
    return () => clearTimeout(safetyTimer);
  }, []);

  // Load all data
  const loadData = useCallback(async () => {
    try {
      const [fetchedDevices, fetchedStats, fetchedLogs, fetchedTickets, fetchedKnowledge] = await Promise.all([
        api.getDevices().catch(err => {
          console.warn('[App] getDevices fallback:', err);
          return null;
        }),
        api.getStats().catch(err => {
          console.warn('[App] getStats fallback:', err);
          return null;
        }),
        api.getLogs().catch(err => {
          console.warn('[App] getLogs fallback:', err);
          return null;
        }),
        api.getTickets().catch(() => null),
        api.getStivieKnowledge().catch(() => [])
      ]);

      if (fetchedDevices && Array.isArray(fetchedDevices) && fetchedDevices.length > 0) {
        setDevices(fetchedDevices);
        try { localStorage.setItem('tayaudit_cached_devices', JSON.stringify(fetchedDevices)); } catch {}
      }
      if (fetchedStats) {
        setStats(fetchedStats);
        try { localStorage.setItem('tayaudit_cached_stats', JSON.stringify(fetchedStats)); } catch {}
      }
      if (fetchedLogs && Array.isArray(fetchedLogs) && fetchedLogs.length > 0) {
        setLogs(fetchedLogs);
        try { localStorage.setItem('tayaudit_cached_logs', JSON.stringify(fetchedLogs)); } catch {}
      }
      if (fetchedTickets && Array.isArray(fetchedTickets) && fetchedTickets.length > 0) {
        setTickets(fetchedTickets);
        try { localStorage.setItem('tayaudit_cached_tickets', JSON.stringify(fetchedTickets)); } catch {}
      }
      if (fetchedKnowledge && Array.isArray(fetchedKnowledge)) {
        setKnowledgeList(fetchedKnowledge);
        try { localStorage.setItem('tayaudit_cached_knowledge', JSON.stringify(fetchedKnowledge)); } catch {}
      }

      const validDevices = (fetchedDevices && Array.isArray(fetchedDevices)) ? fetchedDevices : devices;
      const validTickets = (fetchedTickets && Array.isArray(fetchedTickets)) ? fetchedTickets : tickets;

      // Sincronizar el equipo seleccionado si el modal está abierto en tiempo real
      setSelectedDevice(prev => {
        if (!prev) return null;
        const fresh = validDevices.find(d => d.id === prev.id);
        if (!fresh) return prev;
        if (fresh.updatedAt === prev.updatedAt && fresh.lastAgentPing === prev.lastAgentPing) {
          return prev;
        }
        return fresh;
      });

      // Sistema de Notificaciones de Tickets en Vivo estilo FB (Máximo 5)
      const openTickets = validTickets.filter(t => t.status !== 'resuelto');
      const activeTicketIds = new Set(openTickets.map(t => t.id));

      if (knownTicketIdsRef.current === null) {
        // Carga inicial: registrar IDs conocidos y marcarlos para no alertar retroactivamente
        knownTicketIdsRef.current = new Set(validTickets.map(t => t.id));
        validTickets.forEach(t => notifiedTicketIdsRef.current.add(t.id));
        try {
          localStorage.setItem('tayaudit_notified_ticket_ids', JSON.stringify(Array.from(notifiedTicketIdsRef.current)));
        } catch {}

        setNotifications(prev => {
          if (prev.length > 0) {
            return prev.filter(n => activeTicketIds.has(n.ticketId)).slice(0, 5);
          }
          return openTickets.slice(0, 5).map(t => ({
            id: `notif-${t.id}`,
            ticketId: t.id,
            title: `Nuevo Ticket TI: ${t.category}`,
            userName: t.userName || 'Usuario / Docente',
            hostname: t.hostname,
            category: t.category,
            description: t.description,
            urgency: t.urgency,
            timestamp: t.createdAt || new Date().toISOString(),
            read: false,
            attended: false
          }));
        });
      } else {
        // En recargas de datos generales sincronizamos la lista sin duplicar alertas push
        setNotifications(prev => prev.filter(n => activeTicketIds.has(n.ticketId)).slice(0, 5));
        knownTicketIdsRef.current = new Set(validTickets.map(t => t.id));
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setIsAppLoading(false);
    }
  }, []);

  const openTicketsCount = useMemo(() => {
    return tickets.filter(t => t.status !== 'resuelto').length;
  }, [tickets]);

  const lastSyncVersionRef = useRef<string | null>(null);
  const lastFullLoadTsRef = useRef<number>(0);
  const lastFastTicketCheckTsRef = useRef<number>(0);

  useEffect(() => {
    let isMounted = true;
    loadData().then(() => {
      lastFullLoadTsRef.current = Date.now();
      lastFastTicketCheckTsRef.current = Date.now();
    });

    const checkFastTicketsSync = async () => {
      try {
        const freshTickets = await api.getTickets();
        if (!isMounted) return;
        setTickets(freshTickets);

        const openTickets = freshTickets.filter(t => t.status !== 'resuelto');
        const activeTicketIds = new Set(openTickets.map(t => t.id));

        if (knownTicketIdsRef.current !== null) {
          const brandNewTickets = freshTickets.filter(
            t => !knownTicketIdsRef.current!.has(t.id) &&
                 !notifiedTicketIdsRef.current.has(t.id) &&
                 t.status !== 'resuelto'
          );

          if (brandNewTickets.length > 0) {
            brandNewTickets.forEach(t => notifiedTicketIdsRef.current.add(t.id));
            try {
              localStorage.setItem('tayaudit_notified_ticket_ids', JSON.stringify(Array.from(notifiedTicketIdsRef.current)));
            } catch {}

            playNotificationChime();

            const newNotifs: AppNotification[] = brandNewTickets.map(t => ({
              id: `notif-${t.id}-${Date.now()}`,
              ticketId: t.id,
              title: `Nuevo Ticket TI: ${t.category}`,
              userName: t.userName || 'Usuario / Docente',
              hostname: t.hostname,
              category: t.category,
              description: t.description,
              urgency: t.urgency,
              timestamp: t.createdAt || new Date().toISOString(),
              read: false,
              attended: false
            }));

            setActiveToastNotification(newNotifs[0]);
            sendNativePushNotification(newNotifs[0]);

            setNotifications(prev => {
              const combined = [...newNotifs, ...prev.filter(p => !brandNewTickets.some(b => b.id === p.ticketId))];
              return combined.filter(n => activeTicketIds.has(n.ticketId)).slice(0, 5);
            });
          } else {
            setNotifications(prev => prev.filter(n => activeTicketIds.has(n.ticketId)).slice(0, 5));
          }
        }
        knownTicketIdsRef.current = new Set(freshTickets.map(t => t.id));
      } catch {}
    };

    let broadcastChannel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        broadcastChannel = new BroadcastChannel('tayaudit_cross_tab_sync');
        broadcastChannel.onmessage = (ev) => {
          if (ev.data?.type === 'REFRESH') {
            loadData();
          }
        };
      }
    } catch {}

    const handleManualRefresh = () => {
      loadData();
    };
    window.addEventListener('tayaudit:refresh-data', handleManualRefresh);

    const checkCloudSync = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }
      try {
        const sync = await api.getSyncState();
        if (!isMounted) return;
        setIsLiveConnected(true);
        const now = Date.now();
        const versionChanged = lastSyncVersionRef.current !== null && sync.version !== lastSyncVersionRef.current;
        const ticketCheckIntervalPassed = (now - lastFastTicketCheckTsRef.current) > 4000;

        if (lastSyncVersionRef.current === null) {
          lastSyncVersionRef.current = sync.version;
          lastFastTicketCheckTsRef.current = now;
        } else if (versionChanged || ticketCheckIntervalPassed) {
          lastFastTicketCheckTsRef.current = now;
          await checkFastTicketsSync();
        }

        const needsInitialFill = devices.length === 0 || tickets.length === 0;
        if (versionChanged || needsInitialFill || (now - lastFullLoadTsRef.current > 20000)) {
          lastSyncVersionRef.current = sync.version;
          lastFullLoadTsRef.current = now;
          loadData();
        }
      } catch {
        if (isMounted) setIsLiveConnected(false);
      }
    };

    checkCloudSync();
    const syncTimer = setInterval(checkCloudSync, 2500);

    const handleResumeOrFocus = () => {
      checkCloudSync();
      loadData();
    };
    document.addEventListener('visibilitychange', handleResumeOrFocus);
    window.addEventListener('focus', handleResumeOrFocus);
    window.addEventListener('online', handleResumeOrFocus);
    document.addEventListener('resume', handleResumeOrFocus as EventListener);

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
          checkFastTicketsSync();
          loadData();
        };
      } catch {
        // Fallback handled by checkCloudSync
      }
    }

    return () => {
      isMounted = false;
      clearInterval(syncTimer);
      document.removeEventListener('visibilitychange', handleResumeOrFocus);
      window.removeEventListener('focus', handleResumeOrFocus);
      window.removeEventListener('online', handleResumeOrFocus);
      document.removeEventListener('resume', handleResumeOrFocus as EventListener);
      window.removeEventListener('tayaudit:refresh-data', handleManualRefresh);
      if (broadcastChannel) broadcastChannel.close();
      if (eventSource) eventSource.close();
    };
  }, []);

  // Inicialización de Service Worker, suscripción Web Push y permisos nativos en APK
  useEffect(() => {
    if (isNativeCapacitor()) {
      document.documentElement.classList.add('is-capacitor');
      requestPushNotificationPermission().catch(() => {});
    }
    setupNativeNotificationChannel().catch(() => {});
    registerNotificationServiceWorker().then(() => {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        subscribeDeviceToPush().catch(() => {});
      }
    });

    // Desbloquear motor de audio en la primera interacción (sin disparar alertas intrusivas de permisos)
    const unlockAudioOnFirstTouch = () => {
      unlockNotificationAudio();
    };
    window.addEventListener('pointerdown', unlockAudioOnFirstTouch, { passive: true, once: true });
    window.addEventListener('keydown', unlockAudioOnFirstTouch, { passive: true, once: true });
    window.addEventListener('touchstart', unlockAudioOnFirstTouch, { passive: true, once: true });
    window.addEventListener('click', unlockAudioOnFirstTouch, { passive: true, once: true });

    const handleSwMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === 'OPEN_TICKET' && e.data.ticketId) {
        setSupportInitialSubTab('tickets');
        setTargetTicketId(e.data.ticketId);
        setActiveTab('support');
      }
      if (e.data && e.data.type === 'TICKET_UPDATE') {
        loadData();
      }
    };

    const handleCustomOpen = (e: any) => {
      if (e.detail && e.detail.ticketId) {
        setSupportInitialSubTab('tickets');
        setTargetTicketId(e.detail.ticketId);
        setActiveTab('support');
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSwMessage);
    }
    window.addEventListener('app-open-ticket', handleCustomOpen);

    // Revisar si la URL trae un parámetro ticketId al hacer clic en notificación
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const urlTicketId = urlParams.get('ticketId');
      if (urlTicketId) {
        setSupportInitialSubTab('tickets');
        setTargetTicketId(urlTicketId);
        setActiveTab('support');
      }
    }

    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      }
      window.removeEventListener('app-open-ticket', handleCustomOpen);
    };
  }, []);

  // Controladores de apertura y cierre de ventanas modales con sincronización de Historial
  const handleOpenDeviceModal = (device: Device, initialEdit: boolean = false) => {
    setIsScannerOpen(false);
    setSelectedDevice(device);
    setDeviceModalInitialEdit(initialEdit);
    if (!modalHistoryPushedRef.current) {
      modalHistoryPushedRef.current = true;
      window.history.pushState({ modal: 'device', tab: activeTab }, '', window.location.href);
    }
  };

  const handleCloseDeviceModal = () => {
    setSelectedDevice(null);
    setDeviceModalInitialEdit(false);
    if (!isAuditModalOpen && !isScannerOpen && modalHistoryPushedRef.current) {
      modalHistoryPushedRef.current = false;
      ignorePopstateRef.current = true;
      window.history.back();
    }
  };

  const handleOpenAuditModal = (prefill?: string) => {
    setIsScannerOpen(false);
    setScannedCodePrefill(prefill);
    setIsAuditModalOpen(true);
    if (!modalHistoryPushedRef.current) {
      modalHistoryPushedRef.current = true;
      window.history.pushState({ modal: 'audit', tab: activeTab }, '', window.location.href);
    }
  };

  const handleCloseAuditModal = () => {
    setIsAuditModalOpen(false);
    setScannerFieldPrefill(null);
    if (!selectedDevice && !isScannerOpen && modalHistoryPushedRef.current) {
      modalHistoryPushedRef.current = false;
      ignorePopstateRef.current = true;
      window.history.back();
    }
  };

  const handleOpenScannerModal = (title?: string, callback?: (code: string) => void) => {
    setScannerCustomTitle(title);
    setScannerCustomCallback(() => callback);
    setIsScannerOpen(true);
    if (!modalHistoryPushedRef.current) {
      modalHistoryPushedRef.current = true;
      window.history.pushState({ modal: 'scanner', tab: activeTab }, '', window.location.href);
    }
  };

  const handleCloseScannerModal = () => {
    setIsScannerOpen(false);
    if (!selectedDevice && !isAuditModalOpen && modalHistoryPushedRef.current) {
      modalHistoryPushedRef.current = false;
      ignorePopstateRef.current = true;
      window.history.back();
    }
  };

  // General scanner open
  const handleOpenGeneralScanner = () => {
    handleOpenScannerModal('Escáner de Activos (QR / Código de Barras)', undefined);
  };

  // Form field scanner open: antepone el escáner sobre el formulario y auto-completa el campo al escanear
  const handleOpenFieldScanner = (field: 'hostname' | 'serialNumber' | 'monitorSerial') => {
    handleOpenScannerModal(
      `Escanear ${field === 'hostname' ? 'Hostname / Código' : field === 'monitorSerial' ? 'Serial de Monitor (S/N)' : 'Número de Serie (S/N)'}`,
      (code: string) => {
        setScannerFieldPrefill({ field, value: code, ts: Date.now() });
      }
    );
  };

  // Disparador para resetear vista a inicio al hacer clic en el botón de marca/logo
  const [resetViewTrigger, setResetViewTrigger] = useState(0);

  // Acción de Ir al Inicio: regresa a la pestaña principal (audit), resetea a Equipos ('list') y hace scroll suave al tope
  const handleGoHome = () => {
    setActiveTab('audit');
    setAuditView('list');
    setResetViewTrigger(prev => prev + 1);
    localStorage.setItem('tay_audit_active_tab', 'audit');
    localStorage.setItem('tay_audit_audit_view', 'list');
    const params = new URLSearchParams(window.location.search);
    params.set('tab', 'audit');
    params.set('view', 'list');
    params.delete('subtab');
    params.delete('ticketId');
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({ tab: 'audit', view: 'list' }, '', newUrl);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleExportExcel = () => {
    window.open(api.getInventoryExcelDownloadUrl(), '_blank');
  };

  // Handlers para Notificaciones en Vivo estilo Facebook (Máximo 5 y auto-limpieza)
  const handleSelectNotification = (notif: AppNotification) => {
    // Al dar atención al ticket, removerlo de la lista de notificaciones activas
    setNotifications(prev => prev.filter(n => n.id !== notif.id));
    setActiveToastNotification(null);
    setSupportInitialSubTab('tickets');
    setTargetTicketId(notif.ticketId);
    setTicketsNavTrigger(prev => prev + 1);
    setActiveTab('support');
    const params = new URLSearchParams(window.location.search);
    params.set('tab', 'support');
    params.set('subtab', 'tickets');
    params.set('ticketId', notif.ticketId);
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({ tab: 'support', subtab: 'tickets', ticketId: notif.ticketId }, '', newUrl);
  };

  const handleGoToTickets = () => {
    setActiveTab('support');
    setSupportInitialSubTab('tickets');
    setTargetTicketId(null);
    setTicketsNavTrigger(prev => prev + 1);
    localStorage.setItem('tay_audit_active_tab', 'support');
    localStorage.setItem('tay_audit_support_subtab', 'tickets');
    const params = new URLSearchParams(window.location.search);
    params.set('tab', 'support');
    params.set('subtab', 'tickets');
    params.delete('ticketId');
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({ tab: 'support', subtab: 'tickets' }, '', newUrl);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleMarkAllNotificationsAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleClearAllNotifications = () => {
    setNotifications([]);
  };

  const handleDismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Sincronizar activeTab, sub-apartados y modales con la navegación multipágina (botón atrás en PC y swipe en los extremos en móvil)
  useEffect(() => {
    if (typeof window !== 'undefined' && (!window.history.state || !window.history.state.tab)) {
      window.history.replaceState(
        { tab: getInitialTab(), view: getInitialAuditView(), subtab: getInitialSupportSubTab() },
        '',
        window.location.href
      );
    }

    const handlePopState = (e: PopStateEvent) => {
      // Si el retroceso fue disparado programáticamente por el botón "Cerrar" / "X", no duplicar acción
      if (ignorePopstateRef.current) {
        ignorePopstateRef.current = false;
        return;
      }

      // REGLA 1: Si hay alguna ventana o modal abierto, el botón atrás / swipe atrás DEBE CERRAR LA VENTANA sin cerrar la app
      if (modalHistoryPushedRef.current || selectedDeviceRef.current || isAuditModalOpenRef.current || isScannerOpenRef.current) {
        if (isScannerOpenRef.current && isAuditModalOpenRef.current) {
          setIsScannerOpen(false);
          modalHistoryPushedRef.current = true;
          window.history.pushState({ modal: 'audit', tab: activeTab, view: auditView, subtab: supportInitialSubTab }, '', window.location.href);
          return;
        }

        modalHistoryPushedRef.current = false;
        setSelectedDevice(null);
        setDeviceModalInitialEdit(false);
        setIsAuditModalOpen(false);
        setIsScannerOpen(false);
        return;
      }

      // REGLA 2: Navegación multipágina -> restaurar pestaña y sub-apartado exactos del historial
      const urlParams = new URLSearchParams(window.location.search);
      const stateTab = e.state?.tab;
      const urlTab = urlParams.get('tab') as NavTab;
      const targetTab = (stateTab && VALID_TABS.includes(stateTab))
        ? stateTab
        : (urlTab && VALID_TABS.includes(urlTab))
          ? urlTab
          : 'audit';

      const stateView = e.state?.view as AuditView | undefined;
      const urlView = urlParams.get('view') as AuditView | null;
      const targetView: AuditView = (stateView && VALID_AUDIT_VIEWS.includes(stateView))
        ? stateView
        : (urlView && VALID_AUDIT_VIEWS.includes(urlView))
          ? urlView
          : 'list';

      const stateSubTab = e.state?.subtab as SupportSubTab | undefined;
      const urlSubTab = urlParams.get('subtab') as SupportSubTab | null;
      const targetSubTab: SupportSubTab = (stateSubTab && VALID_SUBTABS.includes(stateSubTab))
        ? stateSubTab
        : (urlSubTab && VALID_SUBTABS.includes(urlSubTab))
          ? urlSubTab
          : 'tickets';

      isPopstateNavRef.current = true;
      setActiveTab(targetTab);
      setAuditView(targetView);
      setSupportInitialSubTab(targetSubTab);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeTab, auditView, supportInitialSubTab]);

  // Sincronizar URL, historial multipágina y localStorage cuando cambia cualquier pestaña o sub-apartado
  useEffect(() => {
    const normTab: NavTab = (activeTab === 'dashboard' || activeTab === 'inventory') ? 'audit' : activeTab;
    localStorage.setItem('tay_audit_active_tab', normTab);
    localStorage.setItem('tay_audit_audit_view', auditView);
    localStorage.setItem('tay_audit_support_subtab', supportInitialSubTab);

    const params = new URLSearchParams(window.location.search);
    const currentUrlTab = params.get('tab');
    const currentUrlView = params.get('view');
    const currentUrlSubtab = params.get('subtab');

    let changed = false;
    if (currentUrlTab !== normTab) {
      params.set('tab', normTab);
      changed = true;
    }

    if (normTab === 'audit') {
      if (currentUrlView !== auditView) {
        params.set('view', auditView);
        changed = true;
      }
      if (params.has('subtab')) {
        params.delete('subtab');
        changed = true;
      }
    } else if (normTab === 'support') {
      if (currentUrlSubtab !== supportInitialSubTab) {
        params.set('subtab', supportInitialSubTab);
        changed = true;
      }
      if (params.has('view')) {
        params.delete('view');
        changed = true;
      }
    } else {
      if (params.has('view') || params.has('subtab')) {
        params.delete('view');
        params.delete('subtab');
        changed = true;
      }
    }

    if (changed) {
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      const stateObj = { tab: normTab, view: auditView, subtab: supportInitialSubTab };
      if (isPopstateNavRef.current) {
        isPopstateNavRef.current = false;
        window.history.replaceState(stateObj, '', newUrl);
      } else {
        window.history.pushState(stateObj, '', newUrl);
      }
    } else if (isPopstateNavRef.current) {
      isPopstateNavRef.current = false;
    }
  }, [activeTab, auditView, supportInitialSubTab]);

  // Navegación por gesto en los extremos laterales (<= 36px del borde): retrocede a la página anterior del historial (multipágina)
  // El swipe en medio de la pantalla está deshabilitado para no cambiar de apartado accidentalmente en móviles
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (modalHistoryPushedRef.current || selectedDevice || isAuditModalOpen || isScannerOpen) return;
    const x = e.touches[0].clientX;
    const viewportW = document.documentElement.clientWidth || window.innerWidth;
    const EDGE_ZONE = 36;
    if (x <= EDGE_ZONE || x >= viewportW - EDGE_ZONE) {
      setTouchStartX(x);
      setTouchStartY(e.touches[0].clientY);
    } else {
      setTouchStartX(null);
      setTouchStartY(null);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (modalHistoryPushedRef.current || selectedDevice || isAuditModalOpen || isScannerOpen) {
      setTouchStartX(null);
      setTouchStartY(null);
      return;
    }
    if (touchStartX === null || touchStartY === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const diffX = touchEndX - touchStartX;
    const diffY = touchEndY - touchStartY;

    // Solo permitir retroceder con swipe desde los extremos laterales (sin cambiar de apartado al deslizar en medio)
    if (Math.abs(diffX) > Math.abs(diffY) * 1.25 && Math.abs(diffX) > 48) {
      const viewportW = document.documentElement.clientWidth || window.innerWidth;
      const EDGE_ZONE = 36;
      const isLeftEdge = touchStartX <= EDGE_ZONE;
      const isRightEdge = touchStartX >= viewportW - EDGE_ZONE;

      if ((isLeftEdge && diffX > 48) || (isRightEdge && diffX < -48)) {
        if (window.history.length > 1) {
          window.history.back();
        }
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

  const psOneLiner = `irm ${effectiveServerUrl}/audit | iex`;

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
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "irm ${effectiveServerUrl}/audit | iex"
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

  // Si no hay sesión iniciada, mostrar Pantalla de Login Institucional UPN
  if (!currentUser) {
    return (
      <>
        <SplashScreen minDuration={2200} />
        <LoginScreen onLogin={handleLogin} />
      </>
    );
  }

  return (
    <ErrorBoundary>
      <div
        className="main-app-outer-wrapper"
        style={{
          minHeight: '100dvh',
          width: '100%',
          maxWidth: '100vw',
          padding: 0,
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
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
            minWidth: 0,
            minHeight: '100dvh',
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            boxSizing: 'border-box',
            padding: 0,
            margin: 0
          }}>
        {/* Banner de Instalación como App Nativa en Móviles (PWA Standalone) */}
        <PwaInstallPrompt />

        {/* Banner de Activación Rápida de Notificaciones para Móviles */}
        <MobileNotificationBanner />

        {/* Modal de Actualizaciones OTA Directas desde el APK Nativo */}
        <AppUpdateModal
          updateInfo={updateInfo}
          onClose={() => setUpdateInfo(null)}
        />

        {/* Top Acrylic Navbar (Sticky & Liquid Glass Defocus Effect) */}
        <Navbar
          currentTab={activeTab}
          onChangeTab={(tab: NavTab) => {
            if (tab === 'audit' || tab === 'inventory' || tab === 'dashboard') {
              setAuditView('list');
              setActiveTab('audit');
            } else if (tab === 'support') {
              setSupportInitialSubTab('tickets');
              setActiveTab('support');
            } else {
              setActiveTab(tab);
            }
          }}
          onGoHome={handleGoHome}
          onOpenScanner={handleOpenGeneralScanner}
          onOpenAuditModal={() => {
            handleOpenAuditModal();
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
          notifications={notifications}
          onSelectNotification={handleSelectNotification}
          onMarkAllAsRead={handleMarkAllNotificationsAsRead}
          onClearAllNotifications={handleClearAllNotifications}
          onDismissNotification={handleDismissNotification}
          onGoToTickets={handleGoToTickets}
          currentUser={currentUser}
          onLogout={handleLogout}
        />

        <main className="main-app-container" style={{ 
          width: '100%', 
          maxWidth: '1880px', 
          minWidth: 0, 
          margin: '0 auto',
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          boxSizing: 'border-box', 
          padding: '16px 16px 120px 16px',
          overflowX: 'clip'
        }}>
        <div
          className="section-fade-content"
          style={{
            opacity: isTabFading ? 0 : 1,
            transition: 'opacity 0.20s cubic-bezier(0.16, 1, 0.3, 1)',
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            width: '100%'
          }}
        >
        <ErrorBoundary>
          {/* DIVISION INDEPENDIENTE 1: AUDITORIA E INVENTARIO */}
          {(displayedTab === 'audit' || displayedTab === 'dashboard' || displayedTab === 'inventory') && (
            <AuditSection
              devices={devices}
              stats={stats}
              logs={logs}
              onSelectDevice={(d) => {
                handleOpenDeviceModal(d, false);
              }}
              onOpenAuditModal={() => {
                handleOpenAuditModal();
              }}
              onOpenScanner={handleOpenGeneralScanner}
              onExportExcel={handleExportExcel}
              onDeviceUpdated={loadData}
              resetViewTrigger={resetViewTrigger}
              activeViewProp={auditView}
              onViewChange={setAuditView}
            />
          )}

          {/* DIVISION INDEPENDIENTE 2: SOPORTE TI */}
          {displayedTab === 'support' && (
            <SupportSection
              tickets={tickets}
              knowledgeList={knowledgeList}
              devices={devices}
              onRefresh={loadData}
              onSelectDevice={(d) => handleOpenDeviceModal(d)}
              onSwitchToAudit={() => {
                setAuditView('list');
                setActiveTab('audit');
              }}
              serverInfo={serverInfo}
              effectiveServerUrl={effectiveServerUrl}
              initialSubTab={supportInitialSubTab}
              onSubTabChange={setSupportInitialSubTab}
              targetTicketId={targetTicketId}
              onClearTargetTicket={() => setTargetTicketId(null)}
              ticketsNavTrigger={ticketsNavTrigger}
            />
          )}
        </ErrorBoundary>

        {/* TAB 5: AUTOMATED SCRIPT DEPLOYMENT & STIVIE AGENT */}
        {displayedTab === 'agent' && (
          <div className="acrylic-panel agent-hub-panel" style={{ padding: '24px 26px', width: '100%', maxWidth: '1480px', margin: '0 auto', boxSizing: 'border-box' }}>
            {/* Cabecera Compacta + Barra de Servidor Central Integrada */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px',
              paddingBottom: '18px',
              marginBottom: '20px',
              borderBottom: '1px solid var(--border-acrylic)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: 'var(--accent-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 16px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,0.3)',
                  flexShrink: 0
                }}>
                  <Terminal size={21} color="var(--accent-contrast, #000000)" />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <h2 style={{ fontSize: '1.28rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.01em' }}>
                      Centro de Despliegue y Descargas
                    </h2>
                    <div style={{
                      fontSize: '0.70rem',
                      fontWeight: 800,
                      padding: '3px 9px',
                      borderRadius: '999px',
                      background: 'rgba(16, 185, 129, 0.14)',
                      color: '#10b981',
                      border: '1px solid rgba(16, 185, 129, 0.35)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                      <span>Servidor En Línea</span>
                    </div>
                  </div>
                  <p style={{ fontSize: '0.80rem', color: 'var(--text-secondary)', margin: '3px 0 0 0' }}>
                    Instaladores de escritorio STIVIE, auditoría rápida de hardware y aplicación móvil
                  </p>
                </div>
              </div>

              {/* Selector Compacto de Servidor Destino */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flexWrap: 'wrap',
                background: 'var(--bg-elevated, rgba(148, 163, 184, 0.08))',
                padding: '7px 11px',
                borderRadius: '11px',
                border: '1px solid var(--border-acrylic)',
                flex: '1 1 min(100%, 420px)',
                maxWidth: '620px',
                minWidth: 0
              }}>
                <span style={{ fontSize: '0.70rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                  Destino:
                </span>

                {serverInfo.primaryUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomServerHost('');
                      localStorage.removeItem('tay_audit_custom_server_host');
                    }}
                    className={`btn-flat ${!customServerHost ? 'btn-primary' : ''}`}
                    style={{ padding: '4px 10px', fontSize: '0.73rem', height: '30px', flexShrink: 0 }}
                    title={serverInfo.isCloud ? 'Conectado al Dominio Cloud' : 'Usar la IP de red local detectada'}
                  >
                    {serverInfo.isCloud ? <Globe size={13} /> : <Wifi size={13} />}
                    <span>
                      {serverInfo.isCloud || serverInfo.primaryUrl.startsWith('https://')
                        ? (serverInfo.hostname || 'tay-audit.pages.dev')
                        : `${serverInfo.primaryIp}:3001`}
                    </span>
                  </button>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: '180px' }}>
                  <input
                    type="text"
                    placeholder="IP o dominio alternativo (opcional)..."
                    value={customServerHost}
                    onChange={(e) => {
                      setCustomServerHost(e.target.value);
                      localStorage.setItem('tay_audit_custom_server_host', e.target.value);
                    }}
                    className="form-input"
                    style={{ flex: 1, height: '30px', fontSize: '0.74rem', padding: '4px 10px' }}
                  />
                  {customServerHost && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomServerHost('');
                        localStorage.removeItem('tay_audit_custom_server_host');
                      }}
                      className="btn-flat"
                      style={{ padding: '4px 8px', fontSize: '0.70rem', height: '30px' }}
                      title="Restablecer servidor predeterminado"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Cuadrícula 2x2 de Tarjetas de Despliegue */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 440px), 1fr))',
              gap: '16px',
              alignItems: 'stretch'
            }}>
              {/* Tarjeta 1: Instalador Oficial STIVIE */}
              <div className="acrylic-card" style={{
                padding: '20px 22px',
                border: '1.5px solid var(--accent-primary)',
                background: 'rgba(255, 184, 0, 0.03)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '14px'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '10px',
                        background: 'rgba(255, 184, 0, 0.16)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--accent-primary)',
                        flexShrink: 0
                      }}>
                        <Bot size={20} />
                      </div>
                      <div>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                          Instalador STIVIE para PC (.BAT)
                        </div>
                        <div style={{ fontSize: '0.73rem', color: 'var(--accent-primary)', fontWeight: 700 }}>
                          Asistente Virtual con IA + Inventario + Control Remoto
                        </div>
                      </div>
                    </div>
                    <span style={{
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      padding: '3px 8px',
                      borderRadius: '6px',
                      background: 'rgba(255, 184, 0, 0.15)',
                      color: 'var(--accent-primary)',
                      border: '1px solid rgba(255, 184, 0, 0.3)'
                    }}>
                      RECOMENDADO
                    </span>
                  </div>

                  <p style={{ fontSize: '0.80rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                    Registra el hardware automáticamente e instala la mascota interactiva <strong>STIVIE.exe</strong> con inicio automático, soporte remoto y acciones rápidas.
                  </p>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {['Inventario Automático', 'Asistente IA', 'Control Remoto', 'Auto-inicio Windows'].map((tag) => (
                      <span key={tag} style={{
                        fontSize: '0.70rem',
                        fontWeight: 600,
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: 'rgba(148, 163, 184, 0.1)',
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--border-acrylic)'
                      }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingTop: '10px', borderTop: '1px solid var(--border-acrylic)' }}>
                  <button
                    type="button"
                    onClick={handleDownloadStivieInstaller}
                    className="btn-flat btn-primary"
                    style={{ width: '100%', justifyContent: 'center', padding: '9px 16px', fontWeight: 800 }}
                  >
                    <Download size={15} />
                    <span>Descargar Instalador STIVIE.bat</span>
                  </button>
                </div>
              </div>

              {/* Tarjeta 2: Script Independiente Portable */}
              <div className="acrylic-card" style={{
                padding: '20px 22px',
                border: '1px solid var(--border-acrylic)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '14px'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '10px',
                        background: 'rgba(16, 185, 129, 0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#10b981',
                        flexShrink: 0
                      }}>
                        <ShieldCheck size={20} />
                      </div>
                      <div>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                          Auditoría Rápida Portable (.BAT)
                        </div>
                        <div style={{ fontSize: '0.73rem', color: '#10b981', fontWeight: 700 }}>
                          100% Portable • Sin Instalación • Registro en 2s
                        </div>
                      </div>
                    </div>
                    <span style={{
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      padding: '3px 8px',
                      borderRadius: '6px',
                      background: 'rgba(16, 185, 129, 0.12)',
                      color: '#10b981',
                      border: '1px solid rgba(16, 185, 129, 0.3)'
                    }}>
                      USB / PORTABLE
                    </span>
                  </div>

                  <p style={{ fontSize: '0.80rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                    Ideal para auditorías rápidas por USB. Extrae CPU, RAM, placa, serie, IP y SO hacia el panel central y finaliza sin dejar archivos instalados.
                  </p>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {['Sin Instalación', 'Ejecución por USB', 'Hardware + Red', 'Cierre Automático'].map((tag) => (
                      <span key={tag} style={{
                        fontSize: '0.70rem',
                        fontWeight: 600,
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: 'rgba(148, 163, 184, 0.1)',
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--border-acrylic)'
                      }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingTop: '10px', borderTop: '1px solid var(--border-acrylic)' }}>
                  <button
                    type="button"
                    onClick={handleDownloadBatch}
                    className="btn-flat"
                    style={{
                      width: '100%',
                      justifyContent: 'center',
                      padding: '9px 16px',
                      fontWeight: 700,
                      borderColor: 'rgba(16, 185, 129, 0.45)',
                      background: 'rgba(16, 185, 129, 0.08)'
                    }}
                  >
                    <Download size={15} color="#10b981" />
                    <span>Descargar tay-audit-agent.bat</span>
                  </button>
                </div>
              </div>

              {/* Tarjeta 3: Comando Rápido PowerShell */}
              <div className="acrylic-card" style={{
                padding: '20px 22px',
                border: '1px solid var(--border-acrylic)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '14px'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '10px',
                        background: 'rgba(255, 184, 0, 0.14)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--accent-primary)',
                        flexShrink: 0
                      }}>
                        <Terminal size={20} />
                      </div>
                      <div>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                          Comando Directo PowerShell
                        </div>
                        <div style={{ fontSize: '0.73rem', color: 'var(--accent-primary)', fontWeight: 700 }}>
                          Ejecución en Consola • Sin Descargar Archivos
                        </div>
                      </div>
                    </div>
                    <span style={{
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      padding: '3px 8px',
                      borderRadius: '6px',
                      background: 'rgba(148, 163, 184, 0.14)',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border-acrylic)'
                    }}>
                      ONE-LINER
                    </span>
                  </div>

                  <p style={{ fontSize: '0.80rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                    Pega este comando en PowerShell o CMD de cualquier PC para auditar y subir su inventario al instante:
                  </p>

                  <pre style={{
                    backgroundColor: 'var(--input-bg)',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    color: 'var(--accent-primary)',
                    overflowX: 'auto',
                    border: '1px solid var(--border-acrylic)',
                    whiteSpace: 'nowrap',
                    fontFamily: 'monospace',
                    margin: 0
                  }}>
                    {psOneLiner}
                  </pre>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingTop: '10px', borderTop: '1px solid var(--border-acrylic)' }}>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(psOneLiner)}
                    className="btn-flat btn-primary"
                    style={{ width: '100%', justifyContent: 'center', padding: '9px 16px', fontWeight: 800 }}
                  >
                    {copiedPs ? <Check size={15} /> : <Copy size={15} />}
                    <span>{copiedPs ? '¡Comando Copiado!' : 'Copiar Comando PowerShell'}</span>
                  </button>
                </div>
              </div>

              {/* Tarjeta 4: App Nativa Móvil Android (.APK) */}
              <div className="acrylic-card" style={{
                padding: '20px 22px',
                border: '1px solid var(--border-acrylic)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '14px'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '10px',
                        background: 'rgba(56, 189, 248, 0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#38bdf8',
                        flexShrink: 0
                      }}>
                        <Smartphone size={20} />
                      </div>
                      <div>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                          App Móvil Android (.APK)
                        </div>
                        <div style={{ fontSize: '0.73rem', color: '#38bdf8', fontWeight: 700 }}>
                          Aplicación Nativa • Escáner QR y Alertas Push
                        </div>
                      </div>
                    </div>
                    <span style={{
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      padding: '3px 8px',
                      borderRadius: '6px',
                      background: 'rgba(56, 189, 248, 0.14)',
                      color: '#38bdf8',
                      border: '1px solid rgba(56, 189, 248, 0.3)'
                    }}>
                      ANDROID
                    </span>
                  </div>

                  <p style={{ fontSize: '0.80rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                    Gestiona el inventario desde teléfonos o tablets con acceso directo a la cámara para lectura de códigos QR y notificaciones sonoras en vivo.
                  </p>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {['Escáner QR Cámara', 'Alertas en Tiempo Real', 'Actualización OTA'].map((tag) => (
                      <span key={tag} style={{
                        fontSize: '0.70rem',
                        fontWeight: 600,
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: 'rgba(148, 163, 184, 0.1)',
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--border-acrylic)'
                      }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingTop: '10px', borderTop: '1px solid var(--border-acrylic)' }}>
                  <a
                    href="/TayAudit.apk"
                    download="TayAudit.apk"
                    className="btn-flat"
                    style={{
                      width: '100%',
                      justifyContent: 'center',
                      padding: '9px 16px',
                      fontWeight: 700,
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      borderColor: 'rgba(56, 189, 248, 0.45)',
                      background: 'rgba(56, 189, 248, 0.08)'
                    }}
                  >
                    <Download size={15} color="#38bdf8" />
                    <span>Descargar TayAudit.apk (5.1 MB)</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Firma del Desarrollador (Exclusivamente en el apartado de STIVIE) */}
        {displayedTab === 'agent' && (
          <DeveloperFooter />
        )}
        </div>
      </main>
      </div>

      {/* Modals */}
      <DeviceModal
        device={selectedDevice}
        initialEditMode={deviceModalInitialEdit}
        currentUserRole={currentUser?.role}
        onClose={handleCloseDeviceModal}
        onDeviceUpdated={(updated) => {
          if (updated) setSelectedDevice(updated);
          setDeviceModalInitialEdit(false);
          loadData();
        }}
        onDeviceDeleted={(deletedId) => {
          setDevices(prev => prev.filter(d => d.id !== deletedId));
          setSelectedDevice(null);
          setDeviceModalInitialEdit(false);
          loadData();
        }}
        onOpenSupportForDevice={() => {
          handleCloseDeviceModal();
          setActiveTab('support');
        }}
      />

      <AuditFormModal
        isOpen={isAuditModalOpen}
        onClose={handleCloseAuditModal}
        onDeviceSaved={loadData}
        prefillCode={scannedCodePrefill}
        fieldPrefill={scannerFieldPrefill}
        onOpenFieldScanner={handleOpenFieldScanner}
      />

      {/* Escáner de Códigos/QR (Antepuesto sobre formularios y modales con z-index superior) */}
      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={handleCloseScannerModal}
        devices={devices}
        onDeviceFound={(d) => {
          handleOpenDeviceModal(d);
        }}
        onNewCodeScanned={(code) => {
          handleOpenAuditModal(code);
        }}
        customTitle={scannerCustomTitle}
        onCustomScan={scannerCustomCallback}
      />

      {/* Alerta Notificación Flotante en Tiempo Real con Sonido y Barra de Progreso */}
      <LiveNotificationToast
        notification={activeToastNotification}
        onClose={() => setActiveToastNotification(null)}
        onAtender={handleSelectNotification}
      />

      {/* Pantalla de Carga y Bienvenida Institucional (Splash Screen - Control Docente steel-pro1) */}
      <SplashScreen minDuration={2200} />
    </div>
  </ErrorBoundary>
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
