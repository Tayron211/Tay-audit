import type { Device, SystemStats, AuditLog } from '../types';

export interface ServerInfo {
  hostname: string;
  primaryIp: string;
  ips: Array<{ address: string; name: string; isWifi: boolean; isEthernet: boolean }>;
  port: number;
  primaryUrl: string;
  isCloud?: boolean;
}

export const CLOUD_DEFAULT_URL = 'https://tay-audit.pages.dev';

export const isNativeCapacitor = (): boolean => {
  if (typeof window === 'undefined') return false;
  const w = window as any;
  if (w.Capacitor && typeof w.Capacitor.isNativePlatform === 'function') {
    return w.Capacitor.isNativePlatform();
  }
  return false;
};

// Detect API base automatically:
// 1. If VITE_API_BASE is set, use it.
// 2. In native Capacitor APK (Android/iOS) or Capacitor webview scheme, ALWAYS connect directly to Cloudflare 24/7 backend.
// 3. If explicit ?local=1 or localStorage flag is present, connect to local Express (port 3001).
// 4. On localhost / 127.0.0.1 without ?local=1, connect directly to Cloudflare 24/7 backend so data stays 100% synchronized.
// 5. On public production web hosting (tay-audit.pages.dev or custom domain), use origin.
export const getApiBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_BASE as string | undefined;
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined') {
    const { protocol, hostname, origin, search } = window.location;
    const params = new URLSearchParams(search);

    // Allow explicit local backend override via ?local=1 or localStorage flag
    if (params.get('local') === '1' || localStorage.getItem('tay_audit_use_local_api') === '1') {
      const devHost = (hostname === 'localhost' || !hostname) ? '127.0.0.1' : hostname;
      return `http://${devHost}:3001`;
    }

    const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0' || hostname === '';
    const isCapacitorScheme = protocol === 'capacitor:' || protocol === 'ionic:' || protocol === 'file:';

    // In native Capacitor APK (Android/iOS) or local web preview without ?local=1,
    // ALWAYS connect directly to the live 24/7 Cloudflare D1 backend
    if (isNativeCapacitor() || isCapacitorScheme || isLocalHost) {
      return CLOUD_DEFAULT_URL;
    }

    // Public HTTPS production domain (e.g. tay-audit.pages.dev or custom corporate domain)
    if (protocol === 'https:' || hostname.endsWith('.pages.dev')) {
      return origin;
    }

    return CLOUD_DEFAULT_URL;
  }

  return CLOUD_DEFAULT_URL;
};

export const API_BASE = getApiBaseUrl();

export const api = {
  // Lightweight real-time sync state check (Cloudflare D1 + local compatible)
  async getSyncState(): Promise<{ ok: boolean; version: string; serverTime?: string }> {
    const res = await fetch(`${API_BASE}/api/sync-state`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Error al consultar estado de sincronización');
    return res.json();
  },

  // Get Server Network & Remote Access IP details
  async getServerInfo(): Promise<ServerInfo> {
    const res = await fetch(`${API_BASE}/api/server-info`);
    if (!res.ok) throw new Error('Error al obtener información de red del servidor');
    return res.json();
  },

  // Fetch all devices
  async getDevices(): Promise<Device[]> {
    const res = await fetch(`${API_BASE}/api/devices`);
    if (!res.ok) throw new Error('Error al obtener equipos');
    return res.json();
  },

  // Get single device
  async getDevice(id: string): Promise<Device> {
    const res = await fetch(`${API_BASE}/api/devices/${id}`);
    if (!res.ok) throw new Error('Error al obtener detalle del equipo');
    return res.json();
  },

  // Create device
  async createDevice(device: Partial<Device>): Promise<Device> {
    const res = await fetch(`${API_BASE}/api/devices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(device),
    });
    if (!res.ok) throw new Error('Error al registrar equipo');
    return res.json();
  },

  // Update device
  async updateDevice(id: string, device: Partial<Device>): Promise<Device> {
    const res = await fetch(`${API_BASE}/api/devices/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(device),
    });
    if (!res.ok) throw new Error('Error al actualizar equipo');
    return res.json();
  },

  // Delete device
  async deleteDevice(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/devices/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Error al eliminar equipo');
  },

  // Trigger remote action (Restart, Shutdown, Screen Mirroring, DisplaySwitch, Remote Desktop)
  async triggerRemoteAction(id: string, action: 'restart' | 'shutdown' | 'screen_assist' | 'display_clone' | 'display_internal' | 'display_extend' | 'display_external' | 'remote_access' | 'launch_stivie', forced = true) {
    const res = await fetch(`${API_BASE}/api/devices/${id}/remote-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, forced }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error ejecutando acción remota');
    return data;
  },



  // Execute corporate remote diagnostic/maintenance command
  async executeRemoteCommand(id: string, command: string) {
    const res = await fetch(`${API_BASE}/api/devices/${id}/remote-command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error ejecutando comando corporativo');
    return data;
  },

  // Toggle STIVIE status (link/unlink from remote console without affecting inventory)
  async toggleStivieStatus(id: string, enabled: boolean) {
    const res = await fetch(`${API_BASE}/api/devices/${id}/stivie`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error actualizando estado STIVIE');
    return data;
  },

  // Check real connection and STIVIE presence (Real read-only diagnosis)
  async checkConnection(id: string): Promise<{
    id: string;
    hostname: string;
    ipAddress: string;
    isStivieActive: boolean;
    secondsSinceLastPing: number | null;
    networkReachable: boolean;
    pingLatencyMs: number | null;
    localProcessRunning: boolean;
    isLocalMachine: boolean;
    statusSummary: string;
  }> {
    const res = await fetch(`${API_BASE}/api/devices/${id}/check-connection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al comprobar conexión');
    return data;
  },

  // Launch STIVIE locally on the host machine
  async launchLocalStivie(): Promise<{ ok: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/api/stivie/launch-local`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al iniciar STIVIE localmente');
    return data;
  },

  // Get stats
  async getStats(): Promise<SystemStats> {
    const res = await fetch(`${API_BASE}/api/stats`);
    if (!res.ok) throw new Error('Error al obtener estadísticas');
    return res.json();
  },

  // Get audit logs
  async getLogs(): Promise<AuditLog[]> {
    const res = await fetch(`${API_BASE}/api/logs`);
    if (!res.ok) throw new Error('Error al obtener registros de auditoría');
    return res.json();
  },

  // URL for RDP file download
  getRdpDownloadUrl(id: string): string {
    return `${API_BASE}/api/devices/${id}/rdp`;
  },

  // URL for Inventory & Audit Excel download
  getInventoryExcelDownloadUrl(): string {
    return `${API_BASE}/api/export/inventory-excel`;
  },

  // Backward compatible alias for inventory Excel
  getExcelDownloadUrl(): string {
    return `${API_BASE}/api/export/inventory-excel`;
  },

  // URL for Support & Tickets Excel download
  getSupportExcelDownloadUrl(): string {
    return `${API_BASE}/api/export/support-excel`;
  },

  // URL for Standalone Audit Batch download (Levantamiento Rápido Sin Instalación)
  getAgentDownloadUrl(): string {
    return `${API_BASE}/api/agent/download`;
  },

  // URL for STIVIE Client Installer (Instalador permanente para el usuario)
  getStivieInstallerUrl(serverUrl?: string): string {
    const base = serverUrl || API_BASE;
    return `${API_BASE}/api/stivie/download?server=${encodeURIComponent(base)}`;
  },

  // GET support tickets
  async getTickets(): Promise<import('../types').SupportTicket[]> {
    const res = await fetch(`${API_BASE}/api/tickets`);
    if (!res.ok) throw new Error('Error al obtener tickets de soporte');
    return res.json();
  },

  // CREATE support ticket
  async createTicket(ticket: Partial<import('../types').SupportTicket>) {
    const res = await fetch(`${API_BASE}/api/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ticket)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al registrar ticket');
    return data;
  },

  // UPDATE ticket status / resolution
  async updateTicket(id: string, updates: Partial<import('../types').SupportTicket>) {
    const res = await fetch(`${API_BASE}/api/tickets/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al actualizar ticket');
    return data;
  },

  // STIVIE AI Chat assistant
  async stivieChat(query: string, hostname?: string, userName?: string) {
    const res = await fetch(`${API_BASE}/api/stivie/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, hostname, userName })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error en asistente STIVIE');
    return data;
  },

  // STIVIE Feedback (Learning)
  async stivieFeedback(knowledgeId: string, wasHelpful: boolean) {
    const res = await fetch(`${API_BASE}/api/stivie/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ knowledgeId, wasHelpful })
    });
    return res.json();
  },

  // STIVIE 1-Click Screen Self-Healing
  async stivieSolveScreen(hostname?: string) {
    const res = await fetch(`${API_BASE}/api/stivie/solve-screen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostname })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al ejecutar duplicación de pantalla');
    return data;
  },

  // GET STIVIE Knowledge Base
  async getStivieKnowledge(): Promise<import('../types').StivieKnowledge[]> {
    const res = await fetch(`${API_BASE}/api/stivie/knowledge`);
    if (!res.ok) throw new Error('Error al obtener base de conocimiento STIVIE');
    return res.json();
  },

  // POST Teach STIVIE
  async teachStivie(knowledge: Partial<import('../types').StivieKnowledge>) {
    const res = await fetch(`${API_BASE}/api/stivie/knowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(knowledge)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al enseñar a STIVIE');
    return data;
  }
};
