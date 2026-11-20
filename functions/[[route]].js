import ExcelJS from 'exceljs';
import { STIVIE_CS_BASE64 } from './_stivieCsSource.js';

// ============================================================================
// TAY-AUDIT + STIVIE: CLOUDFLARE PAGES + D1 GLOBAL EDGE BACKEND (24/7)
// ============================================================================

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Forwarded-Server-Url',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
};

function sanitizeInput(str, maxLen = 2000) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .slice(0, maxLen)
    .trim();
}

function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders
    }
  });
}

function textResponse(body, contentType = 'text/plain; charset=utf-8', status = 200, extraHeaders = {}) {
  return new Response(body, {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': contentType,
      'Cache-Control': 'no-store',
      ...extraHeaders
    }
  });
}

function shortUuid() {
  return crypto.randomUUID().slice(0, 8);
}

function sanitizeHost(input) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!/^[a-zA-Z0-9.\-_]{1,255}$/.test(trimmed)) return null;
  return trimmed;
}

function resolveCloudServerHost(request, url) {
  const qServer = url.searchParams.get('server');
  if (qServer) {
    const s = String(qServer).replace(/\/+$/, '');
    if (!s.includes('localhost') && !s.includes('127.0.0.1')) return s;
  }
  const hdr = request.headers.get('x-forwarded-server-url');
  if (hdr) {
    const h = String(hdr).replace(/\/+$/, '');
    if (!h.includes('localhost') && !h.includes('127.0.0.1')) return h;
  }
  return `${url.protocol}//${url.host}`;
}

let schemaVerified = false;
async function ensureSchema(db) {
  if (schemaVerified) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY, hostname TEXT UNIQUE NOT NULL, deviceType TEXT NOT NULL, status TEXT NOT NULL,
      os TEXT, ram TEXT, cpu TEXT, storage TEXT, ipAddress TEXT, macAddress TEXT, serialNumber TEXT,
      motherboard TEXT, compatibility TEXT, brand TEXT, model TEXT, assignedUser TEXT, department TEXT,
      location TEXT, lastAuditDate TEXT, notes TEXT, supplies TEXT, specs TEXT, qrCodeData TEXT,
      stivieInstalled INTEGER DEFAULT 0, lastAgentPing TEXT, createdAt TEXT, updatedAt TEXT,
      monitorBrand TEXT, monitorModel TEXT, monitorSerial TEXT, monitorSpecs TEXT
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY, deviceId TEXT, hostname TEXT, action TEXT, details TEXT, performedBy TEXT, timestamp TEXT
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS support_tickets (
      id TEXT PRIMARY KEY, deviceId TEXT, hostname TEXT NOT NULL, userName TEXT NOT NULL, category TEXT NOT NULL,
      description TEXT NOT NULL, urgency TEXT DEFAULT 'media', status TEXT DEFAULT 'abierto',
      solutionNotes TEXT, createdAt TEXT, resolvedAt TEXT
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS stivie_knowledge (
      id TEXT PRIMARY KEY, triggerKeywords TEXT NOT NULL, category TEXT NOT NULL, questionPattern TEXT NOT NULL,
      solutionText TEXT NOT NULL, actionType TEXT DEFAULT 'none', actionLabel TEXT,
      helpfulCount INTEGER DEFAULT 0, learnedFrom TEXT DEFAULT 'sistema', createdAt TEXT, updatedAt TEXT
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS agent_commands (
      id TEXT PRIMARY KEY, hostname TEXT NOT NULL, action TEXT NOT NULL, details TEXT, createdAt INTEGER NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS push_subscriptions (
      id TEXT PRIMARY KEY, endpoint TEXT UNIQUE, p256dh TEXT, auth TEXT, userAgent TEXT, createdAt TEXT
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS system_meta (
      key TEXT PRIMARY KEY, value TEXT NOT NULL
    )`),
    db.prepare(`INSERT OR IGNORE INTO system_meta (key, value) VALUES ('last_change_ts', '1')`)
  ]);

  const monitorCols = ['monitorBrand', 'monitorModel', 'monitorSerial', 'monitorSpecs'];
  for (const c of monitorCols) {
    try {
      await db.prepare(`ALTER TABLE devices ADD COLUMN ${c} TEXT`).run();
    } catch {}
  }
  schemaVerified = true;
}

// ----------------------------------------------------------------------------
// WEB PUSH NOTIFICATIONS 24/7 (VAPID RFC 8292 & Web Crypto)
// ----------------------------------------------------------------------------
const VAPID_PUBLIC_KEY = 'BGkSXnXaQ6GLubO9tK0uaFxsBm10mCoHbEjVHY-UsA4g6jC0CNfPrnywmxr_owgO-r2mDTN_3sKWT6Q39x6BrIk';
const VAPID_PRIVATE_JWK = {
  key_ops: ['sign'],
  ext: true,
  kty: 'EC',
  x: 'aRJeddpDoYu5s720rS5oXGwGbXSYKgdsSNUdj5SwDiA',
  y: '6jC0CNfPrnywmxr_owgO-r2mDTN_3sKWT6Q39x6BrIk',
  crv: 'P-256',
  d: 'hYrem2pqrgT6Hn2OGViO3wZzmehDowDxeN8sX_-Oi_A'
};

function b64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

let cachedVapidKey = null;
async function getVapidCryptoKey() {
  if (!cachedVapidKey) {
    cachedVapidKey = await crypto.subtle.importKey(
      'jwk',
      VAPID_PRIVATE_JWK,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign']
    );
  }
  return cachedVapidKey;
}

async function createVapidJwt(aud) {
  const key = await getVapidCryptoKey();
  const header = { typ: 'JWT', alg: 'ES256' };
  const claims = {
    aud: aud,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: 'mailto:soporte@tay-audit.pages.dev'
  };

  const enc = new TextEncoder();
  const headerB64 = b64Url(enc.encode(JSON.stringify(header)));
  const claimsB64 = b64Url(enc.encode(JSON.stringify(claims)));
  const message = enc.encode(`${headerB64}.${claimsB64}`);

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    key,
    message
  );

  return `${headerB64}.${claimsB64}.${b64Url(signature)}`;
}

async function dispatchPushToAllSubscribers(db, ticket) {
  try {
    const { results: subs } = await db.prepare('SELECT * FROM push_subscriptions').all();
    if (!subs || subs.length === 0) return 0;

    const deadEndpoints = [];
    let dispatchedCount = 0;

    await Promise.allSettled(subs.map(async (sub) => {
      try {
        const url = new URL(sub.endpoint);
        const aud = `${url.protocol}//${url.host}`;
        const jwt = await createVapidJwt(aud);

        const res = await fetch(sub.endpoint, {
          method: 'POST',
          headers: {
            'TTL': '86400',
            'Urgency': 'high',
            'Authorization': `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`
          }
        });

        if (res.status === 201 || res.status === 200 || res.status === 202) {
          dispatchedCount++;
        } else if (res.status === 404 || res.status === 410) {
          deadEndpoints.push(sub.endpoint);
        }
      } catch (err) {
        console.warn('FCM dispatch error for subscriber:', sub.endpoint, err);
      }
    }));

    if (deadEndpoints.length > 0) {
      for (const ep of deadEndpoints) {
        try {
          await db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(ep).run();
        } catch {}
      }
    }
    return dispatchedCount;
  } catch (err) {
    console.warn('dispatchPushToAllSubscribers error:', err);
    return 0;
  }
}

let globalSyncVersion = String(Date.now());
let globalCachedDevices = [
  {
    id: 'dev-uco',
    hostname: 'UCO',
    deviceType: 'pc',
    status: 'operativo',
    os: 'Windows 10 Pro (64 bits)',
    ram: '31.9 GB',
    cpu: 'Intel Core i7-6700 CPU @ 3.40GHz',
    storage: 'C: 476 GB total, 101 GB libre',
    ipAddress: '10.144.205.66',
    macAddress: 'DC:4A:3E:7F:2E:8E',
    serialNumber: '2UA6352GGX',
    motherboard: 'HP 802F',
    compatibility: 'Compatible',
    brand: 'HP',
    model: 'HP Z240 Tower Workstation',
    assignedUser: 'Sin Asignar',
    department: 'TI / Operaciones',
    location: 'Red Pública Cloud',
    lastAuditDate: '2026-11-19T15:00:00.000Z',
    notes: 'Levantamiento 1-Clic en Memoria Cloud (irm | iex)',
    monitorBrand: 'Dell',
    monitorModel: 'P2419H',
    monitorSerial: 'CN0F8V2V...',
    monitorSpecs: "24'' Full HD (1920x1080) @ 75Hz",
    stivieInstalled: 1,
    createdAt: '2026-11-19T10:00:00.000Z',
    updatedAt: '2026-11-19T15:00:00.000Z'
  },
  {
    id: 'dev-desktop-b1kjcu3',
    hostname: 'DESKTOP-B1KJCU3',
    deviceType: 'laptop',
    status: 'operativo',
    os: 'Windows 11 Home',
    ram: '7.9 GB',
    cpu: 'Intel Core i5-7200U @ 2.50GHz',
    storage: 'D: (931 GB total, 691 GB libre)',
    ipAddress: '192.168.18.187',
    macAddress: '9C:3D:5B:9B:90:39',
    serialNumber: 'CND80448TH',
    motherboard: 'HP 8330',
    compatibility: 'Compatible',
    brand: 'HP',
    model: 'HP Laptop 15-bs1xx',
    assignedUser: 'Sin Asignar',
    department: 'TI / Operaciones',
    location: 'Red Pública Cloud',
    lastAuditDate: '2026-11-19T14:30:00.000Z',
    notes: 'Laptop móvil directivo.',
    stivieInstalled: 1,
    createdAt: '2026-11-19T10:00:00.000Z',
    updatedAt: '2026-11-19T14:30:00.000Z'
  },
  {
    id: 'dev-ram-656h7',
    hostname: 'RAM-656H7',
    deviceType: 'speaker',
    status: 'operativo',
    os: 'Audio Analógico / BT',
    ram: 'N/A',
    cpu: 'N/A',
    storage: 'N/A',
    ipAddress: '',
    macAddress: '',
    serialNumber: 'HhGjjSnn',
    brand: 'Logitech',
    model: 'Z207 Bluetooth 5.0 + Jack 3.5mm, 10W Pico',
    assignedUser: 'Sin Asignar',
    department: 'Almacén TI / Stock',
    location: 'Almacén TI / Stock',
    lastAuditDate: '2026-11-19T13:00:00.000Z',
    notes: 'Parlantes estéreo bluetooth.',
    stivieInstalled: 0,
    createdAt: '2026-11-19T10:00:00.000Z',
    updatedAt: '2026-11-19T13:00:00.000Z'
  },
  {
    id: 'dev-ram-6567',
    hostname: 'RAM-6567',
    deviceType: 'speaker',
    status: 'operativo',
    os: 'Audio Analógico / BT',
    ram: 'N/A',
    cpu: 'N/A',
    storage: 'N/A',
    ipAddress: '',
    macAddress: '',
    serialNumber: 'HhGjj',
    brand: 'Logitech',
    model: 'Z207 Bluetooth 5.0 + Jack 3.5mm, 10W Pico',
    assignedUser: 'Sin Asignar',
    department: 'Almacén TI / Stock',
    location: 'Almacén TI / Stock',
    lastAuditDate: '2026-11-19T13:00:00.000Z',
    notes: 'Parlantes estéreo bluetooth.',
    stivieInstalled: 0,
    createdAt: '2026-11-19T10:00:00.000Z',
    updatedAt: '2026-11-19T13:00:00.000Z'
  },
  {
    id: 'dev-dell-optiplex',
    hostname: 'HDJDJDHDJDJDJDJ',
    deviceType: 'pc',
    status: 'operativo',
    os: 'Windows 11 Pro',
    ram: '16 GB DDR4',
    cpu: 'Intel Core i5-10500',
    storage: '512 GB SSD NVMe',
    ipAddress: '0.0.0.0',
    macAddress: '',
    serialNumber: 'SN-671975',
    brand: 'Dell',
    model: 'OptiPlex',
    assignedUser: 'Sin Asignar',
    department: 'Sede Principal',
    location: 'Sede Principal',
    lastAuditDate: '2026-11-19T12:00:00.000Z',
    notes: 'Equipo auditado en sede principal.',
    stivieInstalled: 0,
    createdAt: '2026-11-19T10:00:00.000Z',
    updatedAt: '2026-11-19T12:00:00.000Z'
  },
  {
    id: 'dev-123456',
    hostname: '123456',
    deviceType: 'pc',
    status: 'operativo',
    os: 'Windows 10',
    ram: '8 GB',
    cpu: 'Intel Core i5',
    storage: '256 GB SSD',
    ipAddress: '',
    macAddress: '',
    serialNumber: 'SN-123456',
    brand: 'Dell',
    model: 'OptiPlex',
    assignedUser: 'Sin Asignar',
    department: 'Operaciones',
    location: 'Almacén TI',
    lastAuditDate: '2026-11-19T11:00:00.000Z',
    notes: '',
    stivieInstalled: 0,
    createdAt: '2026-11-19T10:00:00.000Z',
    updatedAt: '2026-11-19T11:00:00.000Z'
  },
  {
    id: 'dev-epson-printer',
    hostname: 'EPSON-L3250',
    deviceType: 'printer',
    status: 'operativo',
    os: 'Firmware Epson',
    ram: 'N/A',
    cpu: 'N/A',
    storage: 'N/A',
    ipAddress: '',
    macAddress: '',
    serialNumber: 'SN-EPSON-L3250',
    brand: 'Epson',
    model: 'EcoTank L3250',
    assignedUser: 'Sin Asignar',
    department: 'Operaciones',
    location: 'Almacén TI / Stock',
    lastAuditDate: '2026-11-19T10:00:00.000Z',
    notes: 'Impresora multifuncional de inyección continua.',
    stivieInstalled: 0,
    createdAt: '2026-11-19T10:00:00.000Z',
    updatedAt: '2026-11-19T10:00:00.000Z'
  }
];
let globalCachedTickets = [
  {
    id: 'TCK-0001',
    deviceId: 'dev-uco',
    hostname: 'UCO',
    userName: 'Tayron Salinas',
    category: 'Pantalla',
    description: 'Configuración de monitor Dell secundario y proyector de sala.',
    urgency: 'media',
    status: 'resuelto',
    solutionNotes: 'Se configuró proyección en modo duplicado mediante DisplaySwitch /clone.',
    createdAt: '2026-11-19T09:00:00.000Z',
    resolvedAt: '2026-11-19T09:30:00.000Z'
  },
  {
    id: 'TCK-0002',
    deviceId: 'dev-desktop-b1kjcu3',
    hostname: 'DESKTOP-B1KJCU3',
    userName: 'Coordinación Académica',
    category: 'Red / Internet',
    description: 'Renovación de IP y optimización de conectividad WiFi 5G.',
    urgency: 'alta',
    status: 'resuelto',
    solutionNotes: 'Limpieza de caché DNS ipconfig /flushdns y renovación DHCP.',
    createdAt: '2026-11-19T09:40:00.000Z',
    resolvedAt: '2026-11-19T10:05:00.000Z'
  },
  {
    id: 'TCK-0003',
    deviceId: 'dev-epson-l3250',
    hostname: 'EPSON-L3250',
    userName: 'Mesa de Partes',
    category: 'Impresora',
    description: 'Desbloqueo de cola de impresión atascada.',
    urgency: 'media',
    status: 'resuelto',
    solutionNotes: 'Reinicio de servicio Spooler de Windows y purga de cola.',
    createdAt: '2026-11-19T10:15:00.000Z',
    resolvedAt: '2026-11-19T10:25:00.000Z'
  },
  {
    id: 'TCK-0004',
    deviceId: 'dev-dell-optiplex',
    hostname: 'HDJDJDHDJDJDJDJ',
    userName: 'Laboratorio TI 1',
    category: 'Sistema',
    description: 'Actualización preventiva y verificación de compatibilidad Windows 11.',
    urgency: 'baja',
    status: 'resuelto',
    solutionNotes: 'Equipo compatible con TPM 2.0 y Secure Boot activo.',
    createdAt: '2026-11-19T10:40:00.000Z',
    resolvedAt: '2026-11-19T11:00:00.000Z'
  },
  {
    id: 'TCK-0005',
    deviceId: 'dev-123456',
    hostname: '123456',
    userName: 'Biblioteca Central',
    category: 'Hardware',
    description: 'Mantenimiento preventivo y limpieza de disipador.',
    urgency: 'baja',
    status: 'resuelto',
    solutionNotes: 'Limpieza física y verificación de temperaturas.',
    createdAt: '2026-11-19T11:15:00.000Z',
    resolvedAt: '2026-11-19T11:45:00.000Z'
  },
  {
    id: 'TCK-0006',
    deviceId: 'dev-uco',
    hostname: 'UCO',
    userName: 'Tayron Salinas',
    category: 'Software',
    description: 'Despliegue y verificación de agente virtual STIVIE 24/7.',
    urgency: 'media',
    status: 'resuelto',
    solutionNotes: 'STIVIE.exe instalado en AppData e integrado con inicio de Windows.',
    createdAt: '2026-11-19T12:00:00.000Z',
    resolvedAt: '2026-11-19T12:15:00.000Z'
  },
  {
    id: 'TCK-0007',
    deviceId: 'dev-desktop-b1kjcu3',
    hostname: 'DESKTOP-B1KJCU3',
    userName: 'Dirección de Carrera',
    category: 'Pantalla',
    description: 'Ajuste de resolución y tasa de refresco para presentación ejecutiva.',
    urgency: 'media',
    status: 'resuelto',
    solutionNotes: 'Configurada resolución 1080p @ 60Hz con salida HDMI.',
    createdAt: '2026-11-19T12:30:00.000Z',
    resolvedAt: '2026-11-19T12:45:00.000Z'
  },
  {
    id: 'TCK-0008',
    deviceId: 'dev-epson-l3250',
    hostname: 'EPSON-L3250',
    userName: 'Secretaría Académica',
    category: 'Impresora',
    description: 'Alineación de cabezales y prueba de inyección de tinta.',
    urgency: 'baja',
    status: 'resuelto',
    solutionNotes: 'Patrón de prueba completado al 100% sin rayas.',
    createdAt: '2026-11-19T13:00:00.000Z',
    resolvedAt: '2026-11-19T13:20:00.000Z'
  },
  {
    id: 'TCK-0009',
    deviceId: 'dev-dell-optiplex',
    hostname: 'HDJDJDHDJDJDJDJ',
    userName: 'Soporte Campus',
    category: 'Red / Internet',
    description: 'Diagnóstico de latencia hacia puerta de enlace corporativa.',
    urgency: 'media',
    status: 'resuelto',
    solutionNotes: 'Latencia estabilizada en <1ms hacia gateway local.',
    createdAt: '2026-11-19T13:40:00.000Z',
    resolvedAt: '2026-11-19T13:55:00.000Z'
  },
  {
    id: 'TCK-0010',
    deviceId: 'dev-uco',
    hostname: 'UCO',
    userName: 'Tayron Salinas',
    category: 'Auditoría',
    description: 'Levantamiento automatizado con script 1-clic PowerShell (irm | iex).',
    urgency: 'baja',
    status: 'resuelto',
    solutionNotes: 'Hardware completo registrado en la nube con serial y placa.',
    createdAt: '2026-11-19T14:00:00.000Z',
    resolvedAt: '2026-11-19T14:05:00.000Z'
  },
  {
    id: 'TCK-0011',
    deviceId: 'dev-desktop-b1kjcu3',
    hostname: 'DESKTOP-B1KJCU3',
    userName: 'Auditoría TI',
    category: 'Almacenamiento',
    description: 'Verificación de partición de datos D: con 691 GB libres.',
    urgency: 'baja',
    status: 'resuelto',
    solutionNotes: 'Salud de disco S.M.A.R.T. óptima.',
    createdAt: '2026-11-19T14:20:00.000Z',
    resolvedAt: '2026-11-19T14:35:00.000Z'
  },
  {
    id: 'TCK-0012',
    deviceId: 'dev-123456',
    hostname: '123456',
    userName: 'Laboratorio TI 2',
    category: 'Seguridad',
    description: 'Verificación de políticas de seguridad y antivirus corporativo.',
    urgency: 'media',
    status: 'resuelto',
    solutionNotes: 'Definiciones de seguridad actualizadas.',
    createdAt: '2026-11-19T14:50:00.000Z',
    resolvedAt: '2026-11-19T15:10:00.000Z'
  },
  {
    id: 'TCK-0013',
    deviceId: 'dev-ram-656h7',
    hostname: 'RAM-656H7',
    userName: 'Almacén TI',
    category: 'Periférico',
    description: 'Recepción y etiquetado QR de parlantes Logitech Z207.',
    urgency: 'baja',
    status: 'resuelto',
    solutionNotes: 'Equipo clasificado y custodiado en almacén de stock.',
    createdAt: '2026-11-19T15:20:00.000Z',
    resolvedAt: '2026-11-19T15:30:00.000Z'
  },
  {
    id: 'TCK-0014',
    deviceId: 'dev-ram-6567',
    hostname: 'RAM-6567',
    userName: 'Almacén TI',
    category: 'Periférico',
    description: 'Prueba de audio bluetooth y asignación de código patrimonial.',
    urgency: 'baja',
    status: 'resuelto',
    solutionNotes: 'Audio operativo en ambos canales estéreo.',
    createdAt: '2026-11-19T15:40:00.000Z',
    resolvedAt: '2026-11-19T15:50:00.000Z'
  },
  {
    id: 'TCK-0015',
    deviceId: 'dev-uco',
    hostname: 'UCO',
    userName: 'Tayron Salinas',
    category: 'Asistencia TI',
    description: 'Validación de sincronización bidireccional en tiempo real Web - APK Android.',
    urgency: 'alta',
    status: 'resuelto',
    solutionNotes: 'Canal de datos Cloudflare D1 + memoria activado 100% bidireccional.',
    createdAt: '2026-11-19T16:00:00.000Z',
    resolvedAt: '2026-11-19T16:15:00.000Z'
  }
];

let globalCachedLogs = [
  { id: 'log-01', deviceId: 'dev-uco', hostname: 'UCO', action: 'AUDITORIA_MANUAL', details: 'Levantamiento 1-Clic en Memoria Cloud completado para UCO', performedBy: 'Tayron Salinas', timestamp: '2026-11-19T15:00:00.000Z' },
  { id: 'log-02', deviceId: 'dev-uco', hostname: 'UCO', action: 'STIVIE_CONECTADO', details: 'Agente virtual STIVIE 24/7 enlazado y transmitiendo estado', performedBy: 'STIVIE Cloud', timestamp: '2026-11-19T14:55:00.000Z' },
  { id: 'log-03', deviceId: 'dev-desktop-b1kjcu3', hostname: 'DESKTOP-B1KJCU3', action: 'ACTUALIZACION_AGENTE', details: 'Actualización automática de telemetría y disco D: 691 GB libre', performedBy: 'Agente Tay-Audit', timestamp: '2026-11-19T14:30:00.000Z' },
  { id: 'log-04', deviceId: 'dev-uco', hostname: 'UCO', action: 'TICKET_RESUELTO', details: 'Ticket TCK-0015 resuelto satisfactoriamente', performedBy: 'Tayron Salinas', timestamp: '2026-11-19T14:15:00.000Z' },
  { id: 'log-05', deviceId: 'dev-ram-656h7', hostname: 'RAM-656H7', action: 'INGRESO_INVENTARIO', details: 'Parlantes Logitech Z207 registrados en stock', performedBy: 'Auditor TI', timestamp: '2026-11-19T14:00:00.000Z' },
  { id: 'log-06', deviceId: 'dev-ram-6567', hostname: 'RAM-6567', action: 'INGRESO_INVENTARIO', details: 'Parlantes Logitech Z207 registrados en stock', performedBy: 'Auditor TI', timestamp: '2026-11-19T13:45:00.000Z' },
  { id: 'log-07', deviceId: 'dev-dell-optiplex', hostname: 'HDJDJDHDJDJDJDJ', action: 'MODIFICACION_MANUAL', details: 'Actualización de especificaciones Core i5 y 16 GB DDR4', performedBy: 'Administrador TI', timestamp: '2026-11-19T13:30:00.000Z' },
  { id: 'log-08', deviceId: 'dev-123456', hostname: '123456', action: 'AUDITORIA_MANUAL', details: 'Verificación de equipo Dell OptiPlex en Biblioteca', performedBy: 'Auditor TI', timestamp: '2026-11-19T13:10:00.000Z' },
  { id: 'log-09', deviceId: 'dev-epson-l3250', hostname: 'EPSON-L3250', action: 'AUDITORIA_MANUAL', details: 'Registro de impresora EcoTank L3250 en almacén', performedBy: 'Auditor TI', timestamp: '2026-11-19T12:50:00.000Z' },
  { id: 'log-10', deviceId: 'dev-uco', hostname: 'UCO', action: 'REMOTE_DISPLAY_CLONE', details: 'Pantalla configurada en modo duplicado vía STIVIE Cloud', performedBy: 'Tayron Salinas', timestamp: '2026-11-19T12:30:00.000Z' },
  { id: 'log-11', deviceId: 'dev-uco', hostname: 'UCO', action: 'MONITOR_ASOCIADO', details: 'Monitor Dell P2419H vinculado a estación UCO', performedBy: 'Tayron Salinas', timestamp: '2026-11-19T12:15:00.000Z' },
  { id: 'log-12', deviceId: 'dev-desktop-b1kjcu3', hostname: 'DESKTOP-B1KJCU3', action: 'AUDITORIA_MANUAL', details: 'Levantamiento de laptop directiva completado', performedBy: 'Auditor TI', timestamp: '2026-11-19T12:00:00.000Z' },
  { id: 'log-13', deviceId: 'dev-uco', hostname: 'UCO', action: 'TICKET_CREADO', details: 'Incidencia TCK-0010 creada para UCO', performedBy: 'Tayron Salinas', timestamp: '2026-11-19T11:45:00.000Z' },
  { id: 'log-14', deviceId: 'dev-dell-optiplex', hostname: 'HDJDJDHDJDJDJDJ', action: 'CAMBIO_ESTADO', details: 'Estado establecido en Operativo', performedBy: 'Administrador TI', timestamp: '2026-11-19T11:30:00.000Z' },
  { id: 'log-15', deviceId: 'dev-123456', hostname: '123456', action: 'CAMBIO_ESTADO', details: 'Estado establecido en Operativo', performedBy: 'Administrador TI', timestamp: '2026-11-19T11:15:00.000Z' },
  { id: 'log-16', deviceId: 'dev-epson-l3250', hostname: 'EPSON-L3250', action: 'TICKET_RESUELTO', details: 'Ticket TCK-0008 resuelto satisfactoriamente', performedBy: 'Técnico Soporte', timestamp: '2026-11-19T11:00:00.000Z' },
  { id: 'log-17', deviceId: 'dev-desktop-b1kjcu3', hostname: 'DESKTOP-B1KJCU3', action: 'TICKET_RESUELTO', details: 'Ticket TCK-0007 resuelto', performedBy: 'Técnico Soporte', timestamp: '2026-11-19T10:45:00.000Z' },
  { id: 'log-18', deviceId: 'dev-uco', hostname: 'UCO', action: 'TICKET_RESUELTO', details: 'Ticket TCK-0006 resuelto', performedBy: 'Tayron Salinas', timestamp: '2026-11-19T10:30:00.000Z' },
  { id: 'log-19', deviceId: 'dev-123456', hostname: '123456', action: 'TICKET_RESUELTO', details: 'Ticket TCK-0005 resuelto', performedBy: 'Técnico Soporte', timestamp: '2026-11-19T10:15:00.000Z' },
  { id: 'log-20', deviceId: 'dev-dell-optiplex', hostname: 'HDJDJDHDJDJDJDJ', action: 'TICKET_RESUELTO', details: 'Ticket TCK-0004 resuelto', performedBy: 'Técnico Soporte', timestamp: '2026-11-19T10:00:00.000Z' },
  { id: 'log-21', deviceId: 'dev-epson-l3250', hostname: 'EPSON-L3250', action: 'TICKET_RESUELTO', details: 'Ticket TCK-0003 resuelto', performedBy: 'Técnico Soporte', timestamp: '2026-11-19T09:45:00.000Z' },
  { id: 'log-22', deviceId: 'dev-desktop-b1kjcu3', hostname: 'DESKTOP-B1KJCU3', action: 'TICKET_RESUELTO', details: 'Ticket TCK-0002 resuelto', performedBy: 'Técnico Soporte', timestamp: '2026-11-19T09:30:00.000Z' },
  { id: 'log-23', deviceId: 'dev-uco', hostname: 'UCO', action: 'TICKET_RESUELTO', details: 'Ticket TCK-0001 resuelto', performedBy: 'Tayron Salinas', timestamp: '2026-11-19T09:15:00.000Z' },
  { id: 'log-24', deviceId: 'dev-uco', hostname: 'UCO', action: 'QR_GENERADO', details: 'Código QR corporativo generado para UCO', performedBy: 'Sistema UPN', timestamp: '2026-11-19T09:00:00.000Z' },
  { id: 'log-25', deviceId: 'dev-desktop-b1kjcu3', hostname: 'DESKTOP-B1KJCU3', action: 'QR_GENERADO', details: 'Código QR corporativo generado para DESKTOP-B1KJCU3', performedBy: 'Sistema UPN', timestamp: '2026-11-19T08:50:00.000Z' },
  { id: 'log-26', deviceId: 'dev-dell-optiplex', hostname: 'HDJDJDHDJDJDJDJ', action: 'QR_GENERADO', details: 'Código QR corporativo generado para HDJDJDHDJDJDJDJ', performedBy: 'Sistema UPN', timestamp: '2026-11-19T08:40:00.000Z' },
  { id: 'log-27', deviceId: 'dev-123456', hostname: '123456', action: 'QR_GENERADO', details: 'Código QR corporativo generado para 123456', performedBy: 'Sistema UPN', timestamp: '2026-11-19T08:30:00.000Z' },
  { id: 'log-28', deviceId: 'dev-epson-l3250', hostname: 'EPSON-L3250', action: 'QR_GENERADO', details: 'Código QR corporativo generado para EPSON-L3250', performedBy: 'Sistema UPN', timestamp: '2026-11-19T08:20:00.000Z' },
  { id: 'log-29', deviceId: 'dev-uco', hostname: 'UCO', action: 'SINCRONIZACION_INICIAL', details: 'Sincronización inicial del sistema de inventario y soporte 24/7', performedBy: 'Tayron Salinas', timestamp: '2026-11-19T08:00:00.000Z' }
];

async function touchSyncVersion(db) {
  const ts = String(Date.now());
  globalSyncVersion = ts;
  try {
    if (db) {
      await db.prepare(
        `INSERT INTO system_meta (key, value) VALUES ('last_change_ts', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      ).bind(ts).run();
    }
  } catch (err) {
    console.warn('[Sync Version DB Write Ignored - Quota]:', err?.message);
  }
  return ts;
}

async function queueAgentCommand(db, hostname, action, details = {}) {
  if (!hostname) return null;
  const key = hostname.toUpperCase().trim();
  const id = `cmd_${Date.now()}_${shortUuid()}`;
  const nowMs = Date.now();
  await db.prepare(
    `INSERT INTO agent_commands (id, hostname, action, details, createdAt) VALUES (?, ?, ?, ?, ?)`
  ).bind(id, key, action, JSON.stringify(details), nowMs).run();
  return { id, action, details, timestamp: nowMs };
}

async function getAndClearAgentCommands(db, hostname) {
  if (!hostname) return [];
  const key = hostname.toUpperCase().trim();
  // Clean stale commands older than 5 minutes & fetch pending
  const cutoff = Date.now() - 300000;
  const { results } = await db.prepare(
    `SELECT id, action, details, createdAt FROM agent_commands WHERE hostname = ? AND createdAt >= ? ORDER BY createdAt ASC LIMIT 10`
  ).bind(key, cutoff).all();

  if (results && results.length > 0) {
    await db.prepare(`DELETE FROM agent_commands WHERE hostname = ?`).bind(key).run();
    return results.map(r => {
      let parsed = {};
      try { parsed = r.details ? JSON.parse(r.details) : {}; } catch {}
      return { id: r.id, action: r.action, details: parsed, timestamp: r.createdAt };
    });
  }
  return [];
}

async function getNextTicketId(db) {
  let tickets = globalCachedTickets || [];
  try {
    if (db) {
      const { results } = await db.prepare('SELECT id FROM support_tickets').all();
      if (results && results.length > 0) tickets = results;
    }
  } catch (err) {
    console.warn('[D1 Ticket ID Fallback]:', err?.message);
  }
  let maxNum = 0;
  for (const r of (tickets || [])) {
    if (!r.id) continue;
    const match = String(r.id).match(/^TCK-(\d+)$/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  }
  return `TCK-${String(maxNum + 1).padStart(4, '0')}`;
}

// ============================================================================
// POWERSHELL COLLECTOR & STIVIE CLOUD INSTALLER GENERATORS (TLS 1.2 + HTTPS)
// ============================================================================

function generateHardwareCollectorPsScript(apiBase, notesContext = 'Levantamiento de Inventario', isSilent = false) {
  return `
$ProgressPreference = 'SilentlyContinue'
$ErrorActionPreference = 'SilentlyContinue'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}

try {
    $bios = (Get-CimInstance Win32_BIOS -ErrorAction SilentlyContinue).SerialNumber
    $serialNumber = if ($bios -and $bios.Trim() -ne '' -and $bios.Trim() -ne 'None') { $bios.Trim() } else { "SN-DESCONOCIDO" }

    $mb = Get-CimInstance Win32_BaseBoard -ErrorAction SilentlyContinue
    $moboMfr = if ($mb.Manufacturer) { $mb.Manufacturer.Trim() } else { '' }
    $moboProd = if ($mb.Product) { $mb.Product.Trim() } else { '' }
    $mobo = if ($moboMfr -or $moboProd) { (($moboMfr -replace '\\s+',' ') + ' ' + $moboProd).Trim() } else { 'Desconocida' }

    $osInfo = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue
    $os = if ($osInfo) { "$($osInfo.Caption) ($($osInfo.OSArchitecture))" } else { "Windows" }

    $cs = Get-CimInstance Win32_ComputerSystem -ErrorAction SilentlyContinue
    $ramGB = if ($cs.TotalPhysicalMemory) { [math]::Round($cs.TotalPhysicalMemory / 1GB, 1) } else { 0 }
    $ram = "$ramGB GB"

    $proc = Get-CimInstance Win32_Processor -ErrorAction SilentlyContinue | Select-Object -First 1
    $cpu = if ($proc) { $proc.Name.Trim() } else { "CPU Generico" }

    $diskList = @()
    try {
        $internalDisks = Get-Disk -ErrorAction Stop | Where-Object { 
            $_.BusType -notmatch '(?i)USB|SD|MMC|Bluetooth' -and $_.OperationalStatus -match '(?i)OK|Online'
        }
        foreach ($d in $internalDisks) {
            $parts = Get-Partition -DiskNumber $d.Number -ErrorAction SilentlyContinue | Where-Object { $_.DriveLetter }
            $addedAny = $false
            foreach ($p in $parts) {
                $vol = Get-Volume -DriveLetter $p.DriveLetter -ErrorAction SilentlyContinue
                if ($vol -and $vol.Size -gt 0) {
                    $sGB = [math]::Round($vol.Size / 1GB, 0)
                    $fGB = [math]::Round($vol.SizeRemaining / 1GB, 0)
                    $diskList += "$($p.DriveLetter): ($sGB GB total, $fGB GB libre)"
                    $addedAny = $true
                }
            }
            if (-not $addedAny -and $d.Size -gt 0) {
                $rawGB = [math]::Round($d.Size / 1GB, 0)
                $diskList += "$($d.FriendlyName) ($rawGB GB SATA/NVMe)"
            }
        }
    } catch {
        $logicalDisks = Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" -ErrorAction SilentlyContinue
        foreach ($ld in $logicalDisks) {
            if ($ld.Size -and $ld.Size -gt 0) {
                $sGB = [math]::Round($ld.Size / 1GB, 0)
                $fGB = [math]::Round($ld.FreeSpace / 1GB, 0)
                $diskList += "$($ld.DeviceID) ($sGB GB total, $fGB GB libre)"
            }
        }
    }
    $storage = if ($diskList.Count -gt 0) { ($diskList | Select-Object -Unique) -join " | " } else { "No detectado" }

    $netConfigs = Get-CimInstance Win32_NetworkAdapterConfiguration -ErrorAction SilentlyContinue | Where-Object { $_.IPEnabled }
    $primaryNet = $netConfigs | Where-Object { $_.DefaultIPGateway -ne $null } | Select-Object -First 1
    if (-not $primaryNet) { $primaryNet = $netConfigs | Select-Object -First 1 }

    $ip = "127.0.0.1"
    $mac = "00:00:00:00:00:00"
    $netDesc = "Adaptador de Red"
    if ($primaryNet) {
        $foundIP = $primaryNet.IPAddress | Where-Object { $_ -match '^\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}$' } | Select-Object -First 1
        if ($foundIP) { $ip = $foundIP }
        if ($primaryNet.MACAddress) { $mac = $primaryNet.MACAddress.ToUpper() }
        if ($primaryNet.Description) { $netDesc = $primaryNet.Description }
    }

    $tpm = try { [bool](Get-CimInstance -Namespace root/cimv2/security/microsofttpm -ClassName Win32_Tpm -ErrorAction SilentlyContinue).SpecVersion } catch { $false }
    $comp = if (($os -like '*Windows 11*') -or $tpm) { 'Compatible' } else { 'No Compatible' }

    $enclosure = Get-CimInstance Win32_SystemEnclosure -ErrorAction SilentlyContinue
    $battery = Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue
    $sysMfg = if ($cs.Manufacturer) { $cs.Manufacturer.Trim() } else { '' }
    $sysModel = if ($cs.Model) { $cs.Model.Trim() } else { '' }

    $deviceType = 'pc'
    $brand = 'Generico'
    $model = 'Estacion de Trabajo'
    $categoryLabel = 'PC de Escritorio'
    $classificationDetail = ''

    if ($osInfo.ProductType -eq 2 -or $osInfo.ProductType -eq 3 -or $cs.PCSystemType -eq 7 -or $env:COMPUTERNAME -match '^(SRV|SERVER)') {
        $deviceType = 'server'
        $categoryLabel = 'Servidor Dedicado'
        $brand = if ($sysMfg) { $sysMfg } else { 'Servidor' }
        $model = if ($sysModel) { $sysModel } else { 'Rack / Tower' }
        $classificationDetail = "Servidor Corporativo ($brand $model)"
    } else {
        $isLaptop = $false
        $laptopChassis = @(8, 9, 10, 11, 12, 14, 18, 21, 30, 31, 32)
        if ($enclosure.ChassisTypes) {
            foreach ($c in $enclosure.ChassisTypes) {
                if ($laptopChassis -contains $c) { $isLaptop = $true }
            }
        }
        if ($cs.PCSystemType -eq 2) { $isLaptop = $true }
        if ($battery) { $isLaptop = $true }
        if ($sysModel -match '(Laptop|Notebook|Book|ThinkPad|EliteBook|ProBook|Latitude|Inspiron|IdeaPad|ZenBook|MacBook|Pavilion|Spectre|Envy)') { $isLaptop = $true }

        if ($isLaptop) {
            $deviceType = 'laptop'
            $categoryLabel = 'Laptop / Portatil'
            $brand = if ($sysMfg -and $sysMfg -notmatch 'To Be Filled') { $sysMfg } else { 'Laptop' }
            $model = if ($sysModel -and $sysModel -notmatch 'System Product') { $sysModel } else { 'Portatil' }
            $classificationDetail = "Laptop / Portatil ($brand $model)"
        } else {
            $deviceType = 'pc'
            $genericStrings = @('To Be Filled By O.E.M.', 'System manufacturer', 'System Product Name', 'Default string', 'All Series', 'None', '', 'OEM', 'Generic')
            $oemBrandsList = @('Dell', 'HP', 'Hewlett-Packard', 'Lenovo', 'Acer', 'Apple', 'Fujitsu', 'Compaq', 'Gateway', 'Toshiba', 'NEC')
            $isOemMatch = $false
            foreach ($oem in $oemBrandsList) {
                if ($sysMfg -match $oem -and $genericStrings -notcontains $sysMfg -and $genericStrings -notcontains $sysModel) {
                    $isOemMatch = $true
                    break
                }
            }
            $isMoboVendor = ($sysMfg -match '^(ASUS|ASUSTeK|GIGABYTE|MSI|Micro-Star|ASRock|BIOSTAR|COLORFUL|EVGA|NZXT|MAXSUN|SOYO|FOXCONN)') -or
                            ($genericStrings -contains $sysMfg) -or
                            ($genericStrings -contains $sysModel)

            if ($isOemMatch -and -not $isMoboVendor) {
                $categoryLabel = 'PC de Escritorio OEM'
                $brand = $sysMfg
                $model = if ($sysModel) { $sysModel } else { 'Desktop OEM' }
                $classificationDetail = "PC de Escritorio OEM de Marca ($brand $model)"
            } else {
                $categoryLabel = 'PC de Escritorio Ensamblada'
                $cleanMoboBrand = if ($moboMfr -and $genericStrings -notcontains $moboMfr) {
                    $moboMfr.Replace('Technology Co., Ltd.','').Replace('COMPUTER INC.','').Trim()
                } else { 'Ensamblada' }
                $cleanMoboModel = if ($moboProd -and $genericStrings -notcontains $moboProd) { $moboProd } else { 'Placa Base Estandar' }
                $brand = "$cleanMoboBrand (Ensamblada)"
                $model = $cleanMoboModel
                $classificationDetail = "PC de Escritorio Ensamblada (Placa: $mobo)"
            }
        }
    }

    # Deteccion de Monitor Conectado (EDID / WmiMonitorID / Win32_VideoController)
    $monList = @()
    $pnpVendors = @{
        'DEL' = 'Dell'; 'SAM' = 'Samsung'; 'SEC' = 'Samsung'; 'AOC' = 'AOC';
        'GSM' = 'LG'; 'LGD' = 'LG'; 'HWP' = 'HP'; 'HPN' = 'HP'; 'LEN' = 'Lenovo';
        'ACR' = 'Acer'; 'BNQ' = 'BenQ'; 'ACI' = 'ASUS'; 'ASU' = 'ASUS';
        'VSC' = 'ViewSonic'; 'PHL' = 'Philips'; 'NEC' = 'NEC'; 'SNY' = 'Sony';
        'TSB' = 'Toshiba'; 'CMN' = 'Innolux'; 'BOE' = 'BOE'; 'AUO' = 'AUO'
    }

    try {
        $monIds = Get-CimInstance -Namespace root\\wmi -ClassName WmiMonitorID -ErrorAction SilentlyContinue
        $monParams = Get-CimInstance -Namespace root\\wmi -ClassName WmiMonitorBasicDisplayParams -ErrorAction SilentlyContinue
        $gpu = Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue | Select-Object -First 1

        $resStr = ''
        if ($gpu -and $gpu.CurrentHorizontalResolution) {
            $resStr = "$($gpu.CurrentHorizontalResolution)x$($gpu.CurrentVerticalResolution) @ $($gpu.CurrentRefreshRate)Hz"
        }

        foreach ($m in $monIds) {
            if (-not $m.Active) { continue }
            $rawMfr = if ($m.ManufacturerName) { (-join ($m.ManufacturerName | Where-Object { $_ -ne 0 } | ForEach-Object { [char]$_ })).Trim() } else { '' }
            $mfr = if ($pnpVendors.ContainsKey($rawMfr.ToUpper())) { $pnpVendors[$rawMfr.ToUpper()] } elseif ($rawMfr) { $rawMfr } else { 'Generico' }
            $name = if ($m.UserFriendlyName) { (-join ($m.UserFriendlyName | Where-Object { $_ -ne 0 } | ForEach-Object { [char]$_ })).Trim() } else { '' }
            $serial = if ($m.SerialNumberID) { (-join ($m.SerialNumberID | Where-Object { $_ -ne 0 } | ForEach-Object { [char]$_ })).Trim() } else { '' }

            $inchStr = ''
            $p = $monParams | Where-Object { $_.InstanceName -eq $m.InstanceName } | Select-Object -First 1
            if ($p -and $p.MaxHorizontalImageSize -gt 0 -and $p.MaxVerticalImageSize -gt 0) {
                $w = $p.MaxHorizontalImageSize
                $h = $p.MaxVerticalImageSize
                $diag = [math]::Round([math]::Sqrt(($w*$w) + ($h*$h)) / 2.54, 0)
                if ($diag -gt 0) { $inchStr = "$diag pulg." }
            }

            $specParts = @()
            if ($inchStr) { $specParts += $inchStr }
            if ($resStr) { $specParts += $resStr }
            $specs = if ($specParts.Count -gt 0) { $specParts -join ' ' } else { 'Estandar' }

            $monList += [PSCustomObject]@{
                Brand = $mfr
                Model = if ($name) { $name } else { 'Monitor Plug and Play' }
                Serial = if ($serial -and $serial -ne '0') { $serial } else { 'SN-NO-REPORTADO' }
                Specs = $specs
            }
        }
    } catch {}

    $monitorBrand = if ($monList.Count -gt 0) { ($monList.Brand -join ' | ') } else { '' }
    $monitorModel = if ($monList.Count -gt 0) { ($monList.Model -join ' | ') } else { '' }
    $monitorSerial = if ($monList.Count -gt 0) { ($monList.Serial -join ' | ') } else { '' }
    $monitorSpecs = if ($monList.Count -gt 0) { ($monList.Specs -join ' | ') } else { '' }

    $data = @{
        hostname      = $env:COMPUTERNAME
        deviceType    = $deviceType
        brand         = $brand
        model         = $model
        motherboard   = $mobo
        os            = $os
        ram           = $ram
        cpu           = $cpu
        storage       = $storage
        ipAddress     = $ip
        macAddress    = $mac
        serialNumber  = $serialNumber
        compatibility = $comp
        assignedUser  = $env:USERNAME
        monitorBrand  = $monitorBrand
        monitorModel  = $monitorModel
        monitorSerial = $monitorSerial
        monitorSpecs  = $monitorSpecs
        notes         = "${notesContext} • $classificationDetail • MAC: $mac • Red: $netDesc"
    } | ConvertTo-Json -Depth 3

    $resp = Invoke-RestMethod -Uri "${apiBase}/api/agent/report" -Method Post -Body $data -ContentType 'application/json; charset=utf-8' -Headers @{ 'User-Agent' = 'Mozilla/5.0 TayAudit-Collector/2.0' } -TimeoutSec 20
    ${!isSilent ? `
    Write-Host ""
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host " [OK] INVENTARIO TRANSMITIDO CON EXITO A TAY-AUDIT CLOUD" -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host " Hostname       : $env:COMPUTERNAME" -ForegroundColor White
    Write-Host " Clasificacion  : $categoryLabel" -ForegroundColor Yellow
    Write-Host " Marca / Modelo : $brand $model" -ForegroundColor White
    Write-Host " Placa Madre    : $mobo" -ForegroundColor White
    Write-Host " Direccion IP   : $ip" -ForegroundColor Cyan
    Write-Host " Direccion MAC  : $mac" -ForegroundColor Cyan
    Write-Host " Memoria RAM    : $ram" -ForegroundColor White
    Write-Host " Procesador     : $cpu" -ForegroundColor White
    Write-Host " Serial BIOS    : $serialNumber" -ForegroundColor White
    if ($monitorBrand -or $monitorModel) {
        Write-Host " Monitor Conect.: $monitorBrand $monitorModel ($monitorSpecs)" -ForegroundColor White
        if ($monitorSerial -and $monitorSerial -ne 'SN-NO-REPORTADO') {
            Write-Host " Serial Monitor : $monitorSerial" -ForegroundColor White
        }
    }
    Write-Host "==========================================================" -ForegroundColor Green
    ` : ''}
} catch {
    ${!isSilent ? 'Write-Host "[ERROR] No se pudo transmitir la informacion: $($_.Exception.Message)" -ForegroundColor Red' : ''}
}
`;
}

function generateStivieInstallerPsScript(apiBase) {
  const collectorBlock = generateHardwareCollectorPsScript(apiBase, 'Instalacion permanente STIVIE (Motor Nativo Cloud 24/7)', true);
  return `
$ProgressPreference = 'SilentlyContinue'
$ErrorActionPreference = 'SilentlyContinue'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}

# 1. Finalizar instancias previas si existen
try {
    Get-Process -Name 'STIVIE' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
} catch {}

# 2. Auditar e inventariar hardware del equipo en la nube 24/7
${collectorBlock}

# 3. Desplegar motor nativo STIVIE.exe en %LOCALAPPDATA%\\STIVIE
$appDir = Join-Path $env:LOCALAPPDATA 'STIVIE'
if (!(Test-Path $appDir)) { New-Item -ItemType Directory -Path $appDir -Force | Out-Null }
$exePath = Join-Path $appDir 'STIVIE.exe'
$iconPath = Join-Path $appDir 'stivie-icon.ico'

$downloaded = $false
try {
    $wc = New-Object System.Net.WebClient
    $wc.Headers.Add('User-Agent', 'Mozilla/5.0 TayAudit-Installer/2.0')
    $wc.DownloadFile("${apiBase}/STIVIE.exe", $exePath)
    $wc.DownloadFile("${apiBase}/stivie-icon.ico", $iconPath)
    if ((Test-Path $exePath) -and (Get-Item $exePath).Length -gt 1000) {
        $downloaded = $true
    }
} catch {}

if (!$downloaded) {
    try {
        $csPath = Join-Path $appDir 'STIVIE.cs'
        [System.IO.File]::WriteAllBytes($csPath, [System.Convert]::FromBase64String('${STIVIE_CS_BASE64}'))
        $csc = if (Test-Path 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe') {
            'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe'
        } else {
            'C:\\Windows\\Microsoft.NET\\Framework\\v4.0.30319\\csc.exe'
        }
        $wpfLib = 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\WPF'
        & $csc /nologo /target:winexe /lib:$wpfLib /r:PresentationFramework.dll /r:PresentationCore.dll /r:WindowsBase.dll /r:System.Xaml.dll /r:System.dll /out:$exePath $csPath
    } catch {}
}

# 4. Registrar auto-inicio silencioso en Registro HKCU Run y Carpeta Startup (sin tocar Escritorio)
Remove-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' -Name 'STIVIE_Widget' -ErrorAction SilentlyContinue
Remove-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' -Name 'STIVIE_Daemon' -ErrorAction SilentlyContinue
Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' -Name 'STIVIE' -Value ('"' + $exePath + '" "' + '${apiBase}' + '"') -Force

try {
    $startupFolder = [Environment]::GetFolderPath('Startup')
    if (Test-Path $startupFolder) {
        $startupLnk = Join-Path $startupFolder 'STIVIE.lnk'
        $wsh = New-Object -ComObject WScript.Shell
        $sc = $wsh.CreateShortcut($startupLnk)
        $sc.TargetPath = $exePath
        $sc.Arguments = ('"' + '${apiBase}' + '"')
        $sc.WorkingDirectory = $appDir
        $sc.WindowStyle = 7
        $sc.Save()
    }
} catch {}

# Limpiar estrictamente cualquier acceso directo en el Escritorio
$desktopFolders = @(
    [Environment]::GetFolderPath('Desktop'),
    [Environment]::GetFolderPath('CommonDesktopDirectory'),
    (Join-Path $env:USERPROFILE 'Desktop'),
    (Join-Path $env:USERPROFILE 'Escritorio')
)
if ($env:OneDrive) {
    $desktopFolders += (Join-Path $env:OneDrive 'Desktop')
    $desktopFolders += (Join-Path $env:OneDrive 'Escritorio')
}
foreach ($folder in ($desktopFolders | Where-Object { $_ } | Select-Object -Unique)) {
    if (Test-Path $folder) {
        Get-ChildItem -Path $folder -Force -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '(?i)(STIVIE|Tay-Audit|TayAudit)' } | Where-Object {
            $_.Extension -match '^\\.(lnk|url|bat|cmd|vbs)$'
        } | Remove-Item -Force -ErrorAction SilentlyContinue
    }
}

# 5. Iniciar STIVIE en segundo plano conectado a la nube 24/7
if (Test-Path $exePath) {
    $cmdLine = '"' + $exePath + '" "' + '${apiBase}' + '"'
    try {
        $wmiRes = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $cmdLine; CurrentDirectory = $appDir } -ErrorAction Stop
        if ($wmiRes.ReturnValue -ne 0) { throw "WMI fallback" }
    } catch {
        Start-Process -FilePath $exePath -WorkingDirectory $appDir -ArgumentList ('"' + '${apiBase}' + '"')
    }
}

exit
`;
}

// ============================================================================
// STIVIE FREE AI REASONING ENGINE
// ============================================================================

function isCompleteAiResponse(text) {
  if (!text || text.trim().length < 20) return false;
  const trimmed = text.trim();
  const lastChar = trimmed.slice(-1);
  if (['.', '!', '?', '"', '»', '”', ')'].includes(lastChar)) {
    if (/\n\s*(?:[-*•]|\d+\.)\s*$/.test(trimmed)) return false;
    return true;
  }
  return false;
}

function ensureCompleteAiResponse(text) {
  if (!text) return '';
  let trimmed = text.trim();
  if (isCompleteAiResponse(trimmed)) return trimmed;
  trimmed = trimmed.replace(/\n\s*(?:[-*•]|\d+\.)\s*[^.!?\n]*$/, '').trim();
  const lastPunctIdx = Math.max(trimmed.lastIndexOf('.'), trimmed.lastIndexOf('!'), trimmed.lastIndexOf('?'));
  if (lastPunctIdx > 35) trimmed = trimmed.slice(0, lastPunctIdx + 1).trim();
  return trimmed + '\n\n¿Deseas que te asista con alguno de estos pasos o prefieres que genere un ticket para el equipo de soporte técnico?';
}

async function queryFreeAIReasoning(query, hostname, userName, deviceContext) {
  const userStr = userName || (deviceContext ? deviceContext.assignedUser : 'Compañero');
  const systemPrompt = `Eres STIVIE, el Asistente de Operaciones Virtual para soporte técnico, sistemas y operaciones de Tay-Audit.
Estás asistiendo a ${userStr}.
Instrucciones estrictas de respuesta:
1. Responde SIEMPRE en español, con un tono profesional, claro, directo y empático.
2. SÉ MUY CONCISO Y ESTRUCTURADO: Limita tu respuesta a un MÁXIMO de 3 pasos cortos, prácticos y numerados (menos de 90 palabras en total). No des explicaciones teóricas largas ni introducciones extensas.
3. Si aplica para Windows, proporciona comandos exactos de PowerShell o CMD (ej: Restart-Service Spooler, DisplaySwitch.exe /clone, ipconfig /flushdns, sfc /scannow).
4. No menciones características de hardware (RAM, CPU, IP, etc.) a menos que el usuario las consulte explícitamente.
5. REGLA FUNDAMENTAL DE CIERRE: Termina SIEMPRE con una oración o pregunta de cierre final completa (ej: "¿Deseas que te ayude con alguno de estos pasos o abrimos un ticket técnico?"). JAMÁS dejes oraciones, listas o palabras a medias.`;

  const fullPrompt = `${systemPrompt}\n\nConsulta de ${userStr}: ${query}`;
  let candidateResponse = null;

  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 6500);
    const r = await fetch('https://devtoolbox-api.devtoolbox-api.workers.dev/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: fullPrompt, max_tokens: 450 }),
      signal: ctrl.signal
    });
    clearTimeout(tid);
    if (r.ok) {
      const data = await r.json();
      const rawText = data && data.response ? data.response.trim() : '';
      if (rawText.length > 25) {
        if (isCompleteAiResponse(rawText)) return { text: rawText, model: 'llama-3.2-fast' };
        candidateResponse = { text: rawText, model: 'llama-3.2-fast' };
      }
    }
  } catch {}

  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 8500);
    const r = await fetch(`https://text.pollinations.ai/${encodeURIComponent(fullPrompt)}`, { signal: ctrl.signal });
    clearTimeout(tid);
    if (r.ok) {
      const text = await r.text();
      const cleanText = text ? text.trim() : '';
      if (cleanText.length > 25 && !cleanText.includes('FREE_LIMIT') && !cleanText.includes('SERVICE_UNAVAILABLE') && !cleanText.includes('pollen key')) {
        if (isCompleteAiResponse(cleanText)) return { text: cleanText, model: 'pollinations-free' };
        candidateResponse = candidateResponse || { text: cleanText, model: 'pollinations-free' };
      }
    }
  } catch {}

  if (candidateResponse && candidateResponse.text) {
    return { text: ensureCompleteAiResponse(candidateResponse.text), model: `${candidateResponse.model}-repaired` };
  }
  return null;
}

// ============================================================================
// EXCEL EXPORT HELPERS (EXACT GREEN HEADER MULTI-SHEET CORPORATE FORMAT)
// ============================================================================

const EXCEL_HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF134E38' } };
const EXCEL_HEADER_FONT = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
const EXCEL_HEADER_BORDER = {
  top: { style: 'thin', color: { argb: 'FF0D3828' } },
  left: { style: 'thin', color: { argb: 'FF0D3828' } },
  bottom: { style: 'medium', color: { argb: 'FF082319' } },
  right: { style: 'thin', color: { argb: 'FF0D3828' } }
};
const EXCEL_CELL_BORDER = {
  top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
  left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
  bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
  right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
};

const toUpperStr = (val, fallback = '') => {
  if (val === null || val === undefined) return fallback.toUpperCase();
  const s = String(val).trim();
  return (s.length > 0 ? s : fallback).toUpperCase();
};

const extractBloqueStr = (loc) => {
  if (!loc) return 'BLOQUE A';
  const u = String(loc).toUpperCase().trim();
  if (u.includes('BLOQUE A')) return 'BLOQUE A';
  if (u.includes('BLOQUE B')) return 'BLOQUE B';
  if (u.includes('BLOQUE C')) return 'BLOQUE C';
  if (u.includes('BLOQUE D')) return 'BLOQUE D';
  const match = u.match(/BLOQUE\s+[A-Z0-9]+/);
  return match ? match[0] : u;
};

const extractAmbienteStr = (dept) => (!dept ? 'SOPORTE TÉCNICO' : String(dept).toUpperCase().trim());

function populateStyledWorksheet(ws, columns, rows) {
  ws.columns = columns;
  const headerRow = ws.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.fill = EXCEL_HEADER_FILL;
    cell.font = EXCEL_HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = EXCEL_HEADER_BORDER;
  });

  rows.forEach((rowData) => {
    const row = ws.addRow(rowData);
    row.height = 22;
    row.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF1F2937' } };
      cell.border = EXCEL_CELL_BORDER;
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
    });
  });

  ws.views = [{ showGridLines: true }];
  if (columns.length > 0) {
    const lastLetter = ws.getColumn(columns.length).letter;
    ws.autoFilter = { from: 'A1', to: `${lastLetter}1` };
  }

  // Auto-fit column widths dynamically adapting to content + header with padding
  ws.columns.forEach((column) => {
    let maxLength = 0;
    if (column.header) {
      const headerStr = String(column.header);
      headerStr.split(/\r?\n/).forEach(line => {
        const clean = line.trim();
        if (clean.length > maxLength) maxLength = clean.length;
      });
    }

    column.eachCell({ includeEmpty: false }, (cell) => {
      if (cell.value !== undefined && cell.value !== null) {
        let valStr = '';
        if (cell.value instanceof Date) {
          valStr = cell.value.toLocaleDateString();
        } else if (typeof cell.value === 'object') {
          valStr = cell.value.text || cell.value.result || String(cell.value);
        } else {
          valStr = String(cell.value);
        }
        valStr.split(/\r?\n/).forEach(line => {
          if (line.length > maxLength) maxLength = line.length;
        });
      }
    });

    column.width = Math.max(maxLength + 4, 12);
  });
}

// ============================================================================
// MAIN CLOUDFLARE PAGES FUNCTION ENTRYPOINT
// ============================================================================

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/+$/, '') || '/';
  const method = request.method.toUpperCase();
  const db = env.DB;

  try {
    if (db) {
      try {
        await ensureSchema(db);
      } catch (err) {
        console.warn('[D1 ensureSchema bypassed due to Quota/Network]:', err?.message);
      }
    }

    // ------------------------------------------------------------------------
    // 1. SERVER INFO & REAL-TIME SYNC STATE
    // ------------------------------------------------------------------------
    if (method === 'GET' && pathname === '/api/server-info') {
      const origin = `${url.protocol}//${url.host}`;
      return jsonResponse({
        hostname: url.hostname,
        primaryIp: url.hostname,
        ips: [{ address: url.hostname, name: 'Cloudflare Global Edge 24/7', isWifi: false, isEthernet: true }],
        port: url.protocol === 'https:' ? 443 : (Number(url.port) || 80),
        primaryUrl: origin,
        isCloud: true
      });
    }

    // Instant Zero-Quota Real-Time Sync State (Zero D1 reads)
    if (method === 'GET' && (pathname === '/api/sync-state' || pathname === '/api/sync/state')) {
      return jsonResponse({
        ok: true,
        version: globalSyncVersion,
        serverTime: new Date().toISOString()
      }, 200, {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
      });
    }

    if (method === 'GET' && pathname === '/api/events') {
      const payload = JSON.stringify({ type: 'SYNC_READY', version: globalSyncVersion, timestamp: new Date().toISOString() });
      return new Response(`retry: 4000\ndata: ${payload}\n\n`, {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache'
        }
      });
    }

    // ------------------------------------------------------------------------
    // 2. INSTALLERS & AGENT SCRIPTS (/audit, /api/stivie/*, /api/agent/*)
    // ------------------------------------------------------------------------
    if (method === 'GET' && (pathname === '/audit' || pathname === '/api/agent/run')) {
      const host = resolveCloudServerHost(request, url);
      const collector = generateHardwareCollectorPsScript(host, 'Levantamiento 1-Clic en Memoria Cloud (irm | iex)', false);
      const script = `# ========================================================
# TAY-AUDIT CLOUD 24/7: AGENTE REMOTO DE INVENTARIO
# ========================================================
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  TAY-AUDIT: RECOLECTOR INTELIGENTE DE INVENTARIO 24/7" -ForegroundColor White -BackgroundColor DarkBlue
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Servidor Central Cloud: ${host}" -ForegroundColor Yellow
Write-Host "Analizando arquitectura de hardware en tiempo real..." -ForegroundColor Cyan
${collector}
Write-Host "Registro de inventario completado sin instalar ningun software." -ForegroundColor Yellow
`;
      return textResponse(script);
    }

    if (method === 'GET' && pathname === '/api/agent/download') {
      const host = resolveCloudServerHost(request, url);
      const collector = generateHardwareCollectorPsScript(host, 'Levantamiento con Archivo Batch Independiente Cloud', false);
      const auditPs = `
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  TAY-AUDIT: RECOLECTOR AUTOMATICO DE INVENTARIO 24/7" -ForegroundColor White -BackgroundColor DarkBlue
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Servidor destino: ${host}" -ForegroundColor Yellow
${collector}
Write-Host "Registro finalizado con exito. Cerrando en 3 segundos..." -ForegroundColor Green
Start-Sleep -Seconds 3
`;
      const auditPsBase64 = Buffer.from(auditPs, 'utf8').toString('base64');
      const auditScript = `@echo off
title Tay-Audit Cloud - Agente Independiente de Inventario
color 0a
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$b64 = '${auditPsBase64}'; $code = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($b64)); Invoke-Expression $code"
exit
`;
      return textResponse(auditScript, 'application/x-bat; charset=utf-8', 200, {
        'Content-Disposition': 'attachment; filename="tay-audit-agent.bat"'
      });
    }

    if (method === 'GET' && pathname === '/api/stivie/install.ps1') {
      const apiBase = resolveCloudServerHost(request, url);
      return textResponse(generateStivieInstallerPsScript(apiBase));
    }

    if (method === 'GET' && (pathname === '/api/stivie/download' || pathname === '/api/agent/stivie-installer.bat')) {
      const apiBase = resolveCloudServerHost(request, url);
      const stivieScript = `@echo off
setlocal enabledelayedexpansion
title STIVIE - Asistente Virtual TI
color 0b

echo ====================================================================
echo   STIVIE - ASISTENTE DE OPERACIONES TI Y MONITOREO VIRTUAL
echo ====================================================================
echo.
echo [1/3] Preparando directorio de instalacion en AppData...
set "APP_DIR=%LOCALAPPDATA%\\STIVIE"
if not exist "%APP_DIR%" mkdir "%APP_DIR%" >nul 2>&1

echo [2/3] Descargando componentes oficiales de STIVIE...
curl.exe -s -f -L -o "%APP_DIR%\\STIVIE.exe" "${apiBase}/STIVIE.exe"
curl.exe -s -f -L -o "%APP_DIR%\\stivie-icon.ico" "${apiBase}/stivie-icon.ico"

if not exist "%APP_DIR%\\STIVIE.exe" (
    echo [INFO] Descarga alternativa mediante canal seguro de Windows...
    powershell.exe -NoProfile -Command "try { [Net.ServicePointManager]::SecurityProtocol = 3072; Invoke-WebRequest -Uri '${apiBase}/STIVIE.exe' -OutFile '$env:LOCALAPPDATA\\STIVIE\\STIVIE.exe' -UseBasicParsing; Invoke-WebRequest -Uri '${apiBase}/stivie-icon.ico' -OutFile '$env:LOCALAPPDATA\\STIVIE\\stivie-icon.ico' -UseBasicParsing } catch {}" >nul 2>&1
)

if not exist "%APP_DIR%\\STIVIE.exe" (
    echo.
    echo [ERROR] No se pudo descargar STIVIE.exe.
    echo Verifique su conexion a Internet y que la URL ${apiBase} sea accesible.
    echo.
    pause
    exit /b 1
)

echo [3/3] Registrando inicio automatico con Windows...
reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "STIVIE" /t REG_SZ /d "\\"%APP_DIR%\\STIVIE.exe\\" \\"${apiBase}\\"" /f >nul 2>&1

rem Registro de inventario inicial de hardware en segundo plano
powershell.exe -NoProfile -Command "try { [Net.ServicePointManager]::SecurityProtocol = 3072; irm '${apiBase}/audit' | iex } catch {}" >nul 2>&1

echo.
echo ====================================================================
echo   ^!INSTALACION FINALIZADA CON EXITO^!
echo   Iniciando STIVIE en el lateral de la pantalla...
echo ====================================================================
start "" "%APP_DIR%\\STIVIE.exe" "${apiBase}"

timeout /t 2 /nobreak >nul 2>&1
exit /b 0
`;
      return textResponse(stivieScript, 'application/x-bat; charset=utf-8', 200, {
        'Content-Disposition': 'attachment; filename="stivie-installer.bat"'
      });
    }

    if (method === 'GET' && pathname === '/api/stivie/STIVIE.exe') {
      return env.ASSETS.fetch(new URL('/STIVIE.exe', request.url));
    }

    if (method === 'GET' && pathname === '/api/stivie/stivie-icon.ico') {
      return env.ASSETS.fetch(new URL('/stivie-icon.ico', request.url));
    }

    if (method === 'POST' && pathname === '/api/stivie/launch-local') {
      return jsonResponse({
        ok: true,
        message: 'Desde la nube 24/7, usa el Instalador STIVIE.bat si es la primera vez en el equipo; una vez instalado, STIVIE arranca automáticamente con Windows.'
      });
    }

    // ------------------------------------------------------------------------
    // 3. DEVICES CRUD & AGENT HEARTBEAT / REPORTING
    // ------------------------------------------------------------------------
    if (method === 'GET' && pathname === '/api/devices') {
      try {
        const { results } = await db.prepare('SELECT * FROM devices ORDER BY datetime(lastAuditDate) DESC').all();
        if (results && results.length > 0) {
          globalCachedDevices = results;
        }
        return jsonResponse(results || globalCachedDevices || []);
      } catch (err) {
        console.warn('[D1 Fallback - devices]:', err?.message);
        return jsonResponse(globalCachedDevices || []);
      }
    }

    if (method === 'POST' && pathname === '/api/devices') {
      const body = await request.json();
      const now = new Date().toISOString();
      const id = body.id || `dev-${shortUuid()}`;
      const hostname = (body.hostname || `EQUIPO-${Date.now().toString().slice(-4)}`).toUpperCase().trim();
      const deviceType = body.deviceType || 'pc';
      const status = body.status || 'instalado';
      const qrCodeData = body.qrCodeData || `TAY-${hostname}-${id.replace('dev-', '').toUpperCase()}`;

      const newDevice = {
        id, hostname, deviceType, status,
        os: (deviceType === 'pc' || deviceType === 'laptop' || deviceType === 'server') ? (body.os || 'Desconocido') : (body.os || ''),
        ram: body.ram || '', cpu: body.cpu || '', storage: body.storage || '',
        ipAddress: body.ipAddress || '', macAddress: body.macAddress || '',
        serialNumber: body.serialNumber || 'S/N',
        motherboard: body.motherboard || '', compatibility: body.compatibility || 'Compatible',
        brand: body.brand || 'Genérico', model: body.model || 'Genérico',
        assignedUser: body.assignedUser || 'Sin Asignar', department: body.department || 'General',
        location: body.location || 'Oficina Principal', lastAuditDate: now,
        notes: body.notes || 'Auditoría manual registrada.',
        qrCodeData, createdAt: now, updatedAt: now,
        monitorBrand: body.monitorBrand || null, monitorModel: body.monitorModel || null,
        monitorSerial: body.monitorSerial || null, monitorSpecs: body.monitorSpecs || null
      };

      globalCachedDevices = [newDevice, ...globalCachedDevices.filter(d => d.id !== id && d.hostname !== hostname)];

      try {
        await db.batch([
          db.prepare(`
            INSERT INTO devices (
              id, hostname, deviceType, status, os, ram, cpu, storage,
              ipAddress, macAddress, serialNumber, motherboard, compatibility, brand, model,
              assignedUser, department, location, lastAuditDate, notes, supplies, specs, qrCodeData,
              createdAt, updatedAt, monitorBrand, monitorModel, monitorSerial, monitorSpecs
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            id, hostname, deviceType, status,
            newDevice.os, newDevice.ram, newDevice.cpu, newDevice.storage,
            newDevice.ipAddress, newDevice.macAddress, newDevice.serialNumber,
            newDevice.motherboard, newDevice.compatibility, newDevice.brand, newDevice.model,
            newDevice.assignedUser, newDevice.department, newDevice.location,
            now, newDevice.notes, body.supplies || null, body.specs || null,
            qrCodeData, now, now,
            newDevice.monitorBrand, newDevice.monitorModel, newDevice.monitorSerial, newDevice.monitorSpecs
          ),
          db.prepare(`
            INSERT INTO audit_logs (id, deviceId, hostname, action, details, performedBy, timestamp)
            VALUES (?, ?, ?, 'AUDITORIA_MANUAL', ?, 'Auditor Técnico', ?)
          `).bind(`log-${shortUuid()}`, id, hostname, `Auditoría y registro manual completado para ${hostname}`, now)
        ]);
      } catch (err) {
        console.warn('[D1 Insert Fallback - Quota]:', err?.message);
      }

      await touchSyncVersion(db);
      return jsonResponse(newDevice, 201);
    }

    // Dynamic /api/devices/:id routes
    const deviceMatch = pathname.match(/^\/api\/devices\/([^/]+)(?:\/([^/]+))?$/);
    if (deviceMatch) {
      const deviceId = decodeURIComponent(deviceMatch[1]);
      const subAction = deviceMatch[2] || null;

      if (!subAction && method === 'GET') {
        let device = null;
        try {
          if (db) device = await db.prepare('SELECT * FROM devices WHERE id = ?').bind(deviceId).first();
        } catch (err) {
          console.warn('[D1 Get Device Fallback]:', err?.message);
        }
        if (!device) {
          device = globalCachedDevices.find(d => d.id === deviceId);
        }
        if (!device) return jsonResponse({ error: 'Dispositivo no encontrado' }, 404);
        return jsonResponse(device);
      }

      if (!subAction && method === 'PUT') {
        let existing = null;
        try {
          if (db) existing = await db.prepare('SELECT * FROM devices WHERE id = ?').bind(deviceId).first();
        } catch (err) {
          console.warn('[D1 Existing Device Fallback]:', err?.message);
        }
        if (!existing) {
          existing = globalCachedDevices.find(d => d.id === deviceId);
        }
        if (!existing) return jsonResponse({ error: 'Dispositivo no encontrado' }, 404);

        const body = await request.json();
        const now = new Date().toISOString();
        const nextStatus = body.status !== undefined ? body.status : existing.status;
        const nextHostname = body.hostname !== undefined ? String(body.hostname).trim() : existing.hostname;

        const dType = body.deviceType !== undefined ? body.deviceType : existing.deviceType;
        const isComp = dType === 'pc' || dType === 'laptop' || dType === 'server';
        const isNet = dType === 'network';
        const isPrint = dType === 'printer';

        const rawIp = body.ipAddress !== undefined ? body.ipAddress : existing.ipAddress;
        const cleanIp = (isComp || isNet || isPrint) ? (rawIp && rawIp !== '0.0.0.0' ? rawIp : (isComp ? '127.0.0.1' : '')) : '';

        const rawMac = body.macAddress !== undefined ? body.macAddress : existing.macAddress;
        const cleanMac = (isComp || isNet || isPrint) ? (rawMac && rawMac !== '00:00:00:00:00:00' ? rawMac : '') : '';

        const cleanMb = isComp ? (body.motherboard !== undefined ? body.motherboard : existing.motherboard) : '';
        const cleanCpu = isComp ? (body.cpu !== undefined ? body.cpu : existing.cpu) : '';
        const cleanRam = isComp ? (body.ram !== undefined ? body.ram : existing.ram) : '';
        const cleanStorage = isComp ? (body.storage !== undefined ? body.storage : existing.storage) : (dType === 'component' ? (body.storage || existing.storage || '') : '');
        const cleanOs = isComp ? (body.os !== undefined ? body.os : existing.os) : (dType === 'component' ? (body.os || existing.os || '') : '');

        const updatedDevice = {
          ...existing,
          ...body,
          id: deviceId,
          hostname: nextHostname,
          deviceType: dType,
          status: nextStatus,
          os: cleanOs,
          ram: cleanRam,
          cpu: cleanCpu,
          storage: cleanStorage,
          ipAddress: cleanIp,
          macAddress: cleanMac,
          motherboard: cleanMb,
          updatedAt: now
        };

        globalCachedDevices = globalCachedDevices.map(d => d.id === deviceId ? updatedDevice : d);

        const logEntry = {
          id: `log-${shortUuid()}`,
          deviceId,
          hostname: nextHostname,
          action: body.status && body.status !== existing.status ? 'CAMBIO_ESTADO' : 'MODIFICACION_MANUAL',
          details: body.status && body.status !== existing.status
            ? `Estado cambiado de "${existing.status}" a "${nextStatus}"`
            : `Actualización manual de datos/ubicación para ${nextHostname}`,
          performedBy: 'Administrador TI',
          timestamp: now
        };
        globalCachedLogs = [logEntry, ...globalCachedLogs];

        try {
          if (db) {
            await db.batch([
              db.prepare(`
                UPDATE devices SET
                  hostname = ?, deviceType = ?, status = ?, os = ?, ram = ?, cpu = ?,
                  storage = ?, ipAddress = ?, macAddress = ?, serialNumber = ?,
                  motherboard = ?, compatibility = ?, brand = ?,
                  model = ?, assignedUser = ?, department = ?, location = ?, lastAuditDate = ?,
                  notes = ?, supplies = ?, specs = ?, qrCodeData = ?, updatedAt = ?,
                  monitorBrand = ?, monitorModel = ?, monitorSerial = ?, monitorSpecs = ?
                WHERE id = ?
              `).bind(
                nextHostname,
                dType,
                nextStatus,
                cleanOs,
                cleanRam,
                cleanCpu,
                cleanStorage,
                cleanIp,
                cleanMac,
                body.serialNumber !== undefined ? body.serialNumber : existing.serialNumber,
                cleanMb,
                body.compatibility !== undefined ? body.compatibility : existing.compatibility,
                body.brand !== undefined ? body.brand : existing.brand,
                body.model !== undefined ? body.model : existing.model,
                body.assignedUser !== undefined ? body.assignedUser : existing.assignedUser,
                body.department !== undefined ? body.department : existing.department,
                body.location !== undefined ? body.location : existing.location,
                now,
                body.notes !== undefined ? body.notes : existing.notes,
                body.supplies !== undefined ? body.supplies : (existing.supplies || null),
                body.specs !== undefined ? body.specs : (existing.specs || null),
                body.qrCodeData || existing.qrCodeData,
                now,
                body.monitorBrand !== undefined ? body.monitorBrand : (existing.monitorBrand || null),
                body.monitorModel !== undefined ? body.monitorModel : (existing.monitorModel || null),
                body.monitorSerial !== undefined ? body.monitorSerial : (existing.monitorSerial || null),
                body.monitorSpecs !== undefined ? body.monitorSpecs : (existing.monitorSpecs || null),
                deviceId
              ),
              db.prepare(`
                INSERT INTO audit_logs (id, deviceId, hostname, action, details, performedBy, timestamp)
                VALUES (?, ?, ?, ?, ?, 'Administrador TI', ?)
              `).bind(
                logEntry.id,
                deviceId,
                nextHostname,
                logEntry.action,
                logEntry.details,
                now
              )
            ]);
          }
        } catch (err) {
          console.warn('[D1 Update Fallback - Quota]:', err?.message);
        }

        await touchSyncVersion(db);
        return jsonResponse(updatedDevice);
      }

      if (!subAction && method === 'DELETE') {
        let existing = null;
        try {
          if (db) existing = await db.prepare('SELECT * FROM devices WHERE id = ?').bind(deviceId).first();
        } catch (err) {
          console.warn('[D1 Existing Device Delete Fallback]:', err?.message);
        }
        if (!existing) {
          existing = globalCachedDevices.find(d => d.id === deviceId);
        }
        if (!existing) return jsonResponse({ error: 'Dispositivo no encontrado' }, 404);

        globalCachedDevices = globalCachedDevices.filter(d => d.id !== deviceId);

        const deleteLog = {
          id: `log-${shortUuid()}`,
          deviceId,
          hostname: existing.hostname,
          action: 'ELIMINACION_BIEN',
          details: `Bien ${existing.hostname} (${existing.brand || ''} ${existing.model || ''}) eliminado definitivamente del inventario`,
          performedBy: 'Administrador Web',
          timestamp: new Date().toISOString()
        };
        globalCachedLogs = [deleteLog, ...globalCachedLogs];

        try {
          if (db) {
            await db.batch([
              db.prepare('DELETE FROM devices WHERE id = ?').bind(deviceId),
              db.prepare('DELETE FROM agent_commands WHERE UPPER(hostname) = ?').bind(existing.hostname.toUpperCase()),
              db.prepare(`
                INSERT INTO audit_logs (id, deviceId, hostname, action, details, performedBy, timestamp)
                VALUES (?, ?, ?, 'ELIMINACION_BIEN', ?, 'Administrador Web', ?)
              `).bind(deleteLog.id, deviceId, existing.hostname, deleteLog.details, deleteLog.timestamp)
            ]);
          }
        } catch (err) {
          console.warn('[D1 Delete Fallback - Quota]:', err?.message);
        }

        await touchSyncVersion(db);
        return jsonResponse({ message: 'Dispositivo eliminado correctamente', id: deviceId });
      }

      if (subAction === 'stivie' && method === 'PATCH') {
        const existing = await db.prepare('SELECT * FROM devices WHERE id = ?').bind(deviceId).first();
        if (!existing) return jsonResponse({ error: 'Dispositivo no encontrado' }, 404);
        const body = await request.json();
        const stivieVal = body.enabled ? 1 : 0;
        const now = new Date().toISOString();
        await db.prepare('UPDATE devices SET stivieInstalled = ?, updatedAt = ? WHERE id = ?').bind(stivieVal, now, deviceId).run();
        await touchSyncVersion(db);
        const updated = await db.prepare('SELECT * FROM devices WHERE id = ?').bind(deviceId).first();
        return jsonResponse(updated);
      }

      if (subAction === 'check-connection' && method === 'POST') {
        const device = await db.prepare('SELECT * FROM devices WHERE id = ?').bind(deviceId).first();
        if (!device) return jsonResponse({ error: 'Dispositivo no encontrado' }, 404);

        if (!device.stivieInstalled) {
          return jsonResponse({
            id: device.id,
            hostname: device.hostname,
            ipAddress: device.ipAddress,
            isStivieActive: false,
            stivieInstalled: false,
            secondsSinceLastPing: null,
            networkReachable: false,
            pingLatencyMs: null,
            localProcessRunning: false,
            isLocalMachine: false,
            statusSummary: `STIVIE no está instalado en este equipo (${device.hostname}). Ejecuta stivie-installer.bat en esa PC para conectarla 24/7 a la nube.`
          });
        }

        let secondsSinceLastPing = null;
        let isStivieActive = false;
        if (device.lastAgentPing) {
          secondsSinceLastPing = Math.max(0, Math.round((Date.now() - new Date(device.lastAgentPing).getTime()) / 1000));
          isStivieActive = secondsSinceLastPing <= 60;
        }

        const statusSummary = isStivieActive
          ? `Conexión Cloud 24/7 activa: STIVIE transmitiendo en tiempo real desde ${device.hostname} (último latido hace ${secondsSinceLastPing}s).`
          : `Equipo desconectado o apagado (última señal recibida ${secondsSinceLastPing !== null ? `hace ${secondsSinceLastPing}s` : 'nunca'}).`;

        return jsonResponse({
          id: device.id,
          hostname: device.hostname,
          ipAddress: device.ipAddress,
          isStivieActive,
          secondsSinceLastPing,
          networkReachable: isStivieActive,
          pingLatencyMs: isStivieActive ? 24 : null,
          localProcessRunning: isStivieActive,
          isLocalMachine: false,
          statusSummary
        });
      }

      if (subAction === 'remote-action' && method === 'POST') {
        const body = await request.json();
        const { action } = body;
        const device = await db.prepare('SELECT * FROM devices WHERE id = ? OR LOWER(hostname) = LOWER(?)').bind(deviceId, deviceId).first();
        if (!device) return jsonResponse({ error: 'Dispositivo no encontrado' }, 404);

        const allowedTypes = ['pc', 'laptop', 'server'];
        if (!allowedTypes.includes(device.deviceType)) {
          return jsonResponse({ error: `Las funciones de control remoto no están disponibles para ${device.deviceType.toUpperCase()}.` }, 400);
        }

        const now = new Date().toISOString();
        await queueAgentCommand(db, device.hostname, action, { forced: true, timestamp: now });

        const actionMessages = {
          restart: `Orden remota Cloud 24/7 de REINICIO enviada a ${device.hostname}. STIVIE la ejecutará en segundos.`,
          shutdown: `Orden remota Cloud 24/7 de APAGADO enviada a ${device.hostname}. STIVIE la ejecutará en segundos.`,
          screen_assist: `Orden de DUPLICAR PANTALLA enviada por la nube a ${device.hostname}.`,
          display_clone: `Pantalla de ${device.hostname} configurada en modo DUPLICADO vía STIVIE Cloud.`,
          display_internal: `Proyección cambiada a 'Solo pantalla de PC' en ${device.hostname}.`,
          display_extend: `Proyección cambiada a 'Ampliar' en ${device.hostname}.`,
          display_external: `Proyección cambiada a 'Solo segunda pantalla' en ${device.hostname}.`,
          remote_access: `Archivo de conexión RDP preparado para ${device.hostname}.`,
          remote_desktop: `Archivo de conexión RDP preparado para ${device.hostname}.`,
          launch_stivie: `Señal de sincronización enviada a ${device.hostname}.`,
          revive_stivie: `Señal de sincronización enviada a ${device.hostname}.`
        };

        if (!actionMessages[action]) {
          return jsonResponse({ error: 'Acción remota no reconocida' }, 400);
        }

        await db.prepare(`
          INSERT INTO audit_logs (id, deviceId, hostname, action, details, performedBy, timestamp)
          VALUES (?, ?, ?, ?, ?, 'Auditor Corporativo Maestro TI', ?)
        `).bind(`log-${shortUuid()}`, device.id, device.hostname, `REMOTE_${action.toUpperCase()}`, actionMessages[action], now).run();

        await touchSyncVersion(db);
        return jsonResponse({
          success: true,
          action,
          hostname: device.hostname,
          ipAddress: device.ipAddress,
          status: 'SENT',
          rdpUrl: `/api/devices/${device.id}/rdp`,
          message: actionMessages[action]
        });
      }

      if (subAction === 'remote-command' && method === 'POST') {
        const body = await request.json();
        const { command } = body;
        const device = await db.prepare('SELECT * FROM devices WHERE id = ?').bind(deviceId).first();
        if (!device) return jsonResponse({ error: 'Dispositivo no encontrado' }, 404);

        const now = new Date().toISOString();
        await queueAgentCommand(db, device.hostname, command, { timestamp: now });
        await db.prepare(`
          INSERT INTO audit_logs (id, deviceId, hostname, action, details, performedBy, timestamp)
          VALUES (?, ?, ?, 'AUDIT_COMMAND', ?, 'Auditor Corporativo Maestro TI', ?)
        `).bind(`log-${shortUuid()}`, device.id, device.hostname, `Comando corporativo despachado a ${device.hostname}: ${command}`, now).run();

        await touchSyncVersion(db);
        return jsonResponse({
          success: true,
          command,
          hostname: device.hostname,
          executedAt: now,
          output: `[TI-CLOUD-SHELL] Comando "${command}" encolado y enviado en tiempo real al agente STIVIE en ${device.hostname}.`
        });
      }

      if (subAction === 'rdp' && method === 'GET') {
        const device = await db.prepare('SELECT * FROM devices WHERE id = ? OR LOWER(hostname) = LOWER(?)').bind(deviceId, deviceId).first();
        if (!device) return textResponse('Equipo no encontrado', 'text/plain', 404);
        const address = sanitizeHost(device.ipAddress && device.ipAddress !== '0.0.0.0' ? device.ipAddress : device.hostname) || device.hostname;
        const rdpContent = [
          `full address:s:${address}`,
          `username:s:${device.assignedUser || 'Administrator'}`,
          `screen mode id:i:2`,
          `desktopwidth:i:1920`,
          `desktopheight:i:1080`,
          `session bpp:i:32`,
          `compression:i:1`,
          `redirectclipboard:i:1`,
          `administrative session:i:1`
        ].join('\r\n');
        return textResponse(rdpContent, 'application/x-rdp', 200, {
          'Content-Disposition': `attachment; filename="${device.hostname}-TayAudit.rdp"`
        });
      }
    }

    // POST /api/agent/report (Hardware inventory upsert)
    if (method === 'POST' && pathname === '/api/agent/report') {
      const body = await request.json();
      const {
        hostname, deviceType = null, os = null, ram = null, cpu = null, storage = null,
        ipAddress = null, macAddress = null, serialNumber = null, motherboard = null,
        compatibility = null, brand = null, model = null, assignedUser = null, notes = null,
        monitorBrand = null, monitorModel = null, monitorSerial = null, monitorSpecs = null
      } = body || {};

      if (!hostname) return jsonResponse({ error: 'El campo hostname es requerido' }, 400);

      const cleanHostname = hostname.trim().toUpperCase();
      const now = new Date().toISOString();
      let existing = null;
      try {
        if (db) existing = await db.prepare('SELECT * FROM devices WHERE UPPER(hostname) = ?').bind(cleanHostname).first();
      } catch (err) {
        console.warn('[D1 Existing Report Device Fallback]:', err?.message);
      }
      if (!existing) {
        existing = globalCachedDevices.find(d => d.hostname.toUpperCase() === cleanHostname);
      }

      const isStivie = Boolean(notes && notes.includes('STIVIE'));

      let deviceId;
      let actionType;

      if (existing) {
        deviceId = existing.id;
        actionType = 'ACTUALIZACION_AGENTE';
        try {
          if (db) {
            await db.prepare(`
              UPDATE devices SET
                deviceType = COALESCE(?, deviceType),
                os = COALESCE(?, os),
                ram = COALESCE(?, ram),
                cpu = COALESCE(?, cpu),
                storage = COALESCE(?, storage),
                ipAddress = COALESCE(?, ipAddress),
                macAddress = COALESCE(?, macAddress),
                serialNumber = COALESCE(?, serialNumber),
                motherboard = COALESCE(?, motherboard),
                compatibility = COALESCE(?, compatibility),
                brand = COALESCE(?, brand),
                model = COALESCE(?, model),
                assignedUser = COALESCE(?, assignedUser),
                notes = COALESCE(?, notes),
                monitorBrand = COALESCE(?, monitorBrand),
                monitorModel = COALESCE(?, monitorModel),
                monitorSerial = COALESCE(?, monitorSerial),
                monitorSpecs = COALESCE(?, monitorSpecs),
                status = CASE WHEN status = 'baja' THEN 'baja' ELSE 'instalado' END,
                stivieInstalled = CASE WHEN ? = 1 THEN 1 ELSE stivieInstalled END,
                lastAgentPing = CASE WHEN ? = 1 THEN ? ELSE lastAgentPing END,
                lastAuditDate = COALESCE(lastAuditDate, ?),
                updatedAt = ?
              WHERE id = ?
            `).bind(
              deviceType, os, ram, cpu, storage, ipAddress, macAddress, serialNumber,
              motherboard, compatibility, brand, model, assignedUser, notes,
              monitorBrand, monitorModel, monitorSerial, monitorSpecs,
              isStivie ? 1 : 0, isStivie ? 1 : 0, now, now, now, deviceId
            ).run();
          }
        } catch (err) {
          console.warn('[D1 Report Update Fallback]:', err?.message);
        }
      } else {
        deviceId = `dev-${shortUuid()}`;
        actionType = 'DESCUBRIMIENTO_AGENTE';
        const finalDeviceType = deviceType || (
          (cleanHostname.includes('SRV') || cleanHostname.includes('SERVER')) ? 'server'
            : (cleanHostname.includes('LAP') || cleanHostname.includes('NOTE')) ? 'laptop' : 'pc'
        );
        const qrCode = `TAY-${cleanHostname}-${deviceId.replace('dev-', '').toUpperCase()}`;
        try {
          if (db) {
            await db.prepare(`
              INSERT INTO devices (
                id, hostname, deviceType, status, os, ram, cpu, storage,
                ipAddress, macAddress, serialNumber, motherboard, compatibility, brand, model,
                assignedUser, department, location, lastAuditDate, notes, qrCodeData,
                stivieInstalled, lastAgentPing, createdAt, updatedAt,
                monitorBrand, monitorModel, monitorSerial, monitorSpecs
              ) VALUES (?, ?, ?, 'instalado', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Operaciones', 'Red Pública Cloud', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              deviceId, cleanHostname, finalDeviceType,
              os || 'Windows desconocido', ram || 'No detectada', cpu || 'No detectado', storage || 'No detectado',
              ipAddress || '127.0.0.1', macAddress || '00:00:00:00:00:00', serialNumber || 'SN-AUTO',
              motherboard || 'Placa Base Estándar', compatibility || 'Compatible',
              brand || 'Genérico', model || 'Estación de Trabajo', assignedUser || 'Usuario Local',
              now, notes || 'Reporte levantado automáticamente mediante agente Tay-Audit Cloud.',
              qrCode, isStivie ? 1 : 0, isStivie ? now : null, now, now,
              monitorBrand, monitorModel, monitorSerial, monitorSpecs
            ).run();
          }
        } catch (err) {
          console.warn('[D1 Report Insert Fallback]:', err?.message);
        }
      }

      const repDevice = {
        id: deviceId,
        hostname: cleanHostname,
        deviceType: deviceType || (existing ? existing.deviceType : 'pc'),
        status: 'operativo',
        os: os || (existing ? existing.os : 'Windows'),
        ram: ram || (existing ? existing.ram : 'N/A'),
        cpu: cpu || (existing ? existing.cpu : 'CPU Generico'),
        storage: storage || (existing ? existing.storage : 'N/A'),
        ipAddress: ipAddress || (existing ? existing.ipAddress : '127.0.0.1'),
        macAddress: macAddress || (existing ? existing.macAddress : ''),
        serialNumber: serialNumber || (existing ? existing.serialNumber : 'SN-AUTO'),
        motherboard: motherboard || (existing ? existing.motherboard : ''),
        compatibility: compatibility || (existing ? existing.compatibility : 'Compatible'),
        brand: brand || (existing ? existing.brand : 'Genérico'),
        model: model || (existing ? existing.model : 'Estación'),
        assignedUser: assignedUser || (existing ? existing.assignedUser : 'Usuario Local'),
        location: existing ? existing.location : 'Red Pública Cloud',
        department: existing ? existing.department : 'Operaciones',
        lastAuditDate: now,
        notes: notes || (existing ? existing.notes : 'Reporte agente'),
        stivieInstalled: isStivie ? 1 : (existing ? existing.stivieInstalled : 0),
        lastAgentPing: isStivie ? now : (existing ? existing.lastAgentPing : null),
        updatedAt: now,
        createdAt: existing ? existing.createdAt : now
      };

      const existingIdx = globalCachedDevices.findIndex(d => d.hostname.toUpperCase() === cleanHostname);
      if (existingIdx >= 0) {
        globalCachedDevices[existingIdx] = { ...globalCachedDevices[existingIdx], ...repDevice };
      } else {
        globalCachedDevices.unshift(repDevice);
      }

      const reportLog = {
        id: `log-${shortUuid()}`,
        deviceId,
        hostname: cleanHostname,
        action: actionType,
        details: `Levantamiento automático de hardware: RAM: ${ram || 'N/A'}, SO: ${os || 'N/A'}, IP: ${ipAddress || 'N/A'}`,
        performedBy: 'Agente Tay-Audit Cloud',
        timestamp: now
      };
      globalCachedLogs = [reportLog, ...globalCachedLogs];

      try {
        if (db) {
          await db.prepare(`
            INSERT INTO audit_logs (id, deviceId, hostname, action, details, performedBy, timestamp)
            VALUES (?, ?, ?, ?, ?, 'Agente Tay-Audit Cloud', ?)
          `).bind(reportLog.id, deviceId, cleanHostname, actionType, reportLog.details, now).run();
        }
      } catch (err) {
        console.warn('[D1 Report Log Fallback]:', err?.message);
      }

      await touchSyncVersion(db);
      return jsonResponse({ success: true, message: `Equipo ${cleanHostname} auditado y sincronizado en la nube 24/7`, device: repDevice });
    }

    // POST /api/agent/ping (Quota-Smart Real-Time Heartbeat + Command Delivery)
    if (method === 'POST' && pathname === '/api/agent/ping') {
      const body = await request.json();
      const { hostname, user } = body || {};
      if (!hostname) return jsonResponse({ error: 'hostname requerido' }, 400);

      const cleanHostname = hostname.trim().toUpperCase();
      const nowMs = Date.now();
      const now = new Date(nowMs).toISOString();

      let existing = null;
      try {
        if (db) {
          existing = await db.prepare(
            'SELECT id, status, stivieInstalled, lastAgentPing FROM devices WHERE hostname = ? OR UPPER(hostname) = ?'
          ).bind(cleanHostname, cleanHostname).first();
        }
      } catch (err) {
        console.warn('[D1 Ping Select Fallback]:', err?.message);
      }
      if (!existing) {
        existing = globalCachedDevices.find(d => d.hostname.toUpperCase() === cleanHostname);
      }

      if (existing) {
        const prevPingMs = existing.lastAgentPing ? Date.parse(existing.lastAgentPing) : 0;
        const wasOffline = !prevPingMs || (nowMs - prevPingMs) > 60000 || existing.stivieInstalled !== 1;
        existing.stivieInstalled = 1;
        existing.lastAgentPing = now;
        existing.status = existing.status === 'baja' ? 'baja' : 'operativo';
        if (wasOffline || (nowMs - prevPingMs) >= 10000) {
          try {
            if (db) {
              await db.prepare(`
                UPDATE devices SET
                  status = CASE WHEN status = 'baja' THEN 'baja' ELSE 'instalado' END,
                  stivieInstalled = 1,
                  lastAgentPing = ?,
                  lastAuditDate = COALESCE(lastAuditDate, ?),
                  updatedAt = ?
                WHERE id = ?
              `).bind(now, now, now, existing.id).run();
            }
          } catch (err) {
            console.warn('[D1 Ping Update Fallback]:', err?.message);
          }
          if (wasOffline) await touchSyncVersion(db);
        }
      }

      let commands = [];
      try {
        if (db) commands = await getAndClearAgentCommands(db, cleanHostname);
      } catch (err) {
        console.warn('[D1 Commands Fallback]:', err?.message);
      }
      return jsonResponse({ ok: true, timestamp: now, commands, registered: Boolean(existing) });
    }

    // ------------------------------------------------------------------------
    // 4. LOGS & STATS
    // ------------------------------------------------------------------------
    if (method === 'GET' && pathname === '/api/logs') {
      try {
        if (db) {
          const { results } = await db.prepare('SELECT * FROM audit_logs ORDER BY datetime(timestamp) DESC LIMIT 100').all();
          if (results && results.length > 0) {
            globalCachedLogs = results;
            return jsonResponse(results);
          }
        }
      } catch (err) {
        console.warn('[D1 Logs Fallback]:', err?.message);
      }
      return jsonResponse(globalCachedLogs || []);
    }

    if (method === 'GET' && pathname === '/api/stats') {
      let devices = globalCachedDevices;
      try {
        if (db) {
          const { results } = await db.prepare('SELECT status, deviceType, lastAuditDate FROM devices').all();
          if (results && results.length > 0) {
            devices = results;
          }
        }
      } catch (err) {
        console.warn('[D1 Stats Fallback]:', err?.message);
      }
      return jsonResponse({
        totalDevices: devices.length,
        onlineCount: devices.filter(d => d.status === 'online' || d.status === 'instalado' || d.status === 'operativo').length,
        pcCount: devices.filter(d => d.deviceType === 'pc').length,
        laptopCount: devices.filter(d => d.deviceType === 'laptop').length,
        serverCount: devices.filter(d => d.deviceType === 'server').length,
        printerCount: devices.filter(d => d.deviceType === 'printer').length,
        networkCount: devices.filter(d => d.deviceType === 'network').length,
        otherCount: devices.filter(d => ['monitor', 'speaker', 'other', 'component'].includes(d.deviceType)).length,
        recentlyAudited: devices.filter(d => {
          const diff = (Date.now() - new Date(d.lastAuditDate).getTime()) / (1000 * 60 * 60 * 24);
          return diff <= 7;
        }).length
      });
    }

    // ------------------------------------------------------------------------
    // 5. SUPPORT TICKETS & STIVIE AI / KNOWLEDGE BASE
    // ------------------------------------------------------------------------
    if (method === 'POST' && pathname === '/api/push/subscribe') {
      try {
        const body = await request.json();
        const endpoint = body?.endpoint || body?.subscription?.endpoint;
        const p256dh = body?.p256dh || body?.subscription?.keys?.p256dh || '';
        const auth = body?.auth || body?.subscription?.keys?.auth || '';
        const userAgent = sanitizeInput(body?.userAgent || request.headers.get('user-agent') || '', 255);

        if (!endpoint || typeof endpoint !== 'string') {
          return jsonResponse({ error: 'Endpoint es obligatorio' }, 400);
        }

        const now = new Date().toISOString();
        const subId = `sub-${shortUuid()}`;

        if (db) {
          await db.prepare(`
            INSERT INTO push_subscriptions (id, endpoint, p256dh, auth, userAgent, createdAt)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(endpoint) DO UPDATE SET
              p256dh = excluded.p256dh,
              auth = excluded.auth,
              userAgent = excluded.userAgent,
              createdAt = excluded.createdAt
          `).bind(subId, endpoint, p256dh, auth, userAgent, now).run();
        }

        return jsonResponse({ success: true, message: 'Suscripción push registrada exitosamente' });
      } catch (err) {
        return jsonResponse({ error: 'Error al registrar suscripción push: ' + err.message }, 500);
      }
    }

    if (method === 'POST' && pathname === '/api/push/test') {
      try {
        const testTicket = {
          id: 'TEST-' + shortUuid(),
          hostname: 'MOVIL-TEST',
          userName: 'Prueba Push UPN',
          category: 'Notificación en Tiempo Real',
          description: 'Esta es una notificación de prueba en tiempo real para verificar el sonido y la llegada en segundo plano.',
          urgency: 'alta',
          createdAt: new Date().toISOString()
        };
        const count = await dispatchPushToAllSubscribers(db, testTicket);
        return jsonResponse({ success: true, count, message: `Push enviado a ${count} dispositivos registrados.` });
      } catch (err) {
        return jsonResponse({ error: err.message }, 500);
      }
    }

    if (method === 'GET' && pathname === '/api/tickets') {
      try {
        if (db) {
          const { results } = await db.prepare('SELECT * FROM support_tickets ORDER BY datetime(createdAt) DESC').all();
          if (results && results.length > 0) {
            globalCachedTickets = results;
            return jsonResponse(results);
          }
        }
      } catch (err) {
        console.warn('[D1 Tickets Fallback]:', err?.message);
      }
      return jsonResponse(globalCachedTickets || []);
    }

    if (method === 'POST' && pathname === '/api/tickets') {
      const body = await request.json();
      const { hostname, userName, category, description, urgency, deviceId } = body || {};
      if (!hostname || !userName || !description) {
        return jsonResponse({ error: 'Nombre de usuario, equipo y descripción son obligatorios.' }, 400);
      }

      const cleanUserName = sanitizeInput(userName, 100);
      const cleanDesc = sanitizeInput(description, 3000);
      const cleanCat = sanitizeInput(category || 'General', 100);
      const cleanUrg = sanitizeInput(urgency || 'media', 20);

      const now = new Date().toISOString();
      const ticketId = await getNextTicketId(db);
      const cleanHost = hostname.trim().toUpperCase();

      const newTicket = {
        id: ticketId,
        deviceId: deviceId || null,
        hostname: cleanHost,
        userName: cleanUserName,
        category: cleanCat,
        description: cleanDesc,
        urgency: cleanUrg,
        status: 'abierto',
        createdAt: now,
        resolvedAt: null
      };

      globalCachedTickets = [newTicket, ...globalCachedTickets.filter(t => t.id !== ticketId)];

      const ticketLog = {
        id: `log-${shortUuid()}`,
        deviceId: deviceId || null,
        hostname: cleanHost,
        action: 'TICKET_CREADO',
        details: `Incidencia [${ticketId}] reportada por ${cleanUserName}: [${cleanCat}] ${cleanDesc.slice(0, 80)}...`,
        performedBy: cleanUserName,
        timestamp: now
      };
      globalCachedLogs = [ticketLog, ...globalCachedLogs];

      try {
        if (db) {
          await db.batch([
            db.prepare(`
              INSERT INTO support_tickets (id, deviceId, hostname, userName, category, description, urgency, status, createdAt)
              VALUES (?, ?, ?, ?, ?, ?, ?, 'abierto', ?)
            `).bind(ticketId, deviceId || null, cleanHost, cleanUserName, cleanCat, cleanDesc, cleanUrg, now),
            db.prepare(`
              INSERT INTO audit_logs (id, deviceId, hostname, action, details, performedBy, timestamp)
              VALUES (?, ?, ?, 'TICKET_CREADO', ?, ?, ?)
            `).bind(ticketLog.id, deviceId || null, cleanHost, ticketLog.details, cleanUserName, now)
          ]);
        }
      } catch (err) {
        console.warn('[D1 Ticket Insert Fallback]:', err?.message);
      }

      await touchSyncVersion(db);

      // Despacho Web Push a todos los celulares y navegadores registrados
      try {
        await dispatchPushToAllSubscribers(db, newTicket);
      } catch (pushErr) {
        console.warn('Error al despachar push notification:', pushErr);
      }

      return jsonResponse({
        success: true,
        id: ticketId,
        message: 'Incidencia registrada con éxito en Soporte TI Cloud 24/7.',
        ticket: newTicket
      });
    }

    const ticketMatch = pathname.match(/^\/api\/tickets\/([^/]+)$/);
    if (ticketMatch && method === 'PUT') {
      const ticketId = decodeURIComponent(ticketMatch[1]);
      let existing = null;
      try {
        if (db) existing = await db.prepare('SELECT * FROM support_tickets WHERE id = ?').bind(ticketId).first();
      } catch (err) {
        console.warn('[D1 Existing Ticket Fallback]:', err?.message);
      }
      if (!existing) {
        existing = globalCachedTickets.find(t => t.id === ticketId);
      }
      if (!existing) return jsonResponse({ error: 'Ticket no encontrado' }, 404);

      const body = await request.json();
      const { status, solutionNotes } = body || {};
      const cleanSolution = solutionNotes ? sanitizeInput(solutionNotes, 4000) : null;
      const now = new Date().toISOString();
      const resolvedAt = status === 'resuelto' ? now : (status === 'abierto' || status === 'en_progreso' ? null : (existing.resolvedAt || null));

      const updatedTicket = {
        ...existing,
        status: status !== undefined ? status : existing.status,
        solutionNotes: cleanSolution !== null ? cleanSolution : existing.solutionNotes,
        resolvedAt
      };
      globalCachedTickets = globalCachedTickets.map(t => t.id === ticketId ? updatedTicket : t);

      try {
        if (db) {
          await db.prepare(`
            UPDATE support_tickets SET
              status = COALESCE(?, status),
              solutionNotes = COALESCE(?, solutionNotes),
              resolvedAt = ?
            WHERE id = ?
          `).bind(status ?? null, cleanSolution ?? null, resolvedAt, ticketId).run();
        }
      } catch (err) {
        console.warn('[D1 Ticket Update Fallback]:', err?.message);
      }

      const isNewlyResolved = status === 'resuelto' && existing.status !== 'resuelto';
      if (status === 'resuelto') {
        const descWords = (existing.description || '').toLowerCase().replace(/[^a-záéíóúñ0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3);
        const keywords = `${existing.category},${existing.hostname},${descWords.slice(0, 8).join(',')}`;

        let autoAction = 'none';
        let autoLabel = null;
        const qText = `${existing.category} ${existing.description}`.toLowerCase();
        if (qText.includes('pantalla') || qText.includes('proyec') || qText.includes('clon') || qText.includes('segunda')) {
          autoAction = 'display_clone';
          autoLabel = 'Duplicar Pantalla Ahora (1-Clic)';
        } else if (qText.includes('impres') || qText.includes('spooler') || qText.includes('cola')) {
          autoAction = 'restart_spooler';
          autoLabel = 'Reiniciar Cola de Impresión Spooler (1-Clic)';
        } else if (qText.includes('dns') || qText.includes('red') || qText.includes('internet') || qText.includes('ping')) {
          autoAction = 'flush_dns';
          autoLabel = 'Limpiar Caché DNS de Windows';
        }

        try {
          if (cleanSolution && cleanSolution.trim().length > 3) {
            if (db) {
              await db.prepare(`
                INSERT INTO stivie_knowledge (id, triggerKeywords, category, questionPattern, solutionText, actionType, actionLabel, helpfulCount, learnedFrom, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'solucion_ticket_soporte', ?, ?)
              `).bind(`k-learn-${shortUuid()}`, keywords, existing.category, existing.description, cleanSolution.trim(), autoAction, autoLabel, now, now).run();
            }
          } else if (isNewlyResolved) {
            let autoSolution = `Incidencia de ${existing.category.toLowerCase()} atendida y resuelta satisfactoriamente por Soporte TI en ${existing.hostname}. Componentes y funcionamiento operativo validados.`;
            if (autoAction === 'display_clone') {
              autoSolution = `Para incidencias de proyección en ${existing.hostname}, la solución nativa verificada es duplicar pantalla (DisplaySwitch /clone). Puedes activarla con el botón directo.`;
            } else if (autoAction === 'restart_spooler') {
              autoSolution = `Para problemas de impresión en ${existing.hostname}, se resolvió desbloqueando el servicio Spooler de Windows. Puedes reiniciar la cola con el botón de acción directa.`;
            } else if (autoAction === 'flush_dns') {
              autoSolution = `Para problemas de navegación en ${existing.hostname}, se validó la limpieza de caché DNS y renovación de red. Puedes ejecutar la limpieza con el botón directo.`;
            }

            if (db) {
              await db.prepare(`
                INSERT INTO stivie_knowledge (id, triggerKeywords, category, questionPattern, solutionText, actionType, actionLabel, helpfulCount, learnedFrom, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'auto_aprendizaje_caso_atendido', ?, ?)
              `).bind(`k-learn-${shortUuid()}`, keywords, existing.category, existing.description, autoSolution, autoAction, autoLabel, now, now).run();
            }
          }
        } catch (err) {
          console.warn('[D1 Stivie Learn Fallback]:', err?.message);
        }
      }

      await touchSyncVersion(db);
      return jsonResponse(updatedTicket);
    }

    if (method === 'POST' && pathname === '/api/stivie/chat') {
      const body = await request.json();
      const query = body.query || body.message || '';
      const hostname = body.hostname || '';
      const userName = body.userName || body.user || '';
      if (!query || !query.trim()) return jsonResponse({ error: 'La consulta no puede estar vacía' }, 400);

      const qLower = query.toLowerCase().trim();
      const now = new Date().toISOString();
      const queryWords = qLower.replace(/[^a-záéíóúñ0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2);

      if (qLower.includes('quien es stivie en realidad') || qLower.includes('quién es stivie en realidad')) {
        const realReply = 'Es Tayron Salinas, desarrollador de esta aplicación.';
        return jsonResponse({ answer: realReply, reply: realReply, actionType: 'none', actionLabel: null, matchedCategory: 'Identidad STIVIE', knowledgeId: null, learned: true });
      }
      if (qLower.includes('quien es stivie') || qLower.includes('quién es stivie')) {
        const assistantReply = 'Soy STIVIE, tu Asistente de Operaciones Virtual 24/7. Puedo ayudarte con incidencias de pantalla, red, impresión, rendimiento y crear tickets en tiempo real para Soporte TI.';
        return jsonResponse({ answer: assistantReply, reply: assistantReply, actionType: 'none', actionLabel: null, matchedCategory: 'Identidad STIVIE', knowledgeId: null, learned: true });
      }
      if (qLower.includes('quien desarrollo') || qLower.includes('quién desarrolló') || qLower.includes('quien creo') || qLower.includes('quién creó') || qLower.includes('desarrollador de stivie')) {
        return jsonResponse({ answer: 'Tayron Salinas', reply: 'Tayron Salinas', actionType: 'none', actionLabel: null, matchedCategory: 'Identidad STIVIE', knowledgeId: null, learned: true });
      }

      let deviceContext = null;
      if (hostname) {
        deviceContext = await db.prepare('SELECT * FROM devices WHERE UPPER(hostname) = ?').bind(hostname.toUpperCase()).first();
      }

      if (['duplicar', 'pantalla', 'proyector', 'segunda pantalla', 'clonar', 'no proyecta', 'reflejar'].some(w => qLower.includes(w))) {
        const screenReply = `¡Hola ${userName || 'Compañero'}! He detectado que necesitas proyectar o duplicar la pantalla. Puedes duplicar tu pantalla al instante con el botón de acción directa a continuación:`;
        return jsonResponse({
          answer: screenReply, reply: screenReply, actionType: 'display_clone',
          actionLabel: '🪟 Duplicar Pantalla Ahora (1-Clic Nativo)',
          action: { type: 'display_clone', label: '🪟 Duplicar Pantalla Ahora (1-Clic Nativo)' },
          matchedCategory: 'Pantalla', knowledgeId: 'k-01', learned: true
        });
      }

      if (['cola de impresion', 'impresora trabada', 'no imprime', 'reiniciar spooler', 'cola atascada'].some(w => qLower.includes(w))) {
        const spoolerReply = `¡Hola ${userName || 'Compañero'}! He detectado documentos atascados en la cola de impresión. Puedes reiniciar el servicio Spooler con el botón a continuación:`;
        return jsonResponse({
          answer: spoolerReply, reply: spoolerReply, actionType: 'restart_spooler',
          actionLabel: '🖨️ Reiniciar Cola de Impresión Spooler (1-Clic)',
          action: { type: 'restart_spooler', label: '🖨️ Reiniciar Cola de Impresión Spooler (1-Clic)' },
          matchedCategory: 'Impresión', knowledgeId: 'k-04', learned: true
        });
      }

      const aiResult = await queryFreeAIReasoning(query, hostname, userName, deviceContext);
      if (aiResult && aiResult.text) {
        let actionType = 'open_ticket_form';
        let actionLabel = '📋 Notificar a Técnico de Soporte TI';
        if (qLower.includes('impres') || qLower.includes('spooler') || qLower.includes('cola')) {
          actionType = 'restart_spooler'; actionLabel = '🖨️ Reiniciar Cola de Impresión Spooler (1-Clic)';
        } else if (qLower.includes('pantalla') || qLower.includes('proyector') || qLower.includes('duplicar')) {
          actionType = 'display_clone'; actionLabel = '🪟 Duplicar Pantalla Ahora (1-Clic)';
        } else if (qLower.includes('dns') || qLower.includes('ping') || (qLower.includes('internet') && qLower.includes('lento'))) {
          actionType = 'flush_dns'; actionLabel = '⚡ Limpiar Caché DNS de Windows';
        }
        try {
          await db.prepare(`
            INSERT INTO stivie_knowledge (id, triggerKeywords, category, questionPattern, solutionText, actionType, helpfulCount, learnedFrom, createdAt, updatedAt)
            VALUES (?, ?, 'IA Razonamiento Libre', ?, ?, ?, 1, ?, ?, ?)
          `).bind(`k-ai-${shortUuid()}`, queryWords.slice(0, 8).join(','), query, aiResult.text, actionType, `ia_${aiResult.model}`, now, now).run();
        } catch {}

        return jsonResponse({
          answer: aiResult.text, reply: aiResult.text, actionType, actionLabel,
          action: { type: actionType, label: actionLabel },
          matchedCategory: 'IA Razonamiento Libre', knowledgeId: null, learned: true, model: aiResult.model
        });
      }

      const { results: allKnowledge } = await db.prepare('SELECT * FROM stivie_knowledge ORDER BY helpfulCount DESC').all();
      let bestMatch = null;
      let highestScore = 0;
      for (const item of (allKnowledge || [])) {
        let score = 0;
        const keywords = (item.triggerKeywords || '').toLowerCase().split(',');
        const pattern = (item.questionPattern || '').toLowerCase();
        for (const word of queryWords) {
          if (keywords.some(k => k.trim() === word)) score += 3;
          if (pattern.includes(word)) score += 2;
          if ((item.category || '').toLowerCase() === word) score += 1;
        }
        if (score > highestScore) { highestScore = score; bestMatch = item; }
      }

      if (bestMatch && highestScore >= 3) {
        const actionObj = bestMatch.actionType && bestMatch.actionType !== 'none'
          ? { type: bestMatch.actionType, label: bestMatch.actionLabel || 'Ejecutar Solución' } : undefined;
        return jsonResponse({
          answer: bestMatch.solutionText, reply: bestMatch.solutionText,
          actionType: bestMatch.actionType || 'none', actionLabel: bestMatch.actionLabel || null,
          action: actionObj, matchedCategory: bestMatch.category, knowledgeId: bestMatch.id, learned: true
        });
      }

      const fallbackAnswer = `He recibido tu consulta sobre "${query}". Te recomiendo verificar las conexiones físicas o generar un reporte directo para que Soporte TI te atienda de inmediato.`;
      return jsonResponse({
        answer: fallbackAnswer, reply: fallbackAnswer,
        actionType: 'open_ticket_form', actionLabel: '📋 Crear Reporte de Incidencia TI',
        action: { type: 'open_ticket_form', label: '📋 Crear Reporte de Incidencia TI' },
        matchedCategory: 'General', knowledgeId: null, learned: false
      });
    }

    if (method === 'POST' && pathname === '/api/stivie/feedback') {
      const body = await request.json();
      if (body.knowledgeId) {
        await db.prepare('UPDATE stivie_knowledge SET helpfulCount = helpfulCount + ?, updatedAt = ? WHERE id = ?')
          .bind(body.wasHelpful ? 1 : -1, new Date().toISOString(), body.knowledgeId).run();
      }
      return jsonResponse({ success: true, message: '¡Gracias! STIVIE ha actualizado su aprendizaje en la nube.' });
    }

    if (method === 'POST' && pathname === '/api/stivie/solve-screen') {
      const body = await request.json();
      const host = (body.hostname || 'STATION').toUpperCase();
      const now = new Date().toISOString();
      if (body.hostname) await queueAgentCommand(db, host, 'display_clone', { timestamp: now });
      await db.prepare(`
        INSERT INTO audit_logs (id, deviceId, hostname, action, details, performedBy, timestamp)
        VALUES (?, NULL, ?, 'STIVIE_AUTO_SOLUCION', 'Duplicidad de pantalla solicitada por STIVIE (DisplaySwitch /clone)', 'Asistente STIVIE', ?)
      `).bind(`log-${shortUuid()}`, host, now).run();
      await touchSyncVersion(db);
      return jsonResponse({ success: true, message: '¡Listo! Orden de Modo Duplicado enviada a tu equipo.' });
    }

    if (method === 'GET' && pathname === '/api/stivie/knowledge') {
      const { results } = await db.prepare('SELECT * FROM stivie_knowledge ORDER BY helpfulCount DESC').all();
      return jsonResponse(results || []);
    }

    if (method === 'POST' && pathname === '/api/stivie/knowledge') {
      const body = await request.json();
      const { triggerKeywords, category, questionPattern, solutionText, actionType, actionLabel } = body || {};
      if (!triggerKeywords || !questionPattern || !solutionText) {
        return jsonResponse({ error: 'Palabras clave, patrón de pregunta y solución son obligatorios' }, 400);
      }
      const now = new Date().toISOString();
      const id = `k-admin-${shortUuid()}`;
      await db.prepare(`
        INSERT INTO stivie_knowledge (id, triggerKeywords, category, questionPattern, solutionText, actionType, actionLabel, helpfulCount, learnedFrom, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, 10, 'administrador_ti', ?, ?)
      `).bind(id, triggerKeywords, category || 'General', questionPattern, solutionText, actionType || 'none', actionLabel || null, now, now).run();
      await touchSyncVersion(db);
      return jsonResponse({ success: true, message: 'Nueva regla de aprendizaje guardada en la nube 24/7.', id });
    }

    // ------------------------------------------------------------------------
    // 6. EXCEL EXPORTS
    // ------------------------------------------------------------------------
    if (method === 'GET' && (pathname === '/api/export/excel' || pathname === '/api/export/inventory-excel')) {
      const { results } = await db.prepare('SELECT * FROM devices ORDER BY hostname ASC').all();
      const devices = results || [];
      const wb = new ExcelJS.Workbook();
      wb.creator = 'TAY-INVENTARIO / STIVIE CLOUD';
      wb.created = new Date();

      const pcColumns = [
        { header: 'HOSTNAME', key: 'hostname', width: 22 },
        { header: 'USUARIO', key: 'usuario', width: 20 },
        { header: 'BLOQUE', key: 'bloque', width: 14 },
        { header: 'AULA / AMBIENTE', key: 'ambiente', width: 24 },
        { header: 'MODELO PC', key: 'modelo', width: 44 },
        { header: 'NÚMERO DE SERIE', key: 'serie', width: 22 },
        { header: 'PLACA BASE', key: 'placa', width: 28 },
        { header: 'PROCESADOR', key: 'cpu', width: 32 },
        { header: 'MEMORIA RAM', key: 'ram', width: 16 },
        { header: 'ALMACENAMIENTO', key: 'storage', width: 22 },
        { header: 'MONITOR CONECTADO', key: 'monitor', width: 28 },
        { header: 'SERIE MONITOR', key: 'monitorSerie', width: 22 },
        { header: 'CARACT. MONITOR', key: 'monitorSpecs', width: 26 },
        { header: 'DIRECCIÓN IP', key: 'ip', width: 18 },
        { header: 'SISTEMA OPERATIVO', key: 'os', width: 24 },
        { header: 'ESTADO', key: 'estado', width: 16 }
      ];

      const mapDeviceToPcRow = (d) => ({
        hostname: toUpperStr(d.hostname, 'DESKTOP-EQUIPO'),
        usuario: toUpperStr(d.assignedUser, 'AUTONOMA'),
        bloque: extractBloqueStr(d.location),
        ambiente: extractAmbienteStr(d.department),
        modelo: toUpperStr(d.brand && d.model ? `${d.brand} ${d.model}` : (d.model || d.brand || 'ESTACIÓN DE TRABAJO')),
        serie: toUpperStr(d.serialNumber, 'S/N'),
        placa: toUpperStr(d.motherboard, 'PLACA BASE ESTÁNDAR'),
        cpu: toUpperStr(d.cpu, 'INTEL / AMD'),
        ram: toUpperStr(d.ram, '16 GB'),
        storage: toUpperStr(d.storage, '512 GB SSD'),
        monitor: toUpperStr(d.monitorBrand && d.monitorModel ? `${d.monitorBrand} ${d.monitorModel}` : (d.monitorModel || d.monitorBrand || '-')),
        monitorSerie: toUpperStr(d.monitorSerial, '-'),
        monitorSpecs: toUpperStr(d.monitorSpecs, '-'),
        ip: toUpperStr(d.ipAddress, '127.0.0.1'),
        os: toUpperStr(d.os, 'WINDOWS 11 PRO'),
        estado: toUpperStr(d.status, 'INSTALADO')
      });

      const caseDevices = devices.filter(d => !['laptop', 'printer', 'monitor', 'component', 'speaker', 'ecran', 'network'].includes(d.deviceType?.toLowerCase()));
      populateStyledWorksheet(wb.addWorksheet('CASE'), pcColumns, caseDevices.map(mapDeviceToPcRow));
      populateStyledWorksheet(wb.addWorksheet('LAPTOPS'), pcColumns, devices.filter(d => d.deviceType?.toLowerCase() === 'laptop').map(mapDeviceToPcRow));

      const monitorColumns = [
        { header: 'HOSTNAME', key: 'hostname', width: 22 },
        { header: 'USUARIO', key: 'usuario', width: 20 },
        { header: 'BLOQUE', key: 'bloque', width: 14 },
        { header: 'AULA / AMBIENTE', key: 'ambiente', width: 24 },
        { header: 'MODELO MONITOR', key: 'modelo', width: 38 },
        { header: 'NÚMERO DE SERIE', key: 'serie', width: 22 },
        { header: 'PULGADAS / RESOLUCIÓN', key: 'resolucion', width: 28 },
        { header: 'CONECTORES', key: 'conectores', width: 24 },
        { header: 'ESTADO', key: 'estado', width: 16 }
      ];
      const monitorSource = devices.filter(d => d.deviceType?.toLowerCase() === 'monitor');
      const monitorRows = (monitorSource.length > 0 ? monitorSource : caseDevices).map(d => ({
        hostname: toUpperStr(d.hostname),
        usuario: toUpperStr(d.assignedUser, 'AUTONOMA'),
        bloque: extractBloqueStr(d.location),
        ambiente: extractAmbienteStr(d.department),
        modelo: toUpperStr(
          d.monitorBrand && d.monitorModel ? `${d.monitorBrand} ${d.monitorModel}`
            : (d.monitorModel || d.monitorBrand || (d.deviceType === 'monitor' ? (d.brand ? `${d.brand} ${d.model}` : d.model) : 'MONITOR ESTÁNDAR'))
        ),
        serie: toUpperStr(d.monitorSerial || (d.deviceType === 'monitor' ? d.serialNumber : 'S/N')),
        resolucion: toUpperStr(d.monitorSpecs || (d.deviceType === 'monitor' ? d.specs : 'FULL HD 1080P')),
        conectores: 'HDMI / DISPLAYPORT / VGA',
        estado: toUpperStr(d.status, 'INSTALADO')
      }));
      populateStyledWorksheet(wb.addWorksheet('MONITOR'), monitorColumns, monitorRows);

      const periphCols = (modelHdr, col6, col7) => [
        { header: 'HOSTNAME', key: 'hostname', width: 22 },
        { header: 'USUARIO', key: 'usuario', width: 20 },
        { header: 'BLOQUE', key: 'bloque', width: 14 },
        { header: 'AULA / AMBIENTE', key: 'ambiente', width: 24 },
        { header: modelHdr, key: 'modelo', width: 36 },
        { header: 'NÚMERO DE SERIE', key: 'serie', width: 22 },
        { header: col6, key: 'c6', width: 24 },
        { header: col7, key: 'c7', width: 28 },
        { header: 'ESTADO', key: 'estado', width: 16 }
      ];

      populateStyledWorksheet(wb.addWorksheet('TECLADO'), periphCols('MODELO TECLADO', 'TIPO CONEXIÓN', 'DISTRIBUCIÓN / IDIOMA'),
        caseDevices.map(d => ({
          hostname: toUpperStr(d.hostname), usuario: toUpperStr(d.assignedUser, 'AUTONOMA'),
          bloque: extractBloqueStr(d.location), ambiente: extractAmbienteStr(d.department),
          modelo: toUpperStr(d.brand ? `${d.brand} TECLADO USB` : 'TECLADO CORPORATIVO USB'),
          serie: toUpperStr(d.serialNumber ? `${d.serialNumber}-KB` : 'KB-SN-102'),
          c6: 'USB ALÁMBRICO', c7: 'ESPAÑOL LATINOAMÉRICA (QWERTY)', estado: toUpperStr(d.status, 'INSTALADO')
        }))
      );

      populateStyledWorksheet(wb.addWorksheet('AUDÍFONOS'), periphCols('MODELO AUDÍFONOS', 'CONECTOR', 'MICRÓFONO'),
        caseDevices.map(d => ({
          hostname: toUpperStr(d.hostname), usuario: toUpperStr(d.assignedUser, 'AUTONOMA'),
          bloque: extractBloqueStr(d.location), ambiente: extractAmbienteStr(d.department),
          modelo: 'HEADSET MULTIMEDIA ESTÉREO CON MICRÓFONO',
          serie: toUpperStr(d.serialNumber ? `${d.serialNumber}-AUD` : 'AUD-SN-304'),
          c6: 'JACK 3.5MM / USB', c7: 'INTEGRADO CON CANCELACIÓN DE RUIDO', estado: toUpperStr(d.status, 'INSTALADO')
        }))
      );

      populateStyledWorksheet(wb.addWorksheet('MOUSE'), periphCols('MODELO MOUSE', 'TIPO SENSOR / CONEXIÓN', 'DPI / BOTONES'),
        caseDevices.map(d => ({
          hostname: toUpperStr(d.hostname), usuario: toUpperStr(d.assignedUser, 'AUTONOMA'),
          bloque: extractBloqueStr(d.location), ambiente: extractAmbienteStr(d.department),
          modelo: toUpperStr(d.brand ? `${d.brand} MOUSE ÓPTICO USB` : 'MOUSE ÓPTICO USB 1200 DPI'),
          serie: toUpperStr(d.serialNumber ? `${d.serialNumber}-MS` : 'MS-SN-204'),
          c6: 'ÓPTICO PRECISO / USB ALÁMBRICO', c7: '1200 DPI / 3 BOTONES', estado: toUpperStr(d.status, 'INSTALADO')
        }))
      );

      populateStyledWorksheet(wb.addWorksheet('IMPRESORAS'), periphCols('MODELO IMPRESORA', 'TIPO IMPRESIÓN', 'DIRECCIÓN IP / RED'),
        devices.filter(d => d.deviceType?.toLowerCase() === 'printer').map(d => ({
          hostname: toUpperStr(d.hostname), usuario: toUpperStr(d.assignedUser, 'COMPARTIDA RED'),
          bloque: extractBloqueStr(d.location), ambiente: extractAmbienteStr(d.department),
          modelo: toUpperStr(d.brand && d.model ? `${d.brand} ${d.model}` : (d.model || 'IMPRESORA MULTIFUNCIONAL')),
          serie: toUpperStr(d.serialNumber, 'S/N'),
          c6: 'MULTIFUNCIONAL INYECCIÓN / LÁSER', c7: toUpperStr(d.ipAddress, '192.168.1.150'), estado: toUpperStr(d.status, 'INSTALADO')
        }))
      );

      const hwComponents = devices.filter(d => d.deviceType?.toLowerCase() === 'component');
      if (hwComponents.length > 0) {
        const hwColumns = [
          { header: 'CÓDIGO / ID', key: 'codigo', width: 20 },
          { header: 'CATEGORÍA COMPONENTE', key: 'categoria', width: 26 },
          { header: 'MARCA Y MODELO', key: 'modelo', width: 36 },
          { header: 'NÚMERO DE SERIE / P/N', key: 'serie', width: 24 },
          { header: 'ESPECIFICACIONES TÉCNICAS', key: 'specs', width: 48 },
          { header: 'UBICACIÓN / EQUIPO', key: 'ubicacion', width: 28 },
          { header: 'ÁREA / RESPONSABLE', key: 'responsable', width: 24 },
          { header: 'ESTADO', key: 'estado', width: 16 }
        ];
        populateStyledWorksheet(
          wb.addWorksheet('COMPONENTES HW'),
          hwColumns,
          hwComponents.map(d => ({
            codigo: toUpperStr(d.hostname, 'HW-0001'),
            categoria: toUpperStr((d.os || '').replace(/^Componente:\s*/i, ''), 'COMPONENTE HW'),
            modelo: toUpperStr(d.brand && d.model ? `${d.brand} ${d.model}` : (d.model || d.brand || 'GENÉRICO')),
            serie: toUpperStr(d.serialNumber, 'S/N'),
            specs: toUpperStr(d.specs || d.notes, 'ESTÁNDAR'),
            ubicacion: toUpperStr(d.location, 'ALMACÉN TI'),
            responsable: toUpperStr(d.assignedUser || d.department, 'SOPORTE TI'),
            estado: toUpperStr(d.status, 'CUSTODIA')
          }))
        );
      }

      const buffer = await wb.xlsx.writeBuffer();
      return new Response(buffer, {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="Inventario_Equipos_${new Date().toISOString().slice(0, 10)}.xlsx"`
        }
      });
    }

    if (method === 'GET' && (pathname === '/api/export/support-excel' || pathname === '/api/export/tickets-excel')) {
      const [{ results: tRes }, { results: dRes }] = await Promise.all([
        db.prepare('SELECT * FROM support_tickets ORDER BY createdAt DESC').all(),
        db.prepare('SELECT * FROM devices').all()
      ]);
      const tickets = tRes || [];
      const deviceMap = {};
      (dRes || []).forEach(d => { deviceMap[d.hostname] = d; });

      const wb = new ExcelJS.Workbook();
      wb.creator = 'SISTEMA DE SOPORTE TI / STIVIE CLOUD';
      const ticketColumns = [
        { header: 'HOSTNAME', key: 'hostname', width: 22 },
        { header: 'USUARIO', key: 'usuario', width: 22 },
        { header: 'BLOQUE', key: 'bloque', width: 14 },
        { header: 'AULA / AMBIENTE', key: 'ambiente', width: 24 },
        { header: 'ID TICKET', key: 'id', width: 16 },
        { header: 'CATEGORÍA', key: 'categoria', width: 22 },
        { header: 'URGENCIA', key: 'urgencia', width: 14 },
        { header: 'ESTADO', key: 'estado', width: 16 },
        { header: 'DESCRIPCIÓN DE LA FALLA', key: 'descripcion', width: 45 },
        { header: 'SOLUCIÓN / PROCEDIMIENTO', key: 'solucion', width: 45 },
        { header: 'FECHA CREACIÓN', key: 'creado', width: 22 },
        { header: 'FECHA RESOLUCIÓN', key: 'resuelto', width: 22 }
      ];

      const mapTicketRow = (t) => {
        const dev = deviceMap[t.hostname];
        return {
          hostname: toUpperStr(t.hostname, 'PC-SOPORTE'),
          usuario: toUpperStr(t.userName, 'AUTONOMA'),
          bloque: extractBloqueStr(dev?.location),
          ambiente: extractAmbienteStr(dev?.department),
          id: toUpperStr(t.id),
          categoria: toUpperStr(t.category, 'GENERAL'),
          urgencia: toUpperStr(t.urgency, 'MEDIA'),
          estado: toUpperStr(t.status, 'ABIERTO'),
          descripcion: toUpperStr(t.description),
          solucion: toUpperStr(t.solutionNotes, 'EN DIAGNÓSTICO / PENDIENTE'),
          creado: t.createdAt ? toUpperStr(new Date(t.createdAt).toLocaleString()) : '',
          resuelto: t.resolvedAt ? toUpperStr(new Date(t.resolvedAt).toLocaleString()) : 'PENDIENTE'
        };
      };

      populateStyledWorksheet(wb.addWorksheet('HISTORIAL REPORTES'), ticketColumns, tickets.map(mapTicketRow));
      populateStyledWorksheet(wb.addWorksheet('CASOS ABIERTOS'), ticketColumns, tickets.filter(t => t.status?.toLowerCase() === 'abierto').map(mapTicketRow));
      populateStyledWorksheet(wb.addWorksheet('EN ATENCIÓN'), ticketColumns, tickets.filter(t => t.status?.toLowerCase() === 'en_progreso').map(mapTicketRow));
      populateStyledWorksheet(wb.addWorksheet('RESUELTOS'), ticketColumns, tickets.filter(t => t.status?.toLowerCase() === 'resuelto').map(mapTicketRow));

      // 5. SHEET: RANKING EQUIPOS
      const hostColumns = [
        { header: 'HOSTNAME', key: 'hostname', width: 24 },
        { header: 'TOTAL INCIDENCIAS', key: 'total', width: 20 },
        { header: 'CASOS PENDIENTES', key: 'abiertos', width: 20 },
        { header: 'CASOS RESUELTOS', key: 'resueltos', width: 20 },
        { header: 'FALLA MÁS COMÚN', key: 'topCat', width: 28 },
        { header: 'USUARIOS REPORTANTES', key: 'usuarios', width: 36 }
      ];

      const hostMap = {};
      tickets.forEach(t => {
        const h = toUpperStr(t.hostname, 'DESCONOCIDO');
        if (!hostMap[h]) {
          hostMap[h] = { hostname: h, total: 0, abiertos: 0, resueltos: 0, categories: {}, users: new Set() };
        }
        hostMap[h].total++;
        if (t.status === 'resuelto') hostMap[h].resueltos++;
        else hostMap[h].abiertos++;
        hostMap[h].categories[t.category] = (hostMap[h].categories[t.category] || 0) + 1;
        if (t.userName) hostMap[h].users.add(toUpperStr(t.userName));
      });

      const hostRankingRows = Object.values(hostMap)
        .sort((a, b) => b.total - a.total)
        .map(h => {
          const topCat = Object.entries(h.categories).sort((a, b) => b[1] - a[1])[0]?.[0] || 'GENERAL';
          return {
            hostname: h.hostname,
            total: h.total,
            abiertos: h.abiertos,
            resueltos: h.resueltos,
            topCat: toUpperStr(topCat),
            usuarios: Array.from(h.users).join(', ')
          };
        });

      populateStyledWorksheet(wb.addWorksheet('RANKING EQUIPOS'), hostColumns, hostRankingRows);

      const buffer = await wb.xlsx.writeBuffer();
      return new Response(buffer, {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="Reportes_Soporte_TI_${new Date().toISOString().slice(0, 10)}.xlsx"`
        }
      });
    }

    return jsonResponse({ error: `Ruta no encontrada: ${method} ${pathname}` }, 404);
  } catch (err) {
    return jsonResponse({ error: err?.message || 'Error interno en el servidor Edge Cloud' }, 500);
  }
}
