export type DeviceType = 'pc' | 'laptop' | 'server' | 'printer' | 'network' | 'monitor' | 'speaker' | 'ecran' | 'other';

export type DeviceStatus = 'instalado' | 'custodia' | 'maintenance' | 'mantenimiento' | 'baja' | 'online' | 'offline' | 'audited';

export interface Device {
  id: string;
  hostname: string;
  deviceType: DeviceType;
  status: DeviceStatus;
  os: string;
  ram: string;
  cpu: string;
  storage: string;
  ipAddress: string;
  macAddress: string;
  serialNumber: string;
  barcode?: string;
  motherboard?: string;
  compatibility?: string;
  brand: string;
  model: string;
  assignedUser: string;
  department: string;
  location: string;
  lastAuditDate: string;
  notes?: string;
  supplies?: string;
  specs?: string;
  qrCodeData?: string;
  stivieInstalled?: boolean | number;
  lastAgentPing?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuditLog {
  id: string;
  deviceId: string;
  hostname: string;
  action: string;
  details: string;
  performedBy: string;
  timestamp: string;
}

export interface SystemStats {
  totalDevices: number;
  onlineCount: number;
  pcCount: number;
  laptopCount: number;
  serverCount: number;
  printerCount: number;
  networkCount: number;
  otherCount: number;
  recentlyAudited: number;
}

export interface SupportTicket {
  id: string;
  deviceId?: string;
  hostname: string;
  userName: string;
  category: string;
  description: string;
  urgency: 'baja' | 'media' | 'alta' | 'critica';
  status: 'abierto' | 'en_progreso' | 'resuelto';
  solutionNotes?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface StivieKnowledge {
  id: string;
  triggerKeywords: string;
  category: string;
  questionPattern: string;
  solutionText: string;
  actionType?: string;
  actionLabel?: string;
  helpfulCount: number;
  learnedFrom: string;
  createdAt: string;
  updatedAt: string;
}
