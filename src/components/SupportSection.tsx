import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Ticket, 
  Brain, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Monitor, 
  User, 
  Sparkles, 
  Plus, 
  ScreenShare, 
  ExternalLink,
  Flame,
  TrendingUp,
  Bot,
  RefreshCw,
  ThumbsUp,
  Power,
  RotateCw,
  Search,
  FileSpreadsheet,
  EyeOff,
  Activity,
  Play,
  Download,
  Copy,
  Check,
  X,
  Terminal
} from 'lucide-react';
import type { SupportTicket, StivieKnowledge, Device } from '../types';
import { api, API_BASE, CLOUD_DEFAULT_URL } from '../services/api';
import { CompactReportCard } from './CompactReportCard';
import { OverlayCard } from './OverlayCard';
import { scrollElementIntoView } from '../utils/autoScroll';
import { CustomSelect, type SelectOption } from './CustomSelect';
import { Pagination } from './Pagination';

const TICKET_CATEGORY_OPTIONS: SelectOption[] = [
  { value: 'Pantalla / Proyector', label: 'Pantalla / Proyector' },
  { value: 'Rendimiento / Lentitud', label: 'Rendimiento / Lentitud' },
  { value: 'Red / Internet / WiFi', label: 'Red / Internet / WiFi' },
  { value: 'Impresoras', label: 'Impresoras' },
  { value: 'Software / Programas', label: 'Software / Programas' },
  { value: 'Hardware / Periféricos', label: 'Hardware / Periféricos' },
  { value: 'Accesos / Permisos', label: 'Accesos / Permisos' },
  { value: 'General', label: 'General' }
];

const TICKET_URGENCY_OPTIONS: SelectOption<'baja' | 'media' | 'alta' | 'critica'>[] = [
  { value: 'baja', label: 'Baja', dotColor: 'var(--accent-emerald)' },
  { value: 'media', label: 'Media', dotColor: 'var(--accent-cyan)' },
  { value: 'alta', label: 'Alta', dotColor: 'var(--accent-amber)' },
  { value: 'critica', label: 'Crítica', dotColor: 'var(--accent-rose)' }
];

const RULE_CATEGORY_OPTIONS: SelectOption[] = [
  { value: 'Pantalla', label: 'Pantalla & Duplicado' },
  { value: 'Red', label: 'Red & Conectividad' },
  { value: 'Rendimiento', label: 'Rendimiento & RAM' },
  { value: 'Impresión', label: 'Impresión' },
  { value: 'Software', label: 'Software & Licencias' },
  { value: 'General', label: 'General' }
];

/** Alto fijo de cada tarjeta colapsada de la Base STIVIE (grilla simétrica). */
const KNOWLEDGE_CARD_HEIGHT = 214;

interface SupportSectionProps {
  tickets: SupportTicket[];
  knowledgeList: StivieKnowledge[];
  devices: Device[];
  onRefresh: () => void;
  onSelectDevice: (device: Device) => void;
  onSwitchToAudit?: () => void;
  serverInfo?: {
    primaryIp?: string;
    primaryUrl?: string;
    ips?: Array<{ address: string; name: string }>;
    hostname?: string;
    isCloud?: boolean;
  } | null;
  effectiveServerUrl?: string;
  initialSubTab?: SupportSubTab;
  targetTicketId?: string | null;
  onClearTargetTicket?: () => void;
}

const VALID_SUBTABS = ['dashboard', 'tickets', 'remote', 'knowledge'] as const;
type SupportSubTab = typeof VALID_SUBTABS[number];

const getInitialSupportSubTab = (): SupportSubTab => {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('subtab') as SupportSubTab;
    if (VALID_SUBTABS.includes(fromUrl)) return fromUrl;
    const fromStorage = localStorage.getItem('tay_audit_support_subtab') as SupportSubTab;
    if (VALID_SUBTABS.includes(fromStorage)) return fromStorage;
  }
  return 'dashboard';
};

export const SupportSection: React.FC<SupportSectionProps> = ({
  tickets,
  knowledgeList,
  devices,
  onRefresh,
  onSelectDevice,
  onSwitchToAudit: _onSwitchToAudit,
  serverInfo,
  effectiveServerUrl,
  initialSubTab,
  targetTicketId,
  onClearTargetTicket
}) => {
  const [supportSubTab, setSupportSubTab] = useState<SupportSubTab>(() => initialSubTab || getInitialSupportSubTab());

  // Sincronizar subtab cuando cambia externamente (ej: clic en "Ver todas" o al llegar de una notificación)
  useEffect(() => {
    if (initialSubTab) {
      setSupportSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  useEffect(() => {
    localStorage.setItem('tay_audit_support_subtab', supportSubTab);
    const params = new URLSearchParams(window.location.search);
    if (params.get('subtab') !== supportSubTab) {
      params.set('subtab', supportSubTab);
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState({ path: newUrl }, '', newUrl);
    }
  }, [supportSubTab]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'abierto' | 'en_progreso' | 'resuelto'>('all');
  const [ticketSearchQuery, setTicketSearchQuery] = useState('');
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Copia y resolución de IP LAN real para PowerShell en estaciones remotas
  const [copiedRemoteCmd, setCopiedRemoteCmd] = useState(false);
  const [localServerInfo, setLocalServerInfo] = useState<{
    primaryIp?: string;
    primaryUrl?: string;
    ips?: Array<{ address: string; name: string }>;
    hostname?: string;
    isCloud?: boolean;
  } | null>(serverInfo || null);

  useEffect(() => {
    if (serverInfo) {
      setLocalServerInfo(serverInfo);
    } else {
      api.getServerInfo().then(setLocalServerInfo).catch(() => {});
    }
  }, [serverInfo]);

  const effectiveLanUrl = useMemo(() => {
    if (effectiveServerUrl && !effectiveServerUrl.includes('localhost') && !effectiveServerUrl.includes('127.0.0.1')) {
      return effectiveServerUrl.replace(/\/+$/, '');
    }
    const info = serverInfo || localServerInfo;
    if (info?.primaryUrl && !info.primaryUrl.includes('localhost') && !info.primaryUrl.includes('127.0.0.1')) {
      return info.primaryUrl.replace(/\/+$/, '');
    }
    if (typeof window !== 'undefined') {
      if (window.location.protocol === 'https:' || window.location.hostname.endsWith('.pages.dev')) {
        return window.location.origin;
      }
      if (info?.primaryIp && info.primaryIp !== '127.0.0.1' && !info.isCloud) {
        return `http://${info.primaryIp}:3001`;
      }
      if (window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        return API_BASE;
      }
    }
    return API_BASE || CLOUD_DEFAULT_URL;
  }, [effectiveServerUrl, serverInfo, localServerInfo]);

  const remotePowerShellCmd = `irm ${effectiveLanUrl}/api/agent/run | iex`;

  const copyRemoteCmd = () => {
    navigator.clipboard.writeText(remotePowerShellCmd);
    setCopiedRemoteCmd(true);
    setTimeout(() => setCopiedRemoteCmd(false), 2000);
  };

  // New ticket creation form state (manual ticket from Support TI panel)
  const [isCreatingTicket, setIsCreatingTicket] = useState(false);
  const [createForm, setCreateForm] = useState<{
    deviceId: string;
    hostname: string;
    userName: string;
    category: string;
    description: string;
    urgency: 'baja' | 'media' | 'alta' | 'critica';
  }>({
    deviceId: '',
    hostname: '',
    userName: '',
    category: 'General',
    description: '',
    urgency: 'media'
  });
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Remote Console states (Desacopla la consola de control remoto del inventario general)
  const [remoteFilterMode, setRemoteFilterMode] = useState<'stivie_only' | 'all'>('stivie_only');

  const stivieDevicesCount = useMemo(() => 
    devices.filter(d => ['pc', 'laptop', 'server'].includes(d.deviceType) && Boolean(d.stivieInstalled)).length,
    [devices]
  );
  const allInteractiveCount = useMemo(() => 
    devices.filter(d => ['pc', 'laptop', 'server'].includes(d.deviceType)).length,
    [devices]
  );

  const interactiveDevices = useMemo(() => {
    const candidates = devices.filter(d => ['pc', 'laptop', 'server'].includes(d.deviceType));
    if (remoteFilterMode === 'stivie_only') {
      return candidates.filter(d => Boolean(d.stivieInstalled));
    }
    return candidates;
  }, [devices, remoteFilterMode]);
  const [selectedRemoteDeviceId, setSelectedRemoteDeviceId] = useState<string>('');
  const [remoteSearch, setRemoteSearch] = useState('');
  const [remoteLoading, setRemoteLoading] = useState<string | null>(null);
  const [rankingMode, setRankingMode] = useState<'hostname' | 'user'>('hostname');

  // Compact card inline expansion state (avoiding modal windows!)
  const [expandedTicketIds, setExpandedTicketIds] = useState<Set<string>>(new Set());
  const [expandedKnowledgeIds, setExpandedKnowledgeIds] = useState<Set<string>>(new Set());

  const toggleExpandTicket = (id: string) => {
    setExpandedTicketIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleExpandKnowledge = (id: string) => {
    setExpandedKnowledgeIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Navegación directa a un ticket específico solicitado externamente (notificaciones)
  useEffect(() => {
    if (targetTicketId) {
      // 1. Asegurar que estamos en la subpestaña de tickets
      setSupportSubTab('tickets');
      // 2. Limpiar filtros de estado y de búsqueda para que no se oculte
      setStatusFilter('all');
      setTicketSearchQuery('');
      // 3. Expandir la tarjeta del ticket
      setExpandedTicketIds(prev => new Set(prev).add(targetTicketId));

      // 4. Desplazamiento suave y efecto de pulso / foco en la tarjeta
      const timer = setTimeout(() => {
        const card = document.getElementById(`ticket-card-${targetTicketId}`);
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          card.style.transition = 'all 0.35s ease';
          card.style.outline = '3px solid var(--accent-primary)';
          card.style.boxShadow = '0 0 26px var(--accent-glow)';
          setTimeout(() => {
            card.style.outline = 'none';
            card.style.boxShadow = 'none';
          }, 3500);
        }
        onClearTargetTicket?.();
      }, 400);

      return () => clearTimeout(timer);
    }
  }, [targetTicketId, onClearTargetTicket]);

  // New rule teach form state
  const [isTeaching, setIsTeaching] = useState(false);
  const [newRule, setNewRule] = useState({
    triggerKeywords: '',
    category: 'General',
    questionPattern: '',
    solutionText: '',
    actionType: 'none',
    actionLabel: ''
  });

  const createTicketFormRef = useRef<HTMLDivElement>(null);
  const teachFormRef = useRef<HTMLFormElement>(null);

  // Auto-scroll cuando se despliega el formulario de crear ticket
  useEffect(() => {
    if (isCreatingTicket && createTicketFormRef.current) {
      scrollElementIntoView(createTicketFormRef.current, { delay: 60 });
    }
  }, [isCreatingTicket]);

  // Auto-scroll cuando se despliega el formulario para enseñar regla a STIVIE
  useEffect(() => {
    if (isTeaching && teachFormRef.current) {
      scrollElementIntoView(teachFormRef.current, { delay: 60 });
    }
  }, [isTeaching]);

  // Support Dashboard Metrics
  const supportMetrics = useMemo(() => {
    const total = tickets.length;
    const abiertos = tickets.filter(t => t.status === 'abierto').length;
    const enProgreso = tickets.filter(t => t.status === 'en_progreso').length;
    const resueltos = tickets.filter(t => t.status === 'resuelto').length;
    const resolucionPct = total > 0 ? Math.round((resueltos / total) * 100) : 0;
    
    // Auto-resolved by STIVIE (mentioning STIVIE, DisplaySwitch, or resolved automatically)
    const stivieResolved = tickets.filter(t => 
      t.status === 'resuelto' && 
      (t.solutionNotes?.toLowerCase().includes('stivie') || 
       t.solutionNotes?.toLowerCase().includes('displayswitch') ||
       t.category?.toLowerCase().includes('pantalla'))
    ).length;

    // Relación de reportes según HOSTNAME
    const hostMap: Record<string, {
      hostname: string;
      total: number;
      abiertos: number;
      resueltos: number;
      categories: Record<string, number>;
      users: Set<string>;
      lastTicketDate: string;
    }> = {};

    tickets.forEach(t => {
      const h = t.hostname || 'DESCONOCIDO';
      if (!hostMap[h]) {
        hostMap[h] = {
          hostname: h,
          total: 0,
          abiertos: 0,
          resueltos: 0,
          categories: {},
          users: new Set(),
          lastTicketDate: t.createdAt
        };
      }
      hostMap[h].total += 1;
      if (t.status === 'abierto' || t.status === 'en_progreso') hostMap[h].abiertos += 1;
      if (t.status === 'resuelto') hostMap[h].resueltos += 1;
      hostMap[h].categories[t.category] = (hostMap[h].categories[t.category] || 0) + 1;
      if (t.userName) hostMap[h].users.add(t.userName);
      if (new Date(t.createdAt) > new Date(hostMap[h].lastTicketDate)) {
        hostMap[h].lastTicketDate = t.createdAt;
      }
    });

    const hostRanking = Object.values(hostMap).map(h => {
      // Find device if exists
      const dev = devices.find(d => d.hostname.toLowerCase() === h.hostname.toLowerCase());
      // Top category
      const topCat = Object.entries(h.categories).sort((a, b) => b[1] - a[1])[0]?.[0] || 'General';
      return {
        ...h,
        device: dev,
        topCat,
        primaryUser: Array.from(h.users)[0] || dev?.assignedUser || 'Usuario',
        ipAddress: dev?.ipAddress || 'Dinámica'
      };
    }).sort((a, b) => b.total - a.total);

    // Relación de reportes según NOMBRE DE USUARIO
    const userMap: Record<string, {
      userName: string;
      total: number;
      abiertos: number;
      resueltos: number;
      categories: Record<string, number>;
      hosts: Set<string>;
      lastTicketDate: string;
    }> = {};

    tickets.forEach(t => {
      const u = t.userName || 'Usuario Sin Identificar';
      if (!userMap[u]) {
        userMap[u] = {
          userName: u,
          total: 0,
          abiertos: 0,
          resueltos: 0,
          categories: {},
          hosts: new Set(),
          lastTicketDate: t.createdAt
        };
      }
      userMap[u].total += 1;
      if (t.status === 'abierto' || t.status === 'en_progreso') userMap[u].abiertos += 1;
      if (t.status === 'resuelto') userMap[u].resueltos += 1;
      userMap[u].categories[t.category] = (userMap[u].categories[t.category] || 0) + 1;
      if (t.hostname) userMap[u].hosts.add(t.hostname);
      if (new Date(t.createdAt) > new Date(userMap[u].lastTicketDate)) {
        userMap[u].lastTicketDate = t.createdAt;
      }
    });

    const userRanking = Object.values(userMap).map(u => {
      const topCat = Object.entries(u.categories).sort((a, b) => b[1] - a[1])[0]?.[0] || 'General';
      return {
        ...u,
        topCat,
        primaryHost: Array.from(u.hosts)[0] || 'Varios equipos'
      };
    }).sort((a, b) => b.total - a.total);

    // Desglose por Categoría
    const catMap: Record<string, number> = {};
    tickets.forEach(t => {
      const c = t.category || 'General';
      catMap[c] = (catMap[c] || 0) + 1;
    });

    const categoryBreakdown = Object.entries(catMap).map(([cat, count]) => ({
      name: cat,
      count,
      percent: total > 0 ? Math.round((count / total) * 100) : 0
    })).sort((a, b) => b.count - a.count);

    // Desglose por Urgencia
    const urgencyCounts = {
      critica: tickets.filter(t => t.urgency === 'critica').length,
      alta: tickets.filter(t => t.urgency === 'alta').length,
      media: tickets.filter(t => t.urgency === 'media').length,
      baja: tickets.filter(t => t.urgency === 'baja').length,
    };

    return {
      total,
      abiertos,
      enProgreso,
      resueltos,
      resolucionPct,
      stivieResolved,
      hostRanking,
      userRanking,
      categoryBreakdown,
      urgencyCounts
    };
  }, [tickets, devices]);

  const handleUpdateStatus = async (ticketId: string, status: 'abierto' | 'en_progreso' | 'resuelto', notes?: string) => {
    try {
      await api.updateTicket(ticketId, { status, solutionNotes: notes });
      setActionFeedback(status === 'resuelto' ? '¡Ticket resuelto y aprendido por STIVIE!' : 'Estado actualizado');
      setTimeout(() => setActionFeedback(null), 3000);
      onRefresh();
    } catch {
      setActionFeedback('Error al actualizar ticket');
      setTimeout(() => setActionFeedback(null), 2000);
    }
  };

  const activeRemoteDevice = useMemo(() => {
    if (selectedRemoteDeviceId) {
      const found = interactiveDevices.find(d => d.id === selectedRemoteDeviceId);
      if (found) return found;
    }
    return interactiveDevices[0] || null;
  }, [interactiveDevices, selectedRemoteDeviceId]);

  // Ticker en vivo cada 2 segundos para evaluar expiración de latidos en tiempo real
  const [clockTick, setClockTick] = useState<number>(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setClockTick(Date.now()), 2000);
    return () => clearInterval(timer);
  }, []);

  // Auto-refresco en vivo cada 6 segundos en la Consola Remota para mantener los latidos de STIVIE en tiempo real
  useEffect(() => {
    const pollTimer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        onRefresh();
      }
    }, 6000);
    return () => clearInterval(pollTimer);
  }, [onRefresh]);

  // Detección REAL de presencia en línea mediante heartbeat de STIVIE (latidos activos en los últimos 60s)
  const isDeviceOnline = (d: Device | null | undefined) => {
    if (!d || !d.stivieInstalled || !d.lastAgentPing) return false;
    const diffSeconds = (clockTick - new Date(d.lastAgentPing).getTime()) / 1000;
    return diffSeconds >= 0 && diffSeconds <= 60; // En línea si STIVIE está instalado y transmitió en los últimos 60s
  };

  // Vincular o retirar máquina de la consola remota sin tocar el inventario físico
  const handleToggleStivie = async (device: Device, enable: boolean) => {
    try {
      await api.toggleStivieStatus(device.id, enable);
      setActionFeedback(enable 
        ? `¡${device.hostname} vinculada a la Consola Remota con éxito!` 
        : `¡${device.hostname} retirada de la Consola Remota! (Permanece en el Inventario)`
      );
      if (onRefresh) onRefresh();
      setTimeout(() => setActionFeedback(null), 3500);
    } catch (err: any) {
      setActionFeedback(err.message || 'Error al actualizar estado de STIVIE');
      setTimeout(() => setActionFeedback(null), 3500);
    }
  };

  // Diagnóstico REAL de conectividad sin simulaciones ni pings falsos
  const [checkingConnection, setCheckingConnection] = useState(false);
  const handleCheckConnection = async (device: Device) => {
    setCheckingConnection(true);
    try {
      const res = await api.checkConnection(device.id);
      setActionFeedback(res.statusSummary);
      if (onRefresh) onRefresh();
      setTimeout(() => setActionFeedback(null), 6000);
    } catch (err: any) {
      setActionFeedback(err.message || 'Error al diagnosticar conexión');
      setTimeout(() => setActionFeedback(null), 5000);
    } finally {
      setCheckingConnection(false);
    }
  };

  const handleExecuteRemoteAction = async (device: Device, action: 'restart' | 'shutdown' | 'screen_assist' | 'display_clone' | 'remote_access' | 'launch_stivie') => {
    if (!device.stivieInstalled && action !== 'remote_access' && action !== 'launch_stivie') {
      setActionFeedback(`Acción no disponible: STIVIE no está instalado en ${device.hostname}. Ejecuta stivie-installer.bat primero.`);
      setTimeout(() => setActionFeedback(null), 4500);
      return;
    }
    setRemoteLoading(action);
    try {
      const res = await api.triggerRemoteAction(device.id, action, true);
      if (action === 'screen_assist' || action === 'display_clone') {
        setActionFeedback(`¡Acción activada: Duplicado de pantalla en ${device.hostname}!`);
      } else if (action === 'remote_access') {
        window.open(api.getRdpDownloadUrl(device.id), '_blank');
        setActionFeedback(`¡Acción activada: Conexión RDP iniciada con ${device.hostname}!`);
      } else if (action === 'restart') {
        setActionFeedback(`¡Acción activada: Reinicio enviado a ${device.hostname}!`);
      } else if (action === 'shutdown') {
        setActionFeedback(`¡Acción activada: Apagado enviado a ${device.hostname}!`);
      } else if (action === 'launch_stivie') {
        setActionFeedback(res.message || `¡Orden de inicio de STIVIE enviada a ${device.hostname}!`);
      }
      setTimeout(() => setActionFeedback(null), 4000);
    } catch (err: any) {
      setActionFeedback(err.message || 'Error al ejecutar acción remota corporativa');
      setTimeout(() => setActionFeedback(null), 3500);
    } finally {
      setRemoteLoading(null);
    }
  };

  const handleDuplicateScreen = async (hostname: string) => {
    try {
      await api.stivieSolveScreen(hostname);
      setActionFeedback(`¡Comando de duplicación nativa enviado a ${hostname}!`);
      setTimeout(() => setActionFeedback(null), 3500);
    } catch {
      setActionFeedback('Error al emitir orden de duplicación');
    }
  };

  const handleTeachRule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.teachStivie(newRule);
      setActionFeedback('¡STIVIE aprendió la nueva respuesta exitosamente!');
      setTimeout(() => setActionFeedback(null), 3000);
      setIsTeaching(false);
      setNewRule({
        triggerKeywords: '',
        category: 'General',
        questionPattern: '',
        solutionText: '',
        actionType: 'none',
        actionLabel: ''
      });
      onRefresh();
    } catch {
      setActionFeedback('Error al registrar conocimiento en STIVIE');
    }
  };

  const handleVoteKnowledge = async (id: string) => {
    try {
      await api.stivieFeedback(id, true);
      setActionFeedback('¡Voto registrado en el cerebro de STIVIE!');
      setTimeout(() => setActionFeedback(null), 2500);
      onRefresh();
    } catch {
      // ignore
    }
  };

  // Create a new support ticket from the IT Support panel (manual creation)
  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreatingTicket(true);
    try {
      await api.createTicket({
        deviceId: createForm.deviceId || undefined,
        hostname: createForm.hostname.trim() || 'DESKTOP-CLIENT',
        userName: createForm.userName.trim() || 'Usuario Local',
        category: createForm.category.trim() || 'General',
        description: createForm.description.trim(),
        urgency: createForm.urgency
      });

      setActionFeedback('Ticket Creado');
      setTimeout(() => setActionFeedback(null), 2500);
      setIsCreatingTicket(false);
      setCreateForm({ deviceId: '', hostname: '', userName: '', category: 'General', description: '', urgency: 'media' });
      onRefresh();
    } catch (err: any) {
      setCreateError(err.message || 'Error al crear el ticket de atención');
    } finally {
      setCreatingTicket(false);
    }
  };

  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      // 1. Filtro por estado
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;

      // 2. Buscador en tiempo real por equipo, usuario, descripción, categoría, solución o ID
      if (ticketSearchQuery.trim()) {
        const q = ticketSearchQuery.toLowerCase().trim();
        const mHost = (t.hostname || '').toLowerCase().includes(q);
        const mUser = (t.userName || '').toLowerCase().includes(q);
        const mDesc = (t.description || '').toLowerCase().includes(q);
        const mCat = (t.category || '').toLowerCase().includes(q);
        const mNotes = (t.solutionNotes || '').toLowerCase().includes(q);
        const mUrgency = (t.urgency || '').toLowerCase().includes(q);
        const mId = (t.id || '').toLowerCase().includes(q);
        return mHost || mUser || mDesc || mCat || mNotes || mUrgency || mId;
      }

      return true;
    });
  }, [tickets, statusFilter, ticketSearchQuery]);

  // Multipagina Numerada para Tickets de Soporte
  const [ticketPage, setTicketPage] = useState(1);
  const [ticketPageSize, setTicketPageSize] = useState(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) return 6;
    return 9;
  });

  useEffect(() => {
    setTicketPage(1);
  }, [statusFilter, ticketSearchQuery]);

  const paginatedTickets = useMemo(() => {
    const start = (ticketPage - 1) * ticketPageSize;
    return filteredTickets.slice(start, start + ticketPageSize);
  }, [filteredTickets, ticketPage, ticketPageSize]);

  const handleTicketPageChange = (newPage: number) => {
    setTicketPage(newPage);
    const topEl = document.getElementById('support-tickets-top');
    if (topEl) {
      topEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Sub-Navigation Strip (Lightweight, no heavy stacked box) */}
      <div 
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px'
        }}
      >
        {/* Sub-Tabs: Dashboard vs Tickets vs STIVIE */}
        <div className="support-subtabs-container">
          <button
            type="button"
            onClick={() => setSupportSubTab('dashboard')}
            className={`nav-tab-btn ${supportSubTab === 'dashboard' ? 'nav-tab-active' : ''}`}
            style={{ fontSize: '0.78rem', padding: '6px 10px', flexShrink: 0, whiteSpace: 'nowrap', justifyContent: 'center' }}
          >
            <LayoutDashboard size={14} style={{ flexShrink: 0 }} />
            <span className="support-tab-desktop-text">Dashboard</span>
            <span className="support-tab-mobile-text">Dashboard</span>
          </button>

          <button
            type="button"
            onClick={() => setSupportSubTab('tickets')}
            className={`nav-tab-btn ${supportSubTab === 'tickets' ? 'nav-tab-active' : ''}`}
            style={{ fontSize: '0.78rem', padding: '6px 10px', flexShrink: 0, whiteSpace: 'nowrap', justifyContent: 'center', position: 'relative' }}
          >
            <Ticket size={14} style={{ flexShrink: 0 }} />
            <span>Tickets ({supportMetrics.abiertos})</span>
            {supportMetrics.abiertos > 0 && (
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: '#ef4444',
                position: 'absolute',
                top: '4px',
                right: '4px'
              }} />
            )}
          </button>

          <button
            type="button"
            onClick={() => setSupportSubTab('remote')}
            className={`nav-tab-btn ${supportSubTab === 'remote' ? 'nav-tab-active' : ''}`}
            style={{ fontSize: '0.78rem', padding: '6px 10px', flexShrink: 0, whiteSpace: 'nowrap', justifyContent: 'center' }}
          >
            <Monitor size={14} style={{ flexShrink: 0 }} />
            <span className="support-tab-desktop-text">Control Remoto</span>
            <span className="support-tab-mobile-text">Remoto</span>
          </button>

          <button
            type="button"
            onClick={() => setSupportSubTab('knowledge')}
            className={`nav-tab-btn ${supportSubTab === 'knowledge' ? 'nav-tab-active' : ''}`}
            style={{ fontSize: '0.78rem', padding: '6px 10px', flexShrink: 0, whiteSpace: 'nowrap', justifyContent: 'center' }}
          >
            <Brain size={14} style={{ flexShrink: 0 }} />
            <span className="support-tab-desktop-text">Base STIVIE ({knowledgeList.length})</span>
            <span className="support-tab-mobile-text">STIVIE ({knowledgeList.length})</span>
          </button>
        </div>
      </div>

      {/* Floating feedback message */}
      {actionFeedback && (
        <div style={{
          position: 'fixed',
          top: '80px',
          right: '24px',
          background: 'var(--accent-primary)',
          color: 'var(--accent-contrast, #000000)',
          padding: '12px 20px',
          borderRadius: '10px',
          fontWeight: 800,
          fontSize: '0.86rem',
          boxShadow: '0 8px 25px rgba(0,0,0,0.4)',
          border: '1.5px solid rgba(0, 0, 0, 0.25)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <Sparkles size={18} color="var(--accent-contrast, #000000)" />
          <span style={{ color: 'var(--accent-contrast, #000000)' }}>{actionFeedback}</span>
        </div>
      )}

      {/* VIEW 1: DEDICATED SUPPORT TI DASHBOARD */}
      {supportSubTab === 'dashboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* TOP 3 SUPPORT METRIC CARDS (Zero Empty Space on Tablet) */}
          <div className="support-kpi-grid">
            {/* KPI 1: Tasa de Resolución de Casos */}
            <div className="acrylic-card" style={{
              padding: '16px 18px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              border: '1px solid var(--border-acrylic)',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
              borderRadius: '12px',
              gap: '10px'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>
                    EFICIENCIA Y RESOLUCIÓN
                  </span>
                  <TrendingUp size={16} color="var(--accent-primary)" />
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>
                    {supportMetrics.resolucionPct}%
                  </span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                    ({supportMetrics.resueltos} de {supportMetrics.total} resueltos)
                  </span>
                </div>

                <div style={{ marginTop: '6px' }}>
                  <div style={{ width: '100%', height: '6px', borderRadius: '3px', backgroundColor: 'rgba(148, 163, 184, 0.15)', overflow: 'hidden' }}>
                    <div style={{
                      width: `${supportMetrics.resolucionPct}%`,
                      height: '100%',
                      backgroundColor: 'var(--accent-primary)',
                      borderRadius: '3px',
                      transition: 'width 0.4s ease'
                    }} />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '10px', fontSize: '0.72rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#ef4444' }}>
                    <AlertTriangle size={13} />
                    <span><strong>{supportMetrics.abiertos}</strong> Abiertos</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#f59e0b' }}>
                    <Clock size={13} />
                    <span><strong>{supportMetrics.enProgreso}</strong> En Proceso</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#10b981' }}>
                    <CheckCircle2 size={13} />
                    <span><strong>{supportMetrics.resueltos}</strong> Solucionados</span>
                  </div>
                </div>
              </div>
            </div>

            {/* KPI 2: Auto-Resolución Inteligente con STIVIE */}
            <div className="acrylic-card" style={{
              padding: '16px 18px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              border: '1px solid var(--border-acrylic)',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
              borderRadius: '12px',
              gap: '10px'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>
                    AUTO-RESOLUCIÓN CON STIVIE
                  </span>
                  <Bot size={16} color="#10b981" />
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>
                    {supportMetrics.stivieResolved}
                  </span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#10b981' }}>
                    Casos Auto-resueltos
                  </span>
                </div>

                <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', margin: '4px 0 0 0', lineHeight: 1.45 }}>
                  Duplicidad de pantalla, spooler y red resueltos en 1-clic sin saturar al soporte técnico.
                </p>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', fontSize: '0.72rem', color: 'var(--accent-primary)', fontWeight: 700 }}>
                  <Brain size={13} />
                  <span>{knowledgeList.length} reglas activas en STIVIE</span>
                </div>
              </div>
            </div>

            {/* KPI 3: Cargas de Trabajo y Nivel de Urgencia */}
            <div className="acrylic-card" style={{
              padding: '16px 18px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              border: '1px solid var(--border-acrylic)',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
              borderRadius: '12px',
              gap: '10px'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>
                    NIVEL DE URGENCIA
                  </span>
                  <Flame size={16} color="#ef4444" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                  <div style={{ background: 'rgba(239, 68, 68, 0.08)', padding: '6px 4px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.62rem', color: '#ef4444', fontWeight: 800 }}>CRÍTICA</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
                      {supportMetrics.urgencyCounts.critica}
                    </div>
                  </div>

                  <div style={{ background: 'rgba(245, 158, 11, 0.08)', padding: '6px 4px', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.2)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.62rem', color: 'var(--accent-amber)', fontWeight: 800 }}>ALTA</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
                      {supportMetrics.urgencyCounts.alta}
                    </div>
                  </div>

                  <div style={{ background: 'rgba(56, 189, 248, 0.08)', padding: '6px 4px', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.2)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.62rem', color: 'var(--accent-cyan)', fontWeight: 800 }}>MEDIA</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
                      {supportMetrics.urgencyCounts.media}
                    </div>
                  </div>

                  <div style={{ background: 'rgba(148, 163, 184, 0.08)', padding: '6px 4px', borderRadius: '8px', border: '1px solid var(--border-acrylic)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', fontWeight: 800 }}>BAJA</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
                      {supportMetrics.urgencyCounts.baja}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* UNIFIED CORRELATION METRIC TABLE: HOSTNAME & USER REPORT RELATIONSHIPS (MOBILE RESPONSIVE) */}
          <div className="acrylic-panel" style={{ padding: '16px 18px', borderRadius: '14px', minWidth: 0, width: '100%' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              marginBottom: '14px',
              paddingBottom: '12px',
              borderBottom: '1px solid var(--border-acrylic)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: rankingMode === 'hostname' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: rankingMode === 'hostname' ? 'var(--accent-cyan)' : '#10b981'
                }}>
                  {rankingMode === 'hostname' ? <Monitor size={17} /> : <User size={17} />}
                </div>
                <div>
                  <h3 style={{ fontSize: '0.94rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    {rankingMode === 'hostname' ? 'Reportes por Estación (Hostname)' : 'Reportes por Usuario'}
                  </h3>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                    {rankingMode === 'hostname' ? 'Equipos con incidencias reportadas en la central' : 'Usuarios que han generado incidencias vía STIVIE'}
                  </p>
                </div>
              </div>

              {/* Segmented Filter Pills */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(148, 163, 184, 0.12)',
                padding: '3px',
                borderRadius: '8px',
                gap: '4px'
              }}>
                <button
                  type="button"
                  onClick={() => setRankingMode('hostname')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    background: rankingMode === 'hostname' ? 'var(--accent-primary)' : 'transparent',
                    color: rankingMode === 'hostname' ? 'var(--accent-contrast, #000000)' : 'var(--text-secondary)',
                    transition: 'all 0.18s ease'
                  }}
                >
                  <Monitor size={12} style={{ display: 'inline', marginRight: '5px', verticalAlign: '-1px' }} />
                  Por Estación ({supportMetrics.hostRanking.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRankingMode('user')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    background: rankingMode === 'user' ? 'var(--accent-primary)' : 'transparent',
                    color: rankingMode === 'user' ? 'var(--accent-contrast, #000000)' : 'var(--text-secondary)',
                    transition: 'all 0.18s ease'
                  }}
                >
                  <User size={12} style={{ display: 'inline', marginRight: '5px', verticalAlign: '-1px' }} />
                  Por Usuario ({supportMetrics.userRanking.length})
                </button>
              </div>
            </div>

            {/* List Rows */}
            {rankingMode === 'hostname' ? (
              supportMetrics.hostRanking.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                  No hay reportes de equipos registrados todavía.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', width: '100%', minWidth: 0 }}>
                  {supportMetrics.hostRanking.slice(0, 8).map((h, idx) => {
                    const resPct = h.total > 0 ? Math.round((h.resueltos / h.total) * 100) : 0;
                    return (
                      <div 
                        key={h.hostname}
                        style={{
                          borderBottom: idx < Math.min(supportMetrics.hostRanking.length, 8) - 1 ? '1px solid var(--border-acrylic)' : 'none',
                          padding: '10px 4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '10px',
                          width: '100%',
                          minWidth: 0
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1, overflow: 'hidden' }}>
                          <div style={{
                            width: '22px',
                            height: '22px',
                            borderRadius: '6px',
                            background: idx === 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(148, 163, 184, 0.1)',
                            color: idx === 0 ? '#ef4444' : 'var(--text-secondary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            flexShrink: 0
                          }}>
                            #{idx + 1}
                          </div>

                          <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                              <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {h.hostname}
                              </span>
                              <span style={{
                                fontSize: '0.6rem',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                backgroundColor: 'rgba(148, 163, 184, 0.12)',
                                color: 'var(--accent-primary)',
                                fontWeight: 700,
                                whiteSpace: 'nowrap',
                                flexShrink: 0
                              }}>
                                {h.topCat}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {h.primaryUser} • <span style={{ fontFamily: 'monospace', color: 'var(--accent-cyan)' }}>{h.ipAddress}</span>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, textAlign: 'right' }}>
                          <div>
                            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                              {h.total} {h.total === 1 ? 'caso' : 'casos'}
                            </div>
                            <div style={{
                              fontSize: '0.62rem',
                              color: h.abiertos > 0 ? '#ef4444' : '#10b981',
                              fontWeight: 700,
                              whiteSpace: 'nowrap'
                            }}>
                              {h.abiertos > 0 ? `${h.abiertos} activos` : '100% resuelto'}
                            </div>
                          </div>

                          <div style={{ width: '38px', height: '5px', borderRadius: '3px', backgroundColor: 'rgba(148, 163, 184, 0.15)', overflow: 'hidden', flexShrink: 0 }} title={`${resPct}% resuelto`}>
                            <div style={{
                              width: `${resPct}%`,
                              height: '100%',
                              backgroundColor: resPct === 100 ? '#10b981' : 'var(--accent-primary)',
                              transition: 'width 0.3s ease'
                            }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              supportMetrics.userRanking.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                  No hay reportes de usuarios registrados todavía.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', width: '100%', minWidth: 0 }}>
                  {supportMetrics.userRanking.slice(0, 8).map((u, idx) => {
                    const resPct = u.total > 0 ? Math.round((u.resueltos / u.total) * 100) : 0;
                    return (
                      <div 
                        key={u.userName}
                        style={{
                          borderBottom: idx < Math.min(supportMetrics.userRanking.length, 8) - 1 ? '1px solid var(--border-acrylic)' : 'none',
                          padding: '10px 4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '10px',
                          width: '100%',
                          minWidth: 0
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1, overflow: 'hidden' }}>
                          <div style={{
                            width: '22px',
                            height: '22px',
                            borderRadius: '6px',
                            background: 'rgba(148, 163, 184, 0.1)',
                            color: 'var(--text-secondary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            flexShrink: 0
                          }}>
                            #{idx + 1}
                          </div>

                          <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                              <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {u.userName}
                              </span>
                              <span style={{
                                fontSize: '0.6rem',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                backgroundColor: 'rgba(148, 163, 184, 0.12)',
                                color: 'var(--accent-secondary, var(--accent-primary))',
                                fontWeight: 700,
                                whiteSpace: 'nowrap',
                                flexShrink: 0
                              }}>
                                {u.topCat}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              Estación: <span style={{ fontFamily: 'monospace', color: 'var(--accent-primary)' }}>{u.primaryHost}</span>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, textAlign: 'right' }}>
                          <div>
                            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                              {u.total} {u.total === 1 ? 'caso' : 'casos'}
                            </div>
                            <div style={{
                              fontSize: '0.62rem',
                              color: u.abiertos > 0 ? '#ef4444' : '#10b981',
                              fontWeight: 700,
                              whiteSpace: 'nowrap'
                            }}>
                              {u.abiertos > 0 ? `${u.abiertos} activos` : '100% resuelto'}
                            </div>
                          </div>

                          <div style={{ width: '38px', height: '5px', borderRadius: '3px', backgroundColor: 'rgba(148, 163, 184, 0.15)', overflow: 'hidden', flexShrink: 0 }} title={`${resPct}% resuelto`}>
                            <div style={{
                              width: `${resPct}%`,
                              height: '100%',
                              backgroundColor: resPct === 100 ? '#10b981' : 'var(--accent-primary)',
                              transition: 'width 0.3s ease'
                            }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>

          {/* METRIC SECTION 3: DESGLOSE POR CATEGORÍA DE FALLA */}
          <div className="acrylic-panel" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '14px' }}>
              Distribución de Incidencias por Tipo / Categoría
            </h3>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px'
            }}>
              {supportMetrics.categoryBreakdown.map(cat => (
                <div 
                  key={cat.name}
                  className="acrylic-card"
                  style={{ padding: '14px' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {cat.name}
                    </span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--accent-primary)', fontFamily: 'monospace' }}>
                      {cat.count} ({cat.percent}%)
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '6px', borderRadius: '3px', backgroundColor: 'rgba(148, 163, 184, 0.15)', overflow: 'hidden' }}>
                    <div style={{
                      width: `${cat.percent}%`,
                      height: '100%',
                      backgroundColor: 'var(--accent-primary)',
                      borderRadius: '3px'
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: TICKET STREAM & RESOLUTION DESK */}
      {supportSubTab === 'tickets' && (
        <div id="support-tickets-top" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Search & Filter Bar */}
          <div className="acrylic-panel" style={{
            padding: '12px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            {/* Buscador de Tickets en Tiempo Real */}
            <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
              <Search
                size={15}
                color="var(--accent-primary)"
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
              />
              <input
                type="text"
                placeholder="Buscar ticket por equipo, usuario reportante, categoría, problema o ID..."
                value={ticketSearchQuery}
                onChange={(e) => setTicketSearchQuery(e.target.value)}
                className="form-input"
                style={{
                  paddingLeft: '36px',
                  paddingRight: ticketSearchQuery ? '38px' : '14px',
                  height: '36px',
                  fontSize: '0.80rem',
                  width: '100%',
                  borderRadius: '8px'
                }}
              />
              {ticketSearchQuery && (
                <button
                  type="button"
                  onClick={() => setTicketSearchQuery('')}
                  className="btn-flat"
                  style={{
                    position: 'absolute',
                    right: '6px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    padding: '3px 8px',
                    fontSize: '0.72rem',
                    borderRadius: '5px',
                    color: 'var(--text-muted)'
                  }}
                  title="Limpiar búsqueda"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Controles de Filtros de Estado y Acciones */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {[
                  { id: 'all', label: `Todos (${supportMetrics.total})` },
                  { id: 'abierto', label: `Abiertos (${supportMetrics.abiertos})` },
                  { id: 'en_progreso', label: `En Progreso (${supportMetrics.enProgreso})` },
                  { id: 'resuelto', label: `Resueltos (${supportMetrics.resueltos})` },
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setStatusFilter(f.id as any)}
                    className={`btn-flat ${statusFilter === f.id ? 'btn-primary' : ''}`}
                    style={{
                      padding: '6px 12px',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      backgroundColor: statusFilter === f.id ? 'var(--accent-primary)' : 'transparent',
                      color: statusFilter === f.id ? 'var(--accent-contrast, #000000)' : 'var(--text-secondary)',
                      borderColor: statusFilter === f.id ? 'var(--accent-primary)' : 'var(--border-acrylic)',
                      boxShadow: 'none'
                    }}
                  >
                    {f.label}
                  </button>
                ))}

                {ticketSearchQuery.trim() && (
                  <span style={{ fontSize: '0.72rem', color: 'var(--accent-primary)', fontWeight: 600, marginLeft: '6px' }}>
                    {filteredTickets.length} {filteredTickets.length === 1 ? 'coincidencia' : 'coincidencias'}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => window.open(api.getSupportExcelDownloadUrl(), '_blank')}
                  className="btn-flat btn-excel"
                  style={{
                    padding: '6px 14px',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    gap: '6px',
                    borderRadius: '8px'
                  }}
                  title="Exportar base completa de reportes y tickets a Excel"
                >
                  <FileSpreadsheet size={14} />
                  <span>Exportar Reportes (Excel)</span>
                </button>

                <button
                  onClick={onRefresh}
                  className="btn-flat"
                  style={{ padding: '6px 12px', fontSize: '0.74rem' }}
                  title="Actualizar tickets en vivo"
                >
                  <RefreshCw size={14} />
                  <span>Actualizar</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsCreatingTicket(true)}
                  className="btn-flat btn-primary"
                  style={{ padding: '6px 14px', fontSize: '0.74rem', fontWeight: 700, gap: '6px' }}
                  title="Registrar un nuevo ticket de atención al usuario"
                >
                  <Plus size={14} />
                  <span>Crear Ticket de Atención</span>
                </button>
              </div>
            </div>
          </div>

          {/* MODAL WINDOW: CREAR NUEVO TICKET DE ATENCION AL USUARIO */}
          {isCreatingTicket && (
            <div className="modal-backdrop-acrylic" style={{ zIndex: 10000, padding: '16px' }}>
              <div
                className="modal-window-acrylic"
                style={{
                  width: '100%',
                  maxWidth: '580px',
                  maxHeight: '92vh',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  borderRadius: '20px',
                  border: '1px solid var(--border-acrylic)',
                  boxShadow: '0 25px 60px rgba(0, 0, 0, 0.45)'
                }}
              >
                {/* Header Fijo */}
                <div style={{
                  padding: '18px 24px',
                  borderBottom: '1px solid var(--border-acrylic)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'var(--bg-canvas)',
                  flexShrink: 0
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
                      <Plus size={20} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                        Nuevo Ticket de Atención al Usuario
                      </h3>
                      <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                        Registra una incidencia de soporte técnico en tiempo real.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsCreatingTicket(false)}
                    aria-label="Cerrar ventana"
                    title="Cerrar ventana"
                    className="modal-close-btn"
                  >
                    <X size={18} strokeWidth={2.4} />
                  </button>
                </div>

                {/* Formulario Scrollable */}
                <form onSubmit={handleCreateTicket} style={{
                  padding: '22px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  overflowY: 'auto'
                }}>
                  {createError && (
                    <div style={{ padding: '10px 14px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.28)', borderRadius: '8px', color: '#f87171', fontSize: '0.78rem' }}>
                      {createError}
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                        Equipo / Hostname *
                      </label>
                      <input
                        required
                        value={createForm.hostname}
                        onChange={(e) => setCreateForm({ ...createForm, hostname: e.target.value })}
                        placeholder="PC-CONTAB-01"
                        className="form-input"
                        style={{ width: '100%', height: '38px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                        Usuario Reporta *
                      </label>
                      <input
                        required
                        value={createForm.userName}
                        onChange={(e) => setCreateForm({ ...createForm, userName: e.target.value })}
                        placeholder="Ej: Arianny García"
                        className="form-input"
                        style={{ width: '100%', height: '38px' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                        Categoría
                      </label>
                      <CustomSelect
                        value={createForm.category}
                        onChange={(val) => setCreateForm({ ...createForm, category: val })}
                        options={TICKET_CATEGORY_OPTIONS}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                        Urgencia
                      </label>
                      <CustomSelect<'baja' | 'media' | 'alta' | 'critica'>
                        value={createForm.urgency}
                        onChange={(val) => setCreateForm({ ...createForm, urgency: val })}
                        options={TICKET_URGENCY_OPTIONS}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Descripción de la incidencia *
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={createForm.description}
                      onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                      placeholder="¿Qué está sucediendo? Describe el problema para que el equipo de TI pueda atenderlo."
                      className="form-input"
                      style={{ width: '100%', minHeight: '88px', resize: 'vertical' }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px', paddingTop: '16px', borderTop: '1px solid var(--border-acrylic)' }}>
                    <button
                      type="button"
                      onClick={() => setIsCreatingTicket(false)}
                      className="btn-flat"
                      style={{ padding: '8px 18px', fontSize: '0.80rem' }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={creatingTicket}
                      className="btn-flat btn-primary"
                      style={{ padding: '8px 20px', fontSize: '0.80rem', fontWeight: 700, gap: '6px' }}
                    >
                      {creatingTicket ? (
                        <>
                          <RefreshCw size={14} className="spin-fast" />
                          <span>Creando...</span>
                        </>
                      ) : (
                        <>
                          <Plus size={14} />
                          <span>Crear Ticket de Atención</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Ticket Cards List */}
          {filteredTickets.length === 0 ? (
            <div className="acrylic-panel" style={{ textAlign: 'center', padding: '50px 20px' }}>
              {ticketSearchQuery.trim() ? (
                <>
                  <Search size={36} color="var(--accent-primary)" style={{ margin: '0 auto 12px', opacity: 0.7 }} />
                  <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '6px' }}>
                    No se encontraron tickets para "{ticketSearchQuery}"
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                    Prueba buscando con otros términos, por hostname, usuario, ID o descripción.
                  </p>
                  <button
                    type="button"
                    onClick={() => setTicketSearchQuery('')}
                    className="btn-flat btn-primary"
                    style={{ padding: '6px 14px', fontSize: '0.74rem', margin: '0 auto' }}
                  >
                    Limpiar Búsqueda
                  </button>
                </>
              ) : (
                <>
                  <CheckCircle2 size={40} color="#10b981" style={{ margin: '0 auto 12px' }} />
                  <h3 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', marginBottom: '6px' }}>
                    No hay incidencias en esta bandeja
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Todos los casos bajo este filtro han sido atendidos correctamente.
                  </p>
                </>
              )}
            </div>
          ) : (
            <>
              <div className="report-recuadros-grid" style={{
                gap: '16px',
                paddingBottom: '40px'
              }}>
                {paginatedTickets.map(ticket => (
                  <CompactReportCard
                    key={ticket.id}
                    ticket={ticket}
                    devices={devices}
                    isExpanded={expandedTicketIds.has(ticket.id)}
                    onToggleExpand={() => toggleExpandTicket(ticket.id)}
                    onUpdateStatus={handleUpdateStatus}
                    onDuplicateScreen={handleDuplicateScreen}
                    onSelectDevice={onSelectDevice}
                  />
                ))}
              </div>

              {/* Controles de Navegación Multipágina Numerada para Tickets */}
              <Pagination
                currentPage={ticketPage}
                totalItems={filteredTickets.length}
                pageSize={ticketPageSize}
                onPageChange={handleTicketPageChange}
                itemName="reportes"
                pageSizeOptions={[6, 9, 18, 36]}
                onPageSizeChange={(newSize) => {
                  setTicketPageSize(newSize);
                  setTicketPage(1);
                }}
              />
            </>
          )}
        </div>
      )}

      {/* VIEW: CONSOLA UNIFICADA DE SOPORTE Y CONTROL REMOTO TI (1-CLIC) */}
      {supportSubTab === 'remote' && (
        <div className="acrylic-panel remote-console-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Header Bar (100% Responsive on Mobile and Tablets) */}
          <div className="remote-console-header">
            <div className="remote-console-title-group">
              <div style={{
                width: '42px',
                height: '42px',
                minWidth: '42px',
                minHeight: '42px',
                aspectRatio: '1 / 1',
                borderRadius: '10px',
                background: 'var(--accent-primary)',
                color: 'var(--accent-contrast, #000000)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 16px var(--accent-glow)',
                flexShrink: 0
              }}>
                <Monitor size={22} color="var(--accent-contrast, #000000)" />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <h3 style={{ fontSize: 'clamp(1rem, 2.5vw, 1.2rem)', fontWeight: 800, color: 'var(--text-primary)', margin: 0, lineHeight: 1.25 }}>
                  Consola de Soporte y Control Remoto TI
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0 0 0', lineHeight: 1.35 }}>
                  Acciones administrativas nativas en 1-clic (Duplicar pantalla, RDP, Reinicio, Apagado) sin interrumpir al usuario.
                </p>
              </div>
            </div>

            <div className="remote-console-search-group">
              <div className="remote-console-search-box">
                <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  value={remoteSearch}
                  onChange={(e) => setRemoteSearch(e.target.value)}
                  placeholder="Buscar PC por nombre, usuario o IP..."
                  className="form-input"
                  style={{ paddingLeft: '34px', height: '38px', fontSize: '0.8rem', width: '100%', boxSizing: 'border-box' }}
                />
              </div>
            </div>
          </div>

          {/* Quick Station Selector Chips (Organized & Fully Responsive with Flex-Wrap) */}
          <div className="remote-stations-selector-wrapper">
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
              marginBottom: '10px'
            }}>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.04em' }}>
                ESTACIONES INTERACTIVAS DISPONIBLES ({interactiveDevices.length}):
              </span>

              {/* Selector de Modo: Solo con STIVIE vs Todo el Inventario */}
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: 'var(--bg-canvas-subtle)',
                padding: '3px',
                borderRadius: '8px',
                border: '1px solid var(--border-acrylic)'
              }}>
                <button
                  type="button"
                  onClick={() => setRemoteFilterMode('stivie_only')}
                  className="btn-flat"
                  style={{
                    padding: '3px 10px',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    fontWeight: remoteFilterMode === 'stivie_only' ? 800 : 600,
                    backgroundColor: remoteFilterMode === 'stivie_only' ? 'var(--accent-primary)' : 'transparent',
                    color: remoteFilterMode === 'stivie_only' ? 'var(--accent-contrast, #000000)' : 'var(--text-secondary)',
                    border: 'none',
                    boxShadow: 'none',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                  title="Mostrar únicamente equipos que tienen el asistente/agente STIVIE instalado"
                >
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                  <span>Solo con STIVIE ({stivieDevicesCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRemoteFilterMode('all')}
                  className="btn-flat"
                  style={{
                    padding: '3px 10px',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    fontWeight: remoteFilterMode === 'all' ? 800 : 600,
                    backgroundColor: remoteFilterMode === 'all' ? 'var(--accent-primary)' : 'transparent',
                    color: remoteFilterMode === 'all' ? 'var(--accent-contrast, #000000)' : 'var(--text-secondary)',
                    border: 'none',
                    boxShadow: 'none',
                    cursor: 'pointer'
                  }}
                  title="Ver todas las PCs y servidores del inventario físico para poder vincularlas"
                >
                  <span>Todo el Inventario ({allInteractiveCount})</span>
                </button>
              </div>
            </div>

            {interactiveDevices.length === 0 ? (
              <div style={{
                padding: '26px 22px',
                borderRadius: '12px',
                border: '1px solid var(--border-acrylic)',
                backgroundColor: 'var(--bg-canvas-subtle)',
                textAlign: 'center',
                color: 'var(--text-secondary)'
              }}>
                <div style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '12px',
                  background: 'rgba(56, 189, 248, 0.12)',
                  color: 'var(--accent-cyan)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px'
                }}>
                  <Monitor size={24} />
                </div>

                <h4 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  No hay estaciones cliente con STIVIE registradas en esta vista
                </h4>
                <p style={{ margin: '0 auto 16px', fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '640px' }}>
                  Para habilitar la consola remota en tiempo real y el diagnóstico asistido por IA, conecta cualquier PC cliente en la red LAN mediante cualquiera de las siguientes opciones:
                </p>

                {/* Opción 1: Comando Ultra-Rápido PowerShell con IP LAN Real */}
                <div style={{
                  maxWidth: '720px',
                  margin: '0 auto 16px',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  background: 'var(--bg-canvas)',
                  border: '1px solid var(--border-acrylic)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}>
                  <div style={{ textAlign: 'left', minWidth: '240px', flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      <Terminal size={14} />
                      <span>Método 1: Comando Directo en PowerShell (Red LAN)</span>
                    </div>
                    <code style={{
                      display: 'block',
                      fontFamily: 'Consolas, monospace',
                      fontSize: '0.82rem',
                      color: 'var(--text-primary)',
                      marginTop: '4px',
                      wordBreak: 'break-all'
                    }}>
                      {remotePowerShellCmd}
                    </code>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
                      Servidor destino detectado: {effectiveLanUrl} (sin localhost)
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={copyRemoteCmd}
                    className="btn-flat"
                    style={{
                      fontSize: '0.76rem',
                      padding: '7px 14px',
                      gap: '6px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      flexShrink: 0
                    }}
                    title="Copiar comando PowerShell con la IP de red local para ejecutarlo en cualquier PC remota"
                  >
                    {copiedRemoteCmd ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                    <span>{copiedRemoteCmd ? '¡Copiado!' : 'Copiar Comando'}</span>
                  </button>
                </div>

                {/* Opción 2: Botones de Acción (Colores invertidos según requerimiento) */}
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  {/* Descargar Instalador STIVIE ahora con estilo PRIMARIO (Destacado) */}
                  <a
                    href={api.getStivieInstallerUrl(effectiveLanUrl)}
                    download="stivie-installer.bat"
                    className="btn-flat btn-primary"
                    style={{
                      fontSize: '0.78rem',
                      padding: '8px 18px',
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontWeight: 700
                    }}
                    title="Descargar instalador permanente en segundo plano configurado con la IP LAN del servidor"
                  >
                    <Download size={14} />
                    <span>Descargar Instalador STIVIE (.bat)</span>
                  </a>

                  {/* Ver Todo el Inventario ahora con estilo SECUNDARIO (btn-flat neutral) */}
                  <button
                    type="button"
                    onClick={() => setRemoteFilterMode('all')}
                    className="btn-flat"
                    style={{
                      fontSize: '0.78rem',
                      padding: '8px 18px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontWeight: 600
                    }}
                    title="Ver todas las computadoras del inventario físico para vincularlas a la consola remota"
                  >
                    <Monitor size={14} />
                    <span>Ver Todo el Inventario ({allInteractiveCount})</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="remote-stations-chips-grid">
                {interactiveDevices
                  .filter(d => 
                    !remoteSearch.trim() || 
                    d.hostname.toLowerCase().includes(remoteSearch.toLowerCase()) ||
                    (d.assignedUser && d.assignedUser.toLowerCase().includes(remoteSearch.toLowerCase())) ||
                    (d.ipAddress && d.ipAddress.includes(remoteSearch))
                  )
                  .map(d => {
                    const isSelected = activeRemoteDevice?.id === d.id;
                    const isOnline = isDeviceOnline(d);

                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => {
                          setSelectedRemoteDeviceId(d.id);
                        }}
                        className={`btn-flat remote-station-chip ${isSelected ? 'btn-primary' : ''}`}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '7px',
                          backgroundColor: isSelected ? 'var(--accent-primary)' : 'var(--bg-canvas-subtle)',
                          color: isSelected ? 'var(--accent-contrast, #000000)' : 'var(--text-primary)',
                          borderColor: isSelected ? 'var(--accent-primary)' : 'var(--border-acrylic)',
                          fontSize: '0.78rem',
                          fontWeight: isSelected ? 800 : 600,
                          boxShadow: 'none',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                        title={`${d.hostname} - ${d.assignedUser || 'Sin usuario'} (${isOnline ? 'En línea (STIVIE activo)' : 'Desconectada (STIVIE inactivo)'})`}
                      >
                        <span style={{
                          width: '7px',
                          height: '7px',
                          borderRadius: '50%',
                          backgroundColor: isOnline ? '#10b981' : '#ef4444',
                          boxShadow: isOnline ? '0 0 6px #10b981' : 'none',
                          flexShrink: 0
                        }} />
                        <span style={{ fontWeight: 700 }}>{d.hostname}</span>
                        {d.assignedUser && (
                          <span style={{ 
                            opacity: 0.82, 
                            fontSize: '0.72rem',
                            maxWidth: '160px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            ({d.assignedUser})
                          </span>
                        )}
                      </button>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Active Workstation Control Center */}
          {activeRemoteDevice ? (
            <div className="active-workstation-panel" style={{
              backgroundColor: 'var(--bg-canvas-subtle)',
              border: '1px solid var(--border-acrylic)',
              borderRadius: '12px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              {/* Station Telemetry Strip */}
              <div className="station-telemetry-strip" style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
                borderBottom: '1px solid var(--border-acrylic)',
                paddingBottom: '14px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '10px',
                    background: 'rgba(56, 189, 248, 0.15)',
                    color: 'var(--accent-cyan)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Monitor size={22} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                        {activeRemoteDevice.hostname}
                      </span>

                      {/* Badge de Estado En Línea / Desconectada / Sin STIVIE */}
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '2.5px 8px',
                        borderRadius: '6px',
                        lineHeight: 1.2,
                        backgroundColor: isDeviceOnline(activeRemoteDevice) 
                          ? 'rgba(16, 185, 129, 0.14)' 
                          : activeRemoteDevice.stivieInstalled 
                          ? 'rgba(239, 68, 68, 0.12)' 
                          : 'rgba(148, 163, 184, 0.14)',
                        color: isDeviceOnline(activeRemoteDevice) 
                          ? 'var(--accent-emerald)' 
                          : activeRemoteDevice.stivieInstalled 
                          ? 'var(--accent-rose)' 
                          : 'var(--text-secondary)',
                        border: isDeviceOnline(activeRemoteDevice) 
                          ? '1px solid rgba(16, 185, 129, 0.35)' 
                          : activeRemoteDevice.stivieInstalled 
                          ? '1px solid rgba(239, 68, 68, 0.3)' 
                          : '1px solid rgba(148, 163, 184, 0.3)'
                      }}>
                        <span style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: isDeviceOnline(activeRemoteDevice) 
                            ? '#10b981' 
                            : activeRemoteDevice.stivieInstalled 
                            ? '#ef4444' 
                            : '#94a3b8',
                          boxShadow: isDeviceOnline(activeRemoteDevice) ? '0 0 6px rgba(16, 185, 129, 0.6)' : 'none',
                          flexShrink: 0
                        }} />
                        <span>
                          {isDeviceOnline(activeRemoteDevice) 
                            ? 'En Línea (STIVIE Conectado)' 
                            : activeRemoteDevice.stivieInstalled 
                            ? 'Desconectada (STIVIE Inactivo)' 
                            : 'Sin STIVIE Instalado'}
                        </span>
                      </span>

                      <span style={{ 
                        fontSize: '0.74rem', 
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {(() => {
                          const brand = (activeRemoteDevice.brand || '').trim();
                          const model = (activeRemoteDevice.model || '').trim();
                          if (!brand) return model || 'Equipo Corporativo';
                          if (!model) return brand;
                          if (model.toLowerCase().startsWith(brand.toLowerCase())) {
                            return model;
                          }
                          return `${brand} ${model}`;
                        })()}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                      <span>Usuario: <strong style={{ color: 'var(--text-primary)' }}>{activeRemoteDevice.assignedUser || 'No asignado'}</strong></span>
                      <span>IP: <strong style={{ color: 'var(--accent-cyan)', fontFamily: 'monospace' }}>{activeRemoteDevice.ipAddress}</strong></span>
                      <span>SO: <strong>{activeRemoteDevice.os}</strong></span>
                      <span>RAM: <strong>{activeRemoteDevice.ram}</strong></span>
                      {activeRemoteDevice.stivieInstalled ? (
                        activeRemoteDevice.lastAgentPing ? (
                          <span>Última Señal: <strong style={{ color: isDeviceOnline(activeRemoteDevice) ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                            {(() => {
                              const sec = Math.max(0, Math.round((clockTick - new Date(activeRemoteDevice.lastAgentPing).getTime()) / 1000));
                              if (sec <= 60) return `Hace ${sec}s (En vivo)`;
                              if (sec < 180) return `Hace ${Math.round(sec / 60)} min (Reciente)`;
                              const min = Math.round(sec / 60);
                              return `Hace ${min} min (Desconectado)`;
                            })()}
                          </strong></span>
                        ) : (
                          <span>Estado STIVIE: <strong style={{ color: 'var(--accent-rose)' }}>Instalado (Sin latidos en vivo)</strong></span>
                        )
                      ) : (
                        <span>Estado STIVIE: <strong style={{ color: 'var(--text-muted)' }}>No instalado (Requiere stivie-installer.bat)</strong></span>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    disabled={checkingConnection}
                    onClick={() => handleCheckConnection(activeRemoteDevice)}
                    className="btn-flat"
                    style={{
                      fontSize: '0.75rem',
                      padding: '6px 12px',
                      color: isDeviceOnline(activeRemoteDevice) ? 'var(--accent-emerald)' : 'var(--text-secondary)',
                      borderColor: isDeviceOnline(activeRemoteDevice) ? 'rgba(16, 185, 129, 0.35)' : 'var(--border-acrylic)'
                    }}
                    title="Comprobar conectividad de red real y presencia del proceso STIVIE sin simulaciones"
                  >
                    <Activity size={13} />
                    <span>{checkingConnection ? 'Diagnosticando red...' : 'Verificar Conexión Real'}</span>
                  </button>

                  {activeRemoteDevice.stivieInstalled ? (
                    <button
                      type="button"
                      onClick={() => handleToggleStivie(activeRemoteDevice, false)}
                      className="btn-flat"
                      style={{ fontSize: '0.75rem', padding: '6px 12px', color: 'var(--text-muted)' }}
                      title="Ocultar de la consola remota sin borrar la máquina del inventario general"
                    >
                      <EyeOff size={13} />
                      <span>Quitar de Consola</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleToggleStivie(activeRemoteDevice, true)}
                      className="btn-flat btn-primary"
                      style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                      title="Vincular a la consola remota de soporte"
                    >
                      <CheckCircle2 size={13} />
                      <span>Vincular a Consola</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onSelectDevice(activeRemoteDevice)}
                    className="btn-flat"
                    style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                    title="Ver ficha técnica completa en el Inventario General"
                  >
                    <ExternalLink size={13} />
                    <span>Ver en Inventario</span>
                  </button>
                </div>
              </div>

              {/* Banner informativo si STIVIE aún no está instalado */}
              {!activeRemoteDevice.stivieInstalled && (
                <div style={{
                  padding: '12px 16px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.28)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', minWidth: '260px', flex: 1 }}>
                    <strong style={{ color: 'var(--accent-amber)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                      <AlertTriangle size={14} />
                      <span>STIVIE no está instalado en {activeRemoteDevice.hostname}:</span>
                    </strong>
                    <span style={{ display: 'block', marginTop: '2px', fontSize: '0.75rem' }}>
                      Este equipo tiene que tener STIVIE instalado para recién emitir la señal de conectado y habilitar las acciones de control remoto en 1-clic.
                    </span>
                  </div>
                  <a
                    href={api.getStivieInstallerUrl()}
                    download="stivie-installer.bat"
                    className="btn-flat btn-primary"
                    style={{ fontSize: '0.74rem', padding: '6px 14px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                  >
                    <Download size={14} />
                    <span>Descargar stivie-installer.bat</span>
                  </a>
                </div>
              )}

              {/* Banner informativo si STIVIE está instalado pero inactivo o cerrado */}
              {activeRemoteDevice.stivieInstalled && !isDeviceOnline(activeRemoteDevice) && (
                <div style={{
                  padding: '12px 16px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.28)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', minWidth: '260px', flex: 1 }}>
                    <strong style={{ color: '#f87171', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                      <AlertTriangle size={14} />
                      <span>STIVIE Inactivo en {activeRemoteDevice.hostname}:</span>
                    </strong>
                    <span style={{ display: 'block', marginTop: '2px', fontSize: '0.75rem' }}>
                      El proceso STIVIE no está transmitiendo pings (fue cerrado o el equipo está suspendido/apagado). Puedes intentar levantarlo remotamente por red LAN o conectar por Escritorio Remoto (RDP).
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      disabled={remoteLoading !== null}
                      onClick={() => handleExecuteRemoteAction(activeRemoteDevice, 'launch_stivie')}
                      className="btn-flat btn-primary"
                      style={{ fontSize: '0.74rem', padding: '6px 14px', gap: '6px', whiteSpace: 'nowrap' }}
                      title="Intenta ejecutar STIVIE en la máquina remota vía WMI/PowerShell"
                    >
                      <Play size={13} />
                      <span>{remoteLoading === 'launch_stivie' ? 'Iniciando...' : 'Lanzar STIVIE Remotamente'}</span>
                    </button>
                    <button
                      type="button"
                      disabled={remoteLoading !== null}
                      onClick={() => handleExecuteRemoteAction(activeRemoteDevice, 'remote_access')}
                      className="btn-flat"
                      style={{ fontSize: '0.74rem', padding: '6px 12px', gap: '6px', whiteSpace: 'nowrap' }}
                      title="Abrir sesión de Escritorio Remoto de Windows para operar la máquina visualmente"
                    >
                      <ExternalLink size={13} />
                      <span>Conectar (RDP)</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 1-Click Action Icon Buttons */}
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.04em', display: 'block', marginBottom: '8px' }}>
                  ACCIONES EN 1-CLIC (ACCESO & CONTROL):
                </span>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  flexWrap: 'wrap'
                }}>
                  {/* Duplicar Pantalla */}
                  <button
                    type="button"
                    disabled={remoteLoading !== null}
                    onClick={() => handleExecuteRemoteAction(activeRemoteDevice, 'display_clone')}
                    className="btn-flat btn-remote btn-remote--primary"
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '10px',
                      padding: 0,
                      justifyContent: 'center',
                      background: 'rgba(139, 92, 246, 0.14)',
                      borderColor: 'rgba(139, 92, 246, 0.4)',
                      color: 'var(--accent-primary)',
                      boxShadow: 'none'
                    }}
                    title="Duplicar Pantalla en 1 clic (Win + P)"
                    aria-label="Duplicar Pantalla (Win + P)"
                  >
                    <ScreenShare size={20} />
                  </button>

                  {/* Acceso Remoto RDP */}
                  <button
                    type="button"
                    disabled={remoteLoading !== null}
                    onClick={() => handleExecuteRemoteAction(activeRemoteDevice, 'remote_access')}
                    className="btn-flat btn-remote btn-remote--cyan"
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '10px',
                      padding: 0,
                      justifyContent: 'center',
                      background: 'rgba(56, 189, 248, 0.14)',
                      borderColor: 'rgba(56, 189, 248, 0.4)',
                      color: 'var(--accent-cyan)',
                      boxShadow: 'none'
                    }}
                    title="Escritorio Remoto Nativo (RDP / mstsc.exe)"
                    aria-label="Escritorio Remoto RDP"
                  >
                    <Monitor size={20} />
                  </button>

                  {/* Reiniciar Equipo */}
                  <button
                    type="button"
                    disabled={remoteLoading !== null}
                    onClick={() => handleExecuteRemoteAction(activeRemoteDevice, 'restart')}
                    className="btn-flat btn-remote btn-remote--amber"
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '10px',
                      padding: 0,
                      justifyContent: 'center',
                      background: 'rgba(245, 158, 11, 0.14)',
                      borderColor: 'rgba(245, 158, 11, 0.4)',
                      color: 'var(--accent-amber)',
                      boxShadow: 'none'
                    }}
                    title="Reiniciar Equipo"
                    aria-label="Reiniciar Equipo"
                  >
                    <RotateCw size={20} />
                  </button>

                  {/* Apagar Equipo */}
                  <button
                    type="button"
                    disabled={remoteLoading !== null}
                    onClick={() => handleExecuteRemoteAction(activeRemoteDevice, 'shutdown')}
                    className="btn-flat btn-remote btn-remote--rose"
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '10px',
                      padding: 0,
                      justifyContent: 'center',
                      background: 'rgba(239, 68, 68, 0.14)',
                      borderColor: 'rgba(239, 68, 68, 0.4)',
                      color: 'var(--accent-rose)',
                      boxShadow: 'none'
                    }}
                    title="Apagar Equipo"
                    aria-label="Apagar Equipo"
                  >
                    <Power size={20} />
                  </button>
                </div>
              </div>
            </div>
          ) : interactiveDevices.length > 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text-muted)' }}>
              <Monitor size={36} color="var(--text-muted)" style={{ margin: '0 auto 10px', display: 'block' }} />
              <div style={{ fontSize: '0.96rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                Selecciona una estación arriba para iniciar el soporte remoto
              </div>
              <div style={{ fontSize: '0.78rem', marginTop: '4px', color: 'var(--text-secondary)' }}>
                Haz clic sobre cualquiera de las {interactiveDevices.length} estaciones disponibles en la barra superior para abrir su consola de operaciones en tiempo real.
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* VIEW 3: STIVIE KNOWLEDGE BASE & ACTIVE AI LEARNING */}
      {supportSubTab === 'knowledge' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* Header & Teach Rule Button */}
          <div className="acrylic-panel" style={{
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Base de Conocimiento y Aprendizaje Autónomo de STIVIE
              </h3>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                STIVIE se alimenta de los tickets resueltos por el equipo de TI y responde autónomamente en las terminales
              </p>
            </div>

            <button
              onClick={() => setIsTeaching(!isTeaching)}
              className="btn-flat btn-primary"
              style={{ padding: '8px 16px', fontSize: '0.78rem' }}
            >
              <Plus size={15} />
              <span>Enseñar Nueva Solución Manualmente</span>
            </button>
          </div>

          {/* MODAL WINDOW: ENSEÑAR NUEVA SOLUCION A STIVIE */}
          {isTeaching && (
            <div className="modal-backdrop-acrylic" style={{ zIndex: 10000, padding: '16px' }}>
              <div
                className="modal-window-acrylic"
                style={{
                  width: '100%',
                  maxWidth: '680px',
                  maxHeight: '92vh',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  borderRadius: '20px',
                  border: '1px solid var(--border-acrylic)',
                  boxShadow: '0 25px 60px rgba(0, 0, 0, 0.45)'
                }}
              >
                {/* Header Fijo */}
                <div style={{
                  padding: '18px 24px',
                  borderBottom: '1px solid var(--border-acrylic)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'var(--bg-canvas)',
                  flexShrink: 0
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
                      <Brain size={20} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                        Entrenar Nuevo Conocimiento en STIVIE
                      </h3>
                      <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                        Alimenta la base de soluciones autónomas para terminales corporativas.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsTeaching(false)}
                    aria-label="Cerrar ventana"
                    title="Cerrar ventana"
                    className="modal-close-btn"
                  >
                    <X size={18} strokeWidth={2.4} />
                  </button>
                </div>

                {/* Formulario Scrollable */}
                <form ref={teachFormRef} onSubmit={handleTeachRule} style={{
                  padding: '22px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  overflowY: 'auto'
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
                    <div>
                      <label className="form-label">Palabras Clave Desencadenantes (separadas por comas) *</label>
                      <input
                        type="text"
                        required
                        placeholder="ej: vpn, conectar, credenciales, token"
                        value={newRule.triggerKeywords}
                        onChange={(e) => setNewRule({ ...newRule, triggerKeywords: e.target.value })}
                        className="form-input"
                        style={{ width: '100%', height: '38px' }}
                      />
                    </div>

                    <div>
                      <label className="form-label">Categoría</label>
                      <CustomSelect
                        value={newRule.category}
                        onChange={(val) => setNewRule({ ...newRule, category: val })}
                        options={RULE_CATEGORY_OPTIONS}
                      />
                    </div>

                    <div style={{ gridColumn: '1 / -1' }}>
                      <label className="form-label">Patrón de Pregunta o Problema *</label>
                      <input
                        type="text"
                        required
                        placeholder="ej: Problemas con acceso a la red privada VPN"
                        value={newRule.questionPattern}
                        onChange={(e) => setNewRule({ ...newRule, questionPattern: e.target.value })}
                        className="form-input"
                        style={{ width: '100%', height: '38px' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="form-label">Respuesta y Solución que dará STIVIE al usuario *</label>
                    <textarea
                      required
                      placeholder="Redacta la explicación clara paso a paso que STIVIE presentará al usuario..."
                      value={newRule.solutionText}
                      onChange={(e) => setNewRule({ ...newRule, solutionText: e.target.value })}
                      className="form-input"
                      style={{ width: '100%', minHeight: '88px', resize: 'vertical' }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px', paddingTop: '16px', borderTop: '1px solid var(--border-acrylic)' }}>
                    <button
                      type="button"
                      onClick={() => setIsTeaching(false)}
                      className="btn-flat"
                      style={{ padding: '8px 18px', fontSize: '0.80rem' }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="btn-flat btn-primary"
                      style={{ padding: '8px 20px', fontSize: '0.80rem', fontWeight: 700 }}
                    >
                      Guardar en Cerebro de STIVIE
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Knowledge Cards Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '16px',
            alignItems: 'start',
            paddingBottom: knowledgeList.some(k => expandedKnowledgeIds.has(k.id)) ? '540px' : '90px'
          }}>
            {knowledgeList.map(rule => {
              const isExpanded = expandedKnowledgeIds.has(rule.id);
              const triggers = rule.triggerKeywords ? rule.triggerKeywords.split(',').map(kw => kw.trim()).filter(Boolean) : [];
              return (
                <OverlayCard key={rule.id} isExpanded={isExpanded} collapsedHeight={KNOWLEDGE_CARD_HEIGHT}>
                    {/* Header: Categoría + Votos + Expandir (siempre visible) */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 16px',
                      borderBottom: '1px solid var(--border-acrylic)',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease',
                      userSelect: 'none',
                      background: isExpanded ? 'rgba(139, 92, 246, 0.05)' : 'transparent'
                    }}
                    onClick={() => toggleExpandKnowledge(rule.id)}
                    onMouseEnter={(e) => { if (!isExpanded) e.currentTarget.style.background = 'rgba(148, 163, 184, 0.08)'; }}
                    onMouseLeave={(e) => { if (!isExpanded) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          fontSize: '0.65rem',
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(139, 92, 246, 0.15)',
                          color: 'var(--accent-primary)'
                        }}>
                          {rule.category}
                        </span>
                        <span style={{
                          fontSize: '0.65rem',
                          color: 'var(--text-muted)',
                          marginLeft: 'auto'
                        }}>
                          {rule.learnedFrom}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleVoteKnowledge(rule.id);
                          }}
                          className="btn-flat"
                          style={{ padding: '4px 8px', fontSize: '0.7rem', gap: '4px' }}
                          title="Votar solución como útil (+1 efectividad)"
                        >
                          <ThumbsUp size={11} color="#10b981" />
                          <span>{rule.helpfulCount} útiles</span>
                        </button>
                        <span style={{
                          fontSize: '0.7rem',
                          color: 'var(--text-muted)',
                          transform: `rotate(${isExpanded ? 180 : 0}deg)`,
                          transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                        }}>
                          ▾
                        </span>
                      </div>
                    </div>

                    {/* Contenido: resumen colapsado, completo al expandir (sin cortes) */}
                    <div style={{
                      padding: '14px 16px 18px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      overflow: 'visible'
                    }}
                    >
                      {/* Pregunta / Patrón - 2 líneas colapsado, completo expandido */}
                      <div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '5px' }}>
                          Problema
                        </div>
                        <h4 style={{
                          fontSize: '0.9rem',
                          fontWeight: 800,
                          color: 'var(--text-primary)',
                          margin: 0,
                          lineHeight: 1.4,
                          wordBreak: 'break-word',
                          overflowWrap: 'anywhere',
                          display: '-webkit-box',
                          WebkitLineClamp: isExpanded ? 'unset' : 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden'
                        }}>
                          {rule.questionPattern}
                        </h4>
                      </div>

                      {/* Solución: 2 líneas colapsado, completa expandido */}
                      <div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                          Solución
                        </div>
                        <p style={{
                          fontSize: '0.8rem',
                          color: 'var(--text-secondary)',
                          lineHeight: 1.5,
                          margin: 0,
                          wordBreak: 'break-word',
                          overflowWrap: 'anywhere',
                          display: '-webkit-box',
                          WebkitLineClamp: isExpanded ? 'unset' : 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden'
                        }}>
                          {rule.solutionText}
                        </p>
                      </div>

                      {/* Contenido extendido: solo visible/interactivo al desplegar */}
                      <div
                        aria-hidden={!isExpanded}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                          opacity: isExpanded ? 1 : 0,
                          transform: isExpanded ? 'translateY(0)' : 'translateY(-6px)',
                          transition: 'opacity 0.35s ease 0.08s, transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                          pointerEvents: isExpanded ? 'auto' : 'none'
                        }}
                      >
                        {/* Categoría + Triggers */}
                        <div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                            Categoría
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            <span
                              style={{
                                fontSize: '0.68rem',
                                padding: '3px 9px',
                                borderRadius: '6px',
                                backgroundColor: 'rgba(2, 132, 199, 0.1)',
                                color: 'var(--accent-cyan)',
                                border: '1px solid rgba(2, 132, 199, 0.25)',
                                fontWeight: 600
                              }}
                            >
                              {rule.category}
                            </span>
                            {triggers.map((kw, i) => (
                              <span
                                key={i}
                                style={{
                                  fontSize: '0.68rem',
                                  padding: '3px 9px',
                                  borderRadius: '6px',
                                  backgroundColor: 'rgba(2, 132, 199, 0.1)',
                                  color: 'var(--accent-cyan)',
                                  border: '1px solid rgba(2, 132, 199, 0.25)',
                                  fontWeight: 600
                                }}
                              >
                                {kw}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Footer: origen y acción */}
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginTop: '4px',
                          paddingTop: '10px',
                          borderTop: '1px solid var(--border-acrylic)',
                          fontSize: '0.65rem',
                          color: 'var(--text-muted)'
                        }}>
                          <span>Origen: {rule.learnedFrom}</span>
                          {rule.actionLabel && (
                            <span style={{ color: '#10b981', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              <Check size={12} />
                              <span>{rule.actionLabel}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                </OverlayCard>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
