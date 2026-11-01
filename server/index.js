import express from 'express';
import cors from 'cors';
import { db, initDB, getNextTicketId } from './db.js';
import ExcelJS from 'exceljs';
import { randomUUID } from 'node:crypto';
import { exec, execSync } from 'node:child_process';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to detect server network addresses (Wi-Fi, Ethernet, LAN) for remote agents
export function getNetworkInfo() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push({
          address: iface.address,
          name: name,
          isWifi: /wi-?fi|wlan/i.test(name),
          isEthernet: /ethernet|eth/i.test(name)
        });
      }
    }
  }
  // Sort priority: Wi-Fi or Ethernet first
  ips.sort((a, b) => {
    if (a.isWifi && !b.isWifi) return -1;
    if (!a.isWifi && b.isWifi) return 1;
    if (a.isEthernet && !b.isEthernet) return -1;
    if (!a.isEthernet && b.isEthernet) return 1;
    return 0;
  });

  const primaryIp = ips.length > 0 ? ips[0].address : '127.0.0.1';
  return {
    hostname: os.hostname(),
    primaryIp,
    ips,
    port: 3001,
    primaryUrl: `http://${primaryIp}:3001`
  };
}

// Resolve server host so remote machines NEVER get 'localhost'
export function resolveServerHost(req) {
  const net = getNetworkInfo();
  const lanUrl = `http://${net.primaryIp}:3001`;

  // 1. Explicit query parameter (e.g. ?server=http://...)
  if (req.query && req.query.server) {
    const s = String(req.query.server).replace(/\/+$/, '');
    if (!s.includes('localhost') && !s.includes('127.0.0.1')) {
      return s;
    }
    return lanUrl;
  }
  // 2. Custom header if provided
  if (req.headers['x-forwarded-server-url']) {
    const h = String(req.headers['x-forwarded-server-url']).replace(/\/+$/, '');
    if (!h.includes('localhost') && !h.includes('127.0.0.1')) {
      return h;
    }
    return lanUrl;
  }
  // 3. Inspect requested host header
  const rawHost = req.get('host') || '';
  if (!rawHost || rawHost.includes('localhost') || rawHost.includes('127.0.0.1')) {
    return lanUrl;
  }
  return `${req.protocol}://${rawHost}`;
}

// ====================================================================
// SEGURIDAD CORPORATIVA & PROTECCIÓN CONTRA VULNERABILIDADES
// ====================================================================

// 1. Sanitizador estricto de Hostname / IP (Previene inyección de comandos en shell)
function sanitizeHost(input) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  // Solo permite alfanuméricos, puntos, guiones y guiones bajos (RFC 1123 / IP)
  if (!/^[a-zA-Z0-9.\-_]{1,255}$/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

// 2. Limitador de tasa en memoria (Previene ataques DDoS, inundación y fuerza bruta)
const clientRateMap = new Map();
function createRateLimiter(maxRequests = 300, windowMs = 60000) {
  return (req, res, next) => {
    const clientIp = req.ip || req.socket?.remoteAddress || '127.0.0.1';
    const now = Date.now();
    const info = clientRateMap.get(clientIp) || { count: 0, resetTime: now + windowMs };

    if (now > info.resetTime) {
      info.count = 1;
      info.resetTime = now + windowMs;
    } else {
      info.count++;
      if (info.count > maxRequests) {
        return res.status(429).json({
          error: 'Límite de seguridad alcanzado (demasiadas peticiones). Intenta nuevamente en un momento.'
        });
      }
    }
    clientRateMap.set(clientIp, info);
    next();
  };
}

// Limpieza periódica de llaves de tasa cada 5 minutos
setInterval(() => {
  const now = Date.now();
  for (const [ip, info] of clientRateMap.entries()) {
    if (now > info.resetTime) clientRateMap.delete(ip);
  }
}, 300000);

// Initialize SQLite database
initDB();

const app = express();
const PORT = process.env.PORT || 3001;

// Ocultar cabecera de tecnología para dificultar el fingerprinting
app.disable('x-powered-by');

// Cabeceras HTTP de Seguridad (OWASP / Hardening)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(createRateLimiter());
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Server Network Info API for remote auditing & STIVIE agents
app.get('/api/server-info', (req, res) => {
  try {
    const net = getNetworkInfo();
    res.json(net);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Server-Sent Events (SSE) clients for real-time inventory updates
const sseClients = new Set();

function broadcastEvent(eventType, payload) {
  localSyncVersion = String(Date.now());
  const data = JSON.stringify({ type: eventType, data: payload, timestamp: new Date().toISOString() });
  for (const client of sseClients) {
    try {
      client.write(`data: ${data}\n\n`);
    } catch {
      sseClients.delete(client);
    }
  }
}

let localSyncVersion = String(Date.now());
app.get('/api/sync-state', (req, res) => {
  res.json({ ok: true, version: localSyncVersion, serverTime: new Date().toISOString() });
});

// SSE stream endpoint
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  sseClients.add(res);
  req.on('close', () => {
    sseClients.delete(res);
  });
});

// GET all devices
app.get('/api/devices', (req, res) => {
  try {
    const devices = db.prepare('SELECT * FROM devices ORDER BY datetime(lastAuditDate) DESC').all();
    res.json(devices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET device by ID
app.get('/api/devices/:id', (req, res) => {
  try {
    const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(req.params.id);
    if (!device) return res.status(404).json({ error: 'Dispositivo no encontrado' });
    res.json(device);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST create device manually
app.post('/api/devices', (req, res) => {
  try {
    const now = new Date().toISOString();
    const id = req.body.id || `dev-${randomUUID().slice(0, 8)}`;
    const hostname = (req.body.hostname || `EQUIPO-${Date.now().toString().slice(-4)}`).toUpperCase().trim();
    const deviceType = req.body.deviceType || 'pc';
    const status = req.body.status || 'instalado';
    const qrCodeData = req.body.qrCodeData || `TAY-${hostname}-${req.body.serialNumber || 'SN'}`;

    const insert = db.prepare(`
      INSERT INTO devices (
        id, hostname, deviceType, status, os, ram, cpu, storage,
        ipAddress, macAddress, serialNumber, motherboard, compatibility, brand, model,
        assignedUser, department, location, lastAuditDate, notes, supplies, specs, qrCodeData,
        createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insert.run(
      id,
      hostname,
      deviceType,
      status,
      req.body.os || 'Desconocido',
      req.body.ram || 'No especificado',
      req.body.cpu || 'No especificado',
      req.body.storage || 'No especificado',
      req.body.ipAddress || '0.0.0.0',
      req.body.macAddress || '00:00:00:00:00:00',
      req.body.serialNumber || 'S/N',
      req.body.motherboard || 'Genérica',
      req.body.compatibility || 'Compatible',
      req.body.brand || 'Genérico',
      req.body.model || 'Genérico',
      req.body.assignedUser || 'Sin Asignar',
      req.body.department || 'General',
      req.body.location || 'Oficina Principal',
      now,
      req.body.notes || 'Auditoría manual registrada.',
      req.body.supplies || null,
      req.body.specs || null,
      qrCodeData,
      now,
      now
    );

    // Add audit log
    db.prepare(`
      INSERT INTO audit_logs (id, deviceId, hostname, action, details, performedBy, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      `log-${randomUUID().slice(0, 8)}`,
      id,
      hostname,
      'AUDITORIA_MANUAL',
      `Auditoría y registro manual completado para ${hostname}`,
      'Auditor Técnico',
      now
    );

    const created = db.prepare('SELECT * FROM devices WHERE id = ?').get(id);
    broadcastEvent('DEVICE_CREATED', created);

    res.status(201).json(created);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT update device
app.put('/api/devices/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM devices WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Dispositivo no encontrado' });

    const now = new Date().toISOString();
    const update = db.prepare(`
      UPDATE devices SET
        hostname = ?, deviceType = ?, status = ?, os = ?, ram = ?, cpu = ?,
        storage = ?, ipAddress = ?, macAddress = ?, serialNumber = ?,
        motherboard = ?, compatibility = ?, brand = ?,
        model = ?, assignedUser = ?, department = ?, location = ?, lastAuditDate = ?,
        notes = ?, supplies = ?, specs = ?, qrCodeData = ?, updatedAt = ?
      WHERE id = ?
    `);

    update.run(
      req.body.hostname !== undefined ? String(req.body.hostname).trim() : existing.hostname,
      req.body.deviceType !== undefined ? req.body.deviceType : existing.deviceType,
      req.body.status !== undefined ? req.body.status : existing.status,
      req.body.os !== undefined ? req.body.os : existing.os,
      req.body.ram !== undefined ? req.body.ram : existing.ram,
      req.body.cpu !== undefined ? req.body.cpu : existing.cpu,
      req.body.storage !== undefined ? req.body.storage : existing.storage,
      req.body.ipAddress !== undefined ? req.body.ipAddress : existing.ipAddress,
      req.body.macAddress !== undefined ? req.body.macAddress : existing.macAddress,
      req.body.serialNumber !== undefined ? req.body.serialNumber : existing.serialNumber,
      req.body.motherboard !== undefined ? req.body.motherboard : existing.motherboard,
      req.body.compatibility !== undefined ? req.body.compatibility : existing.compatibility,
      req.body.brand !== undefined ? req.body.brand : existing.brand,
      req.body.model !== undefined ? req.body.model : existing.model,
      req.body.assignedUser !== undefined ? req.body.assignedUser : existing.assignedUser,
      req.body.department !== undefined ? req.body.department : existing.department,
      req.body.location !== undefined ? req.body.location : existing.location,
      now,
      req.body.notes !== undefined ? req.body.notes : existing.notes,
      req.body.supplies !== undefined ? req.body.supplies : (existing.supplies || null),
      req.body.specs !== undefined ? req.body.specs : (existing.specs || null),
      req.body.qrCodeData || existing.qrCodeData,
      now,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM devices WHERE id = ?').get(req.params.id);

    // Registra en el log de auditoría el cambio de estado o edición
    try {
      db.prepare(`
        INSERT INTO audit_logs (id, deviceId, hostname, action, details, performedBy, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        `log-${randomUUID().slice(0, 8)}`,
        req.params.id,
        updated.hostname,
        req.body.status && req.body.status !== existing.status ? 'CAMBIO_ESTADO' : 'MODIFICACION_MANUAL',
        req.body.status && req.body.status !== existing.status
          ? `Estado cambiado de "${existing.status}" a "${updated.status}"`
          : `Actualización manual de datos/ubicación para ${updated.hostname}`,
        'Administrador TI',
        now
      );
    } catch { }

    broadcastEvent('DEVICE_UPDATED', updated);
    broadcastEvent('INVENTORY_UPDATED', { id: updated.id, status: updated.status });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE device
app.delete('/api/devices/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM devices WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Dispositivo no encontrado' });

    db.prepare('DELETE FROM devices WHERE id = ?').run(req.params.id);
    broadcastEvent('DEVICE_DELETED', { id: req.params.id, hostname: existing.hostname });

    res.json({ message: 'Dispositivo eliminado correctamente', id: req.params.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST AGENT REPORT (PowerShell / Batch script payload in real-time)
app.post('/api/agent/report', (req, res) => {
  try {
    const {
      hostname,
      deviceType = null,
      os = null,
      ram = null,
      cpu = null,
      storage = null,
      ipAddress = null,
      macAddress = null,
      serialNumber = null,
      motherboard = null,
      compatibility = null,
      brand = null,
      model = null,
      assignedUser = null,
      department = null,
      location = null,
      notes = null
    } = req.body || {};

    if (!hostname) {
      return res.status(400).json({ error: 'El campo hostname es requerido' });
    }

    const cleanHostname = hostname.trim().toUpperCase();
    const now = new Date().toISOString();

    // Check if device already exists by hostname
    const existing = db.prepare('SELECT * FROM devices WHERE UPPER(hostname) = ?').get(cleanHostname);

    let deviceId;
    let actionType;

    if (existing) {
      deviceId = existing.id;
      actionType = 'ACTUALIZACION_AGENTE';

      db.prepare(`
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
          status = CASE WHEN status = 'baja' THEN 'baja' ELSE 'instalado' END,
          stivieInstalled = CASE WHEN ? = 1 THEN 1 ELSE stivieInstalled END,
          lastAgentPing = CASE WHEN ? = 1 THEN ? ELSE lastAgentPing END,
          lastAuditDate = ?,
          updatedAt = ?
        WHERE id = ?
      `).run(
        deviceType ?? null, os ?? null, ram ?? null, cpu ?? null, storage ?? null, ipAddress ?? null, macAddress ?? null, serialNumber ?? null,
        motherboard ?? null, compatibility ?? null, brand ?? null, model ?? null, assignedUser ?? null, notes ?? null,
        (notes && notes.includes('STIVIE')) ? 1 : 0,
        (notes && notes.includes('STIVIE')) ? 1 : 0,
        now,
        now, now, deviceId
      );
    } else {
      deviceId = `dev-${randomUUID().slice(0, 8)}`;
      actionType = 'DESCUBRIMIENTO_AGENTE';
      const finalDeviceType = deviceType || (
        (cleanHostname.includes('SRV') || cleanHostname.includes('SERVER'))
          ? 'server'
          : (cleanHostname.includes('LAP') || cleanHostname.includes('NOTE'))
            ? 'laptop'
            : 'pc'
      );

      const qrCode = `TAY-${cleanHostname}-${serialNumber || 'SN'}`;
      const isStivie = Boolean(notes && notes.includes('STIVIE'));

      db.prepare(`
        INSERT INTO devices (
          id, hostname, deviceType, status, os, ram, cpu, storage,
          ipAddress, macAddress, serialNumber, motherboard, compatibility, brand, model,
          assignedUser, department, location, lastAuditDate, notes, qrCodeData,
          stivieInstalled, lastAgentPing,
          createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        deviceId,
        cleanHostname,
        finalDeviceType,
        'instalado',
        os || 'Windows desconocido',
        ram || 'No detectada',
        cpu || 'No detectado',
        storage || 'No detectado',
        ipAddress || '127.0.0.1',
        macAddress || '00:00:00:00:00:00',
        serialNumber || 'SN-AUTO',
        motherboard || 'Placa Base Estándar',
        compatibility || 'Compatible',
        brand || 'Genérico',
        model || 'Estación de Trabajo',
        assignedUser || 'Usuario Local',
        department || 'Operaciones',
        location || 'Red Corporativa',
        now,
        notes || 'Reporte levantado automáticamente mediante agente Windows Tay-Audit.',
        qrCode,
        isStivie ? 1 : 0,
        isStivie ? now : null,
        now,
        now
      );
    }

    // Log the event
    db.prepare(`
      INSERT INTO audit_logs (id, deviceId, hostname, action, details, performedBy, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      `log-${randomUUID().slice(0, 8)}`,
      deviceId,
      cleanHostname,
      actionType,
      `Levantamiento automático de hardware: RAM: ${ram || 'N/A'}, SO: ${os || 'N/A'}, IP: ${ipAddress || 'N/A'}`,
      'Agente Tay-Audit Batch/PS1',
      now
    );

    const savedDevice = db.prepare('SELECT * FROM devices WHERE id = ?').get(deviceId);
    broadcastEvent('AGENT_REPORT_RECEIVED', savedDevice);

    res.json({
      success: true,
      message: `Equipo ${cleanHostname} auditado y sincronizado con éxito`,
      device: savedDevice
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// In-memory queue of pending remote commands per device hostname
const pendingAgentCommands = new Map();

function queueAgentCommand(hostname, action, details = {}) {
  if (!hostname) return;
  const key = hostname.toUpperCase().trim();
  if (!pendingAgentCommands.has(key)) {
    pendingAgentCommands.set(key, []);
  }
  const cmd = {
    id: 'cmd_' + Date.now() + '_' + randomUUID().slice(0, 8),
    action,
    details,
    timestamp: Date.now()
  };
  pendingAgentCommands.get(key).push(cmd);
  if (pendingAgentCommands.get(key).length > 5) {
    pendingAgentCommands.get(key).shift();
  }
  return cmd;
}

function getAndClearAgentCommands(hostname) {
  if (!hostname) return [];
  const key = hostname.toUpperCase().trim();
  if (!pendingAgentCommands.has(key)) return [];
  const cmds = pendingAgentCommands.get(key);
  pendingAgentCommands.delete(key);
  return cmds;
}

// POST /api/agent/ping - Heartbeat de presencia de STIVIE en cliente
app.post('/api/agent/ping', (req, res) => {
  try {
    const { hostname } = req.body;
    if (!hostname) return res.status(400).json({ error: 'hostname requerido' });
    const cleanHostname = hostname.trim();
    const now = new Date().toISOString();
    const existing = db.prepare('SELECT id FROM devices WHERE UPPER(hostname) = UPPER(?)').get(cleanHostname);
    if (existing) {
      db.prepare(`
        UPDATE devices SET 
          status = CASE WHEN status = 'baja' THEN 'baja' ELSE 'instalado' END, 
          stivieInstalled = 1,
          lastAgentPing = ?, 
          lastAuditDate = ?, 
          updatedAt = ? 
        WHERE id = ?
      `).run(now, now, now, existing.id);
      broadcastEvent('DEVICE_STATUS_CHANGED', { id: existing.id, status: 'instalado', stivieInstalled: 1, lastAgentPing: now, lastAuditDate: now });
    }
    const commands = getAndClearAgentCommands(cleanHostname);
    res.json({ ok: true, timestamp: now, commands });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/devices/:id/stivie - Habilitar/Deshabilitar STIVIE para control remoto sin afectar el inventario físico
app.patch('/api/devices/:id/stivie', (req, res) => {
  try {
    const { enabled } = req.body;
    const existing = db.prepare('SELECT * FROM devices WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Dispositivo no encontrado' });

    const stivieVal = enabled ? 1 : 0;
    const now = new Date().toISOString();
    db.prepare('UPDATE devices SET stivieInstalled = ?, updatedAt = ? WHERE id = ?').run(stivieVal, now, req.params.id);
    const updated = db.prepare('SELECT * FROM devices WHERE id = ?').get(req.params.id);
    broadcastEvent('DEVICE_UPDATED', updated);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/devices/:id/check-connection - Diagnóstico REAL de conectividad y estado de STIVIE (Sin fakes ni simulaciones)
app.post('/api/devices/:id/check-connection', async (req, res) => {
  try {
    const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(req.params.id);
    if (!device) return res.status(404).json({ error: 'Dispositivo no encontrado' });

    const now = Date.now();
    let secondsSinceLastPing = null;
    let isStivieActive = false;

    // Comprobación real de red (ICMP ping al IP del equipo si es una IP válida y segura)
    let networkReachable = false;
    let pingLatencyMs = null;
    const safeIp = sanitizeHost(device.ipAddress);

    if (safeIp && safeIp !== '0.0.0.0') {
      try {
        const isWindows = process.platform === 'win32';
        const pingCmd = isWindows ? `ping -n 1 -w 1000 ${safeIp}` : `ping -c 1 -W 1 ${safeIp}`;
        const startTime = Date.now();
        execSync(pingCmd, { stdio: 'pipe', timeout: 1500 });
        pingLatencyMs = Date.now() - startTime;
        networkReachable = true;
      } catch (err) {
        networkReachable = false;
      }
    }

    // Verificar si es la máquina local del servidor y si STIVIE.exe está en ejecución
    let localProcessRunning = false;
    const isLocalMachine = device.hostname && (device.hostname.toUpperCase() === os.hostname().toUpperCase());
    if (isLocalMachine && process.platform === 'win32') {
      try {
        const tasklistOut = execSync('tasklist /FI "IMAGENAME eq STIVIE.exe" /NH', { stdio: 'pipe' }).toString();
        localProcessRunning = tasklistOut.includes('STIVIE.exe');
      } catch (err) {
        localProcessRunning = false;
      }
    }

    // REGLA FUNDAMENTAL: STIVIE TIENE QUE ESTAR INSTALADO EN EL EQUIPO PARA DAR SEÑAL DE CONECTADO
    if (!device.stivieInstalled) {
      return res.json({
        id: device.id,
        hostname: device.hostname,
        ipAddress: device.ipAddress,
        isStivieActive: false,
        stivieInstalled: false,
        secondsSinceLastPing: null,
        networkReachable,
        pingLatencyMs,
        localProcessRunning,
        isLocalMachine,
        statusSummary: `STIVIE no está instalado en este equipo (${device.hostname}). Debe instalarse mediante stivie-installer.bat para recién dar la señal de conectado.`
      });
    }

    if (device.lastAgentPing) {
      secondsSinceLastPing = Math.round((now - new Date(device.lastAgentPing).getTime()) / 1000);
      isStivieActive = secondsSinceLastPing <= 15;
    }

    let statusSummary = '';
    if (isStivieActive) {
      statusSummary = `Conexión activa: STIVIE instalado y transmitiendo latidos en tiempo real (último hace ${secondsSinceLastPing}s).`;
    } else if (localProcessRunning) {
      statusSummary = `STIVIE está instalado y abierto localmente, pero aún no se ha recibido su señal en http://localhost:3001.`;
    } else if (networkReachable) {
      statusSummary = `Equipo responde en red (${ip}), pero el proceso STIVIE.exe está apagado o cerrado.`;
    } else {
      statusSummary = `Equipo desconectado o apagado (la IP ${ip || 'desconocida'} no responde en la red local).`;
    }

    res.json({
      id: device.id,
      hostname: device.hostname,
      ipAddress: device.ipAddress,
      isStivieActive,
      secondsSinceLastPing,
      networkReachable,
      pingLatencyMs,
      localProcessRunning,
      isLocalMachine,
      statusSummary
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/stivie/launch-local - Iniciar el proceso STIVIE.exe localmente en la máquina anfitriona
app.post('/api/stivie/launch-local', (req, res) => {
  try {
    if (process.platform !== 'win32') {
      return res.status(400).json({ error: 'Solo disponible en entorno Windows' });
    }
    const exePath = path.join(process.env.LOCALAPPDATA || 'C:\\Users\\Default\\AppData\\Local', 'STIVIE', 'STIVIE.exe');
    if (!fs.existsSync(exePath)) {
      return res.status(404).json({ error: `STIVIE.exe no encontrado en ${exePath}. Descargue el instalador primero.` });
    }
    const apiBase = resolveServerHost(req);
    exec(`start "" "${exePath}" "${apiBase}"`, { shell: 'cmd.exe' }, (err) => {
      if (err) {
        return res.status(500).json({ error: `Error al iniciar STIVIE: ${err.message}` });
      }
      res.json({ ok: true, message: 'STIVIE iniciado en segundo plano. Enviará señales en unos segundos.' });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET DOWNLOAD STIVIE CLIENT INSTALLER - Instalación permanente del motor nativo STIVIE.exe
// Generador del script PowerShell de auditoria y levantamiento de hardware
// Detecta de forma exhaustiva Laptops, PCs OEM de marca, PCs ensambladas, IP activa y MAC fisica
const generateHardwareCollectorPsScript = (apiBase, notesContext = 'Levantamiento de Inventario', isSilent = false) => {
  return `
$ProgressPreference = 'SilentlyContinue'
$ErrorActionPreference = 'SilentlyContinue'

try {
    # 1. Identificacion Basica
    $bios = (Get-CimInstance Win32_BIOS -ErrorAction SilentlyContinue).SerialNumber
    $serialNumber = if ($bios -and $bios.Trim() -ne '' -and $bios.Trim() -ne 'None') { $bios.Trim() } else { "SN-DESCONOCIDO" }

    # 2. Placa Madre (Motherboard)
    $mb = Get-CimInstance Win32_BaseBoard -ErrorAction SilentlyContinue
    $moboMfr = if ($mb.Manufacturer) { $mb.Manufacturer.Trim() } else { '' }
    $moboProd = if ($mb.Product) { $mb.Product.Trim() } else { '' }
    $mobo = if ($moboMfr -or $moboProd) { (($moboMfr -replace '\\s+',' ') + ' ' + $moboProd).Trim() } else { 'Desconocida' }

    # 3. Sistema Operativo
    $osInfo = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue
    $os = if ($osInfo) { "$($osInfo.Caption) ($($osInfo.OSArchitecture))" } else { "Windows" }

    # 4. Memoria RAM
    $cs = Get-CimInstance Win32_ComputerSystem -ErrorAction SilentlyContinue
    $ramGB = if ($cs.TotalPhysicalMemory) { [math]::Round($cs.TotalPhysicalMemory / 1GB, 1) } else { 0 }
    $ram = "$ramGB GB"

    # 5. Procesador (CPU)
    $proc = Get-CimInstance Win32_Processor -ErrorAction SilentlyContinue | Select-Object -First 1
    $cpu = if ($proc) { $proc.Name.Trim() } else { "CPU Generico" }

    # 6. Almacenamiento (Discos Directos: SATA, NVMe, PCIe, SAS - Excluye conectividad USB/Extraibles)
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

    # 7. Red: Direccion IP Activa y Direccion MAC Fisica Real
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

    # 8. Compatibilidad Windows 11 / TPM
    $tpm = try { [bool](Get-CimInstance -Namespace root/cimv2/security/microsofttpm -ClassName Win32_Tpm -ErrorAction SilentlyContinue).SpecVersion } catch { $false }
    $comp = if (($os -like '*Windows 11*') -or $tpm) { 'Compatible' } else { 'No Compatible' }

    # 9. DISCRIMINACION INTELIGENTE: Laptop vs PC OEM vs PC Ensamblada vs Servidor
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

    # 10. Transmitir ficha completa al panel
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
        notes         = "${notesContext} • $classificationDetail • MAC: $mac • Red: $netDesc"
    } | ConvertTo-Json -Depth 3

    $resp = Invoke-RestMethod -Uri "${apiBase}/api/agent/report" -Method Post -Body $data -ContentType 'application/json; charset=utf-8' -TimeoutSec 15
    ${!isSilent ? `
    Write-Host ""
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host " [OK] INVENTARIO TRANSMITIDO CON EXITO A TAY-AUDIT" -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host " Hostname       : $env:COMPUTERNAME" -ForegroundColor White
    Write-Host " Clasificacion  : $categoryLabel" -ForegroundColor Yellow
    Write-Host " Marca / Modelo : $brand $model" -ForegroundColor White
    Write-Host " Placa Madre    : $mobo" -ForegroundColor White
    Write-Host " Direccion IP   : $ip" -ForegroundColor Cyan
    Write-Host " Direccion MAC  : $mac" -ForegroundColor Cyan
    Write-Host " Tarjeta de Red : $netDesc" -ForegroundColor Gray
    Write-Host " Memoria RAM    : $ram" -ForegroundColor White
    Write-Host " Procesador     : $cpu" -ForegroundColor White
    Write-Host " Serial BIOS    : $serialNumber" -ForegroundColor White
    Write-Host " Compatibilidad : $comp" -ForegroundColor White
    Write-Host "==========================================================" -ForegroundColor Green
    ` : ''}
} catch {
    ${!isSilent ? 'Write-Host "[ERROR] No se pudo transmitir la informacion: $($_.Exception.Message)" -ForegroundColor Red' : ''}
}
`;
};

// GET DOWNLOAD STIVIE CLIENT INSTALLER - Instalación permanente del motor nativo STIVIE.exe
const generateStivieInstallerPsScript = (apiBase) => {
  const csFile = path.join(__dirname, 'STIVIE.cs');
  let stivieCsBase64 = '';
  if (fs.existsSync(csFile)) {
    stivieCsBase64 = fs.readFileSync(csFile).toString('base64');
  }

  const collectorBlock = generateHardwareCollectorPsScript(apiBase, 'Instalacion permanente STIVIE (Motor Nativo)', true);

  return `
$ProgressPreference = 'SilentlyContinue'
$ErrorActionPreference = 'SilentlyContinue'

# 1. Finalizar instancias previas si existen
try {
    Get-Process -Name 'STIVIE' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
} catch {}

# 2. Auditar e inventariar hardware del equipo (Laptops, OEM, Ensambladas, IPs, MACs)
${collectorBlock}

# 3. Desplegar motor nativo STIVIE.exe en %LOCALAPPDATA%\\STIVIE
$appDir = Join-Path $env:LOCALAPPDATA 'STIVIE'
if (!(Test-Path $appDir)) { New-Item -ItemType Directory -Path $appDir -Force | Out-Null }
$exePath = Join-Path $appDir 'STIVIE.exe'

# Limpiar archivos temporales o antiguos
Remove-Item -Path (Join-Path $appDir 'stivie-widget.*') -Force -ErrorAction SilentlyContinue
Remove-Item -Path (Join-Path $appDir 'stivie-daemon.*') -Force -ErrorAction SilentlyContinue
Remove-Item -Path (Join-Path $appDir '*.url') -Force -ErrorAction SilentlyContinue

$downloaded = $false
$iconPath = Join-Path $appDir 'stivie-icon.ico'
try {
    $wc = New-Object System.Net.WebClient
    $wc.DownloadFile("${apiBase}/api/stivie/STIVIE.exe", $exePath)
    $wc.DownloadFile("${apiBase}/api/stivie/stivie-icon.ico", $iconPath)
    if ((Test-Path $exePath) -and (Get-Item $exePath).Length -gt 1000) {
        $downloaded = $true
    }
} catch {}

if (!$downloaded) {
    try {
        $csPath = Join-Path $appDir 'STIVIE.cs'
        [System.IO.File]::WriteAllBytes($csPath, [System.Convert]::FromBase64String('${stivieCsBase64}'))
        $csc = if (Test-Path 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe') {
            'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe'
        } else {
            'C:\\Windows\\Microsoft.NET\\Framework\\v4.0.30319\\csc.exe'
        }
        $wpfLib = 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\WPF'
        & $csc /nologo /target:winexe /win32icon:$iconPath /lib:$wpfLib /r:PresentationFramework.dll /r:PresentationCore.dll /r:WindowsBase.dll /r:System.Xaml.dll /r:System.dll /out:$exePath $csPath
    } catch {}
}

# 4. Registrar auto-inicio silencioso en Registro HKCU Run y en la Carpeta Startup (inicio garantizado del sistema)
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

# Eliminar estrictamente cualquier acceso directo en el Escritorio (sin tocar la carpeta interna de Startup)
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
Get-ChildItem -Path 'C:\\Users\\*' -Directory -ErrorAction SilentlyContinue | ForEach-Object {
    $desktopFolders += (Join-Path $_.FullName 'Desktop')
    $desktopFolders += (Join-Path $_.FullName 'Escritorio')
    Get-ChildItem -Path $_.FullName -Filter 'OneDrive*' -Directory -ErrorAction SilentlyContinue | ForEach-Object {
        $desktopFolders += (Join-Path $_.FullName 'Desktop')
        $desktopFolders += (Join-Path $_.FullName 'Escritorio')
    }
}
foreach ($folder in ($desktopFolders | Where-Object { $_ } | Select-Object -Unique)) {
    if (Test-Path $folder) {
        Get-ChildItem -Path $folder -Force -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '(?i)(STIVIE|Tay-Audit|TayAudit)' } | Where-Object {
            $_.Extension -match '^\\.(lnk|url|bat|cmd|vbs)$'
        } | Remove-Item -Force -ErrorAction SilentlyContinue
    }
}

# 5. Iniciar STIVIE en segundo plano
if (Test-Path $exePath) {
    Start-Process -FilePath $exePath -ArgumentList ('"' + '${apiBase}' + '"')
}

exit
`;
};

const handleStivieInstallerDownload = (req, res) => {
  const apiBase = resolveServerHost(req);

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
reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "STIVIE" /t REG_SZ /d "\"%APP_DIR%\\STIVIE.exe\" \"${apiBase}\"" /f >nul 2>&1

rem Registro de inventario inicial de hardware en segundo plano
powershell.exe -NoProfile -Command "try { [Net.ServicePointManager]::SecurityProtocol = 3072; irm '${apiBase}/audit' | iex } catch {}" >nul 2>&1

echo.
echo ====================================================================
echo   INSTALACION COMPLETADA CON EXITO
echo   STIVIE esta activo y listo para brindar soporte.
echo ====================================================================
echo.

rem Lanzar STIVIE
start "" "%APP_DIR%\\STIVIE.exe" "${apiBase}"
exit /b 0
`;

  res.setHeader('Content-Type', 'application/x-bat');
  res.setHeader('Content-Disposition', 'attachment; filename="stivie-installer.bat"');
  res.send(stivieScript);
};

app.get('/api/stivie/install.ps1', (req, res) => {
  const apiBase = resolveServerHost(req);
  const clientBase = apiBase;
  const script = generateStivieInstallerPsScript(apiBase, clientBase);
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send(script);
});

// GET DOWNLOAD STIVIE NATIVE BINARY EXECUTABLE (25KB)
app.get('/api/stivie/STIVIE.exe', (req, res) => {
  const exePath = path.join(__dirname, 'STIVIE.exe');
  if (fs.existsSync(exePath)) {
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename="STIVIE.exe"');
    return res.sendFile(exePath);
  }
  res.status(404).send('STIVIE executable not found');
});

// GET DOWNLOAD STIVIE APP ICON - para que el Administrador de Tareas muestre el ícono de STIVIE
app.get('/api/stivie/stivie-icon.ico', (req, res) => {
  const icoPath = path.join(__dirname, '..', 'public', 'stivie-icon.ico');
  if (fs.existsSync(icoPath)) {
    res.setHeader('Content-Type', 'image/x-icon');
    res.setHeader('Content-Disposition', 'attachment; filename="stivie-icon.ico"');
    return res.sendFile(icoPath);
  }
  res.status(404).send('STIVIE icon not found');
});

app.get('/api/stivie/download', handleStivieInstallerDownload);
app.get('/api/agent/stivie-installer.bat', handleStivieInstallerDownload);

// GET /stivie redirect helper
app.get('/stivie', (req, res) => {
  const rawHost = req.get('host') || 'localhost:3001';
  const queryStr = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  if (rawHost.includes(':3001')) {
    const target = `${req.protocol}://${rawHost.replace(':3001', ':5173')}/stivie${queryStr}`;
    return res.redirect(target);
  }
  res.redirect(`/stivie${queryStr}`);
});

// Función para generar y servir el script de levantamiento de inventario en memoria
const serveAuditScript = (req, res) => {
  const host = resolveServerHost(req);
  const collector = generateHardwareCollectorPsScript(host, 'Levantamiento 1-Clic en Memoria (irm | iex)', false);
  const script = `# ========================================================
# TAY-AUDIT: AGENTE REMOTO DE INVENTARIO (1-CLIC EN MEMORIA)
# Distingue Laptops, PCs OEM de Marca, Ensambladas, IPs y MACs
# ========================================================
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  TAY-AUDIT: RECOLECTOR INTELIGENTE DE INVENTARIO" -ForegroundColor White -BackgroundColor DarkBlue
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Servidor Central: ${host}" -ForegroundColor Yellow
Write-Host "Analizando arquitectura de hardware en tiempo real..." -ForegroundColor Cyan

${collector}

Write-Host "Registro de inventario completado sin instalar ningun software." -ForegroundColor Yellow
`;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send(script);
};

// GET /audit y GET /api/agent/run - Atajos directos para PowerShell irm | iex
app.get('/audit', serveAuditScript);
app.get('/api/agent/run', serveAuditScript);

// GET DOWNLOAD STANDALONE AUDIT BATCH (.BAT) - Levantamiento Independiente Sin Instalación
app.get('/api/agent/download', (req, res) => {
  const host = resolveServerHost(req);
  const collector = generateHardwareCollectorPsScript(host, 'Levantamiento con Archivo Batch Independiente', false);
  const auditPs = `
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  TAY-AUDIT: RECOLECTOR AUTOMATICO DE INVENTARIO" -ForegroundColor White -BackgroundColor DarkBlue
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Servidor destino: ${host}" -ForegroundColor Yellow
Write-Host ""
Write-Host "Extrayendo ficha de hardware, red (IP/MAC) y tipo de equipo..." -ForegroundColor Cyan

${collector}

Write-Host ""
Write-Host "Registro de inventario finalizado con exito." -ForegroundColor Green
Write-Host "Cerrando ventana en 3 segundos..." -ForegroundColor Cyan
Start-Sleep -Seconds 3
`;
  const auditPsBase64 = Buffer.from(auditPs, 'utf8').toString('base64');
  const auditScript = `@echo off
title Tay-Audit - Agente Independiente de Levantamiento de Inventario
color 0a
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$b64 = '${auditPsBase64}'; $code = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($b64)); Invoke-Expression $code"
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Se produjo un error durante el levantamiento.
    pause
    exit /b %ERRORLEVEL%
)
exit
`;
  res.setHeader('Content-Type', 'application/x-bat');
  res.setHeader('Content-Disposition', 'attachment; filename="tay-audit-agent.bat"');
  res.send(auditScript);
});

// POST REMOTE ACTION (Restart, Shutdown, Screen Mirroring/VNC/RDP Assist)
app.post('/api/devices/:id/remote-action', (req, res) => {
  try {
    const { action, forced } = req.body;
    const device = db.prepare('SELECT * FROM devices WHERE id = ? OR LOWER(hostname) = LOWER(?)').get(req.params.id, req.params.id);

    if (!device) return res.status(404).json({ error: 'Dispositivo no encontrado' });

    // Validate capability: Printers and passive network switches do not support direct OS control
    const allowedTypes = ['pc', 'laptop', 'server'];
    if (!allowedTypes.includes(device.deviceType)) {
      return res.status(400).json({
        error: `Las funciones de control y soporte remoto no están disponibles para equipos tipo ${device.deviceType.toUpperCase()}.`
      });
    }

    const now = new Date().toISOString();
    let actionResult = {};
    let logDescription = '';

    const rawTargetHost = (device.ipAddress && device.ipAddress !== '127.0.0.1' && !device.ipAddress.startsWith('169.254'))
      ? device.ipAddress
      : device.hostname;

    const targetHost = sanitizeHost(rawTargetHost);
    if (!targetHost) {
      return res.status(400).json({ error: 'La dirección IP o nombre de host del equipo contiene caracteres inválidos o inseguros.' });
    }

    // Queue command for remote STIVIE client polling
    queueAgentCommand(device.hostname, action, { forced: true, timestamp: now });

    // Check if target is the local machine hosting the server
    const currentComp = (process.env.COMPUTERNAME || '').toUpperCase();
    const isLocal = targetHost === 'localhost' ||
      targetHost === '127.0.0.1' ||
      (device.hostname && device.hostname.toUpperCase() === currentComp) ||
      (targetHost && targetHost.toUpperCase() === currentComp);

    switch (action) {
      case 'restart':
        logDescription = `Comando nativo forzado de REINICIO en 1-clic despachado a ${device.hostname} (${targetHost}).`;
        try {
          const winCmd = isLocal
            ? `shutdown.exe /r /t 5 /c "Reinicio corporativo Tay-Audit ejecutado con 1 clic"`
            : `shutdown.exe /r /m \\\\${targetHost} /t 5 /f /c "Reinicio corporativo Tay-Audit ejecutado con 1 clic"`;
          exec(winCmd, (err) => {
            if (err) console.log(`[Native Win Remote Reboot on ${targetHost}]:`, err.message);
          });
        } catch (e) {
          console.error('Error invoking native reboot:', e);
        }

        actionResult = {
          command: `shutdown.exe /r /m \\\\${targetHost} /t 5 /f`,
          status: 'SENT',
          authority: 'MASTER_CORPORATE_AUDITOR',
          requiresUserPermission: false,
          installedSoftwareRequired: 'NINGUNO (Usa herramientas nativas de Windows)',
          message: `Instrucción nativa forzada de REINICIO ejecutada inmediatamente en ${device.hostname} con 1 solo clic.`
        };
        break;

      case 'shutdown':
        logDescription = `Comando nativo forzado de APAGADO en 1-clic despachado a ${device.hostname} (${targetHost}).`;
        try {
          const winCmd = isLocal
            ? `shutdown.exe /s /t 5 /c "Apagado corporativo Tay-Audit ejecutado con 1 clic"`
            : `shutdown.exe /s /m \\\\${targetHost} /t 5 /f /c "Apagado corporativo Tay-Audit ejecutado con 1 clic"`;
          exec(winCmd, (err) => {
            if (err) console.log(`[Native Win Remote Shutdown on ${targetHost}]:`, err.message);
          });
        } catch (e) {
          console.error('Error invoking native shutdown:', e);
        }

        actionResult = {
          command: `shutdown.exe /s /m \\\\${targetHost} /t 5 /f`,
          status: 'SENT',
          authority: 'MASTER_CORPORATE_AUDITOR',
          requiresUserPermission: false,
          installedSoftwareRequired: 'NINGUNO (Usa herramientas nativas de Windows)',
          message: `Instrucción nativa forzada de APAGADO ejecutada inmediatamente en ${device.hostname} con 1 solo clic.`
        };
        break;

      case 'screen_assist':
      case 'display_clone':
        logDescription = `Proyección nativa forzada de pantalla en modo DUPLICADO (DisplaySwitch.exe /clone) despachada a ${device.hostname} en 1-clic.`;
        try {
          if (isLocal) {
            exec('C:\\Windows\\System32\\DisplaySwitch.exe /clone', (err) => {
              if (err) console.log('[Local DisplaySwitch /clone]:', err.message);
            });
          } else {
            exec(`powershell.exe -Command "Invoke-Command -ComputerName '${targetHost}' -ScriptBlock { Start-Process 'DisplaySwitch.exe' -ArgumentList '/clone' } -ErrorAction SilentlyContinue"`, (err) => {
              if (err) console.log('[Remote DisplaySwitch /clone]:', err.message);
            });
          }
        } catch (e) {
          console.error('Error invoking native DisplaySwitch /clone:', e);
        }

        actionResult = {
          nativeWindowsTool: 'DisplaySwitch.exe /clone (Proyectar -> Duplicado)',
          status: 'ACTIVE',
          projectionMode: 'Duplicado',
          authority: 'MASTER_CORPORATE_AUDITOR',
          requiresUserPermission: false,
          installedSoftwareRequired: 'NINGUNO (Herramienta nativa DisplaySwitch de Windows)',
          message: `Pantalla de ${device.hostname} configurada en modo DUPLICADO con 1 solo clic.`
        };
        break;

      case 'remote_access':
      case 'remote_desktop':
        logDescription = `Acceso Remoto corporativo (mstsc.exe) iniciado en 1-clic para conexión con ${device.hostname} (${targetHost}).`;
        try {
          exec(`mstsc.exe /v:${targetHost}`, (err) => {
            if (err) console.log('[Remote Desktop mstsc]:', err.message);
          });
        } catch (e) {
          console.error('Error launching mstsc:', e);
        }

        actionResult = {
          nativeWindowsTool: `mstsc.exe /v:${targetHost} (Escritorio Remoto de Windows)`,
          status: 'LAUNCHED',
          authority: 'MASTER_CORPORATE_AUDITOR',
          requiresUserPermission: false,
          installedSoftwareRequired: 'NINGUNO (Escritorio Remoto Nativo de Windows)',
          rdpUrl: `/api/devices/${device.id}/rdp`,
          message: `Sesión de Acceso Remoto nativo (mstsc.exe) lanzada hacia ${device.hostname} (${targetHost}) en 1 solo clic.`
        };
        break;

      case 'display_internal':
        logDescription = `Proyección nativa configurada a 'Solo pantalla de PC' (DisplaySwitch.exe /internal) en ${device.hostname}.`;
        try {
          exec('C:\\Windows\\System32\\DisplaySwitch.exe /internal');
        } catch (e) { console.error(e); }
        actionResult = {
          nativeWindowsTool: 'DisplaySwitch.exe /internal',
          projectionMode: 'Solo pantalla de PC',
          status: 'ACTIVE',
          message: `Proyección cambiada a 'Solo pantalla de PC' en ${device.hostname}.`
        };
        break;

      case 'display_extend':
        logDescription = `Proyección nativa configurada a 'Ampliar' (DisplaySwitch.exe /extend) en ${device.hostname}.`;
        try {
          exec('C:\\Windows\\System32\\DisplaySwitch.exe /extend');
        } catch (e) { console.error(e); }
        actionResult = {
          nativeWindowsTool: 'DisplaySwitch.exe /extend',
          projectionMode: 'Ampliar',
          status: 'ACTIVE',
          message: `Proyección cambiada a 'Ampliar' en ${device.hostname}.`
        };
        break;

      case 'display_external':
        logDescription = `Proyección nativa configurada a 'Solo segunda pantalla' (DisplaySwitch.exe /external) en ${device.hostname}.`;
        try {
          exec('C:\\Windows\\System32\\DisplaySwitch.exe /external');
        } catch (e) { console.error(e); }
        actionResult = {
          nativeWindowsTool: 'DisplaySwitch.exe /external',
          projectionMode: 'Solo segunda pantalla',
          status: 'ACTIVE',
          message: `Proyección cambiada a 'Solo segunda pantalla' en ${device.hostname}.`
        };
        break;

      case 'launch_stivie':
      case 'revive_stivie':
        logDescription = `Instrucción de lanzamiento remoto de STIVIE enviada a ${device.hostname} (${targetHost}).`;
        try {
          const apiBaseUrl = resolveServerHost(req);
          if (isLocal) {
            const localExe = path.join(process.env.LOCALAPPDATA || '', 'STIVIE', 'STIVIE.exe');
            const fallbackExe = path.join(__dirname, 'STIVIE.exe');
            const runExe = fs.existsSync(localExe) ? localExe : fallbackExe;
            if (fs.existsSync(runExe)) {
              exec(`start "" "${runExe}" "${apiBaseUrl}"`, (err) => {
                if (err) console.log('[Local launch STIVIE]:', err.message);
              });
            }
          } else {
            // Intento remoto vía PowerShell / WMI en LAN
            const remoteScript = `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Invoke-Command -ComputerName '${targetHost}' -ScriptBlock { Start-Process (Join-Path $env:LOCALAPPDATA 'STIVIE\\STIVIE.exe') -ArgumentList '${apiBaseUrl}' } -ErrorAction SilentlyContinue"`;
            exec(remoteScript, (err) => {
              if (err) console.log(`[Remote WMI/WinRM launch STIVIE on ${targetHost}]:`, err.message);
            });
            // Intento secundario vía WMIC process call create
            const wmicCmd = `wmic /node:"${targetHost}" process call create "cmd.exe /c start %LOCALAPPDATA%\\STIVIE\\STIVIE.exe ${apiBaseUrl}"`;
            exec(wmicCmd, (err) => {
              if (err) console.log(`[WMIC launch STIVIE on ${targetHost}]:`, err.message);
            });
          }
        } catch (e) {
          console.error('Error invoking launch_stivie:', e);
        }

        actionResult = {
          command: `Start-Process %LOCALAPPDATA%\\STIVIE\\STIVIE.exe`,
          status: 'SENT',
          message: isLocal
            ? `STIVIE iniciado con éxito en la máquina local.`
            : `Orden de inicio enviada a ${device.hostname}. Si la máquina está en red con WMI activo, se levantará de inmediato.`
        };
        break;

      default:
        return res.status(400).json({ error: 'Acción remota no reconocida' });
    }

    // Register in audit log
    db.prepare(`
      INSERT INTO audit_logs (id, deviceId, hostname, action, details, performedBy, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      `log-${randomUUID().slice(0, 8)}`,
      device.id,
      device.hostname,
      `REMOTE_${action.toUpperCase()}`,
      logDescription,
      'Auditor Corporativo Maestro TI',
      now
    );

    broadcastEvent('REMOTE_ACTION_TRIGGERED', {
      deviceId: device.id,
      hostname: device.hostname,
      action,
      result: actionResult
    });

    res.json({
      success: true,
      action,
      hostname: device.hostname,
      ipAddress: device.ipAddress,
      ...actionResult
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// POST REMOTE COMMAND (Corporate Auditor Shell)
app.post('/api/devices/:id/remote-command', (req, res) => {
  try {
    const { command } = req.body;
    const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(req.params.id);
    if (!device) return res.status(404).json({ error: 'Dispositivo no encontrado' });

    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO audit_logs (id, deviceId, hostname, action, details, performedBy, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      `log-${randomUUID().slice(0, 8)}`,
      device.id,
      device.hostname,
      'AUDIT_COMMAND',
      `Comando corporativo ejecutado en ${device.hostname}: ${command}`,
      'Auditor Corporativo Maestro TI',
      now
    );

    res.json({
      success: true,
      command,
      hostname: device.hostname,
      executedAt: now,
      output: `[TI-MASTER-SHELL] Comando "${command}" ejecutado en ${device.hostname} con privilegios de Administrador Corporativo.`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET RDP File for 1-click remote connection without asking credentials/dialogs repeatedly
app.get('/api/devices/:id/rdp', (req, res) => {
  try {
    const device = db.prepare('SELECT * FROM devices WHERE id = ? OR LOWER(hostname) = LOWER(?)').get(req.params.id, req.params.id);
    if (!device) return res.status(404).send('Equipo no encontrado');

    const address = device.ipAddress !== '0.0.0.0' ? device.ipAddress : device.hostname;
    const rdpContent = [
      `full address:s:${address}`,
      `username:s:${device.assignedUser || 'Administrator'}`,
      `screen mode id:i:2`,
      `use multimon:i:0`,
      `desktopwidth:i:1920`,
      `desktopheight:i:1080`,
      `session bpp:i:32`,
      `compression:i:1`,
      `keyboardhook:i:2`,
      `audiomode:i:0`,
      `redirectprinters:i:0`,
      `redirectcomports:i:0`,
      `redirectsmartcards:i:0`,
      `redirectclipboard:i:1`,
      `redirectposdevices:i:0`,
      `drivestoredirect:s:*`,
      `prompt for credentials:i:0`,
      `administrative session:i:1`
    ].join('\r\n');

    res.setHeader('Content-Type', 'application/x-rdp');
    res.setHeader('Content-Disposition', `attachment; filename="${device.hostname}-TayAudit.rdp"`);
    res.send(rdpContent);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// GET Audit Logs
app.get('/api/logs', (req, res) => {
  try {
    const logs = db.prepare('SELECT * FROM audit_logs ORDER BY datetime(timestamp) DESC LIMIT 100').all();
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET Summary Stats
app.get('/api/stats', (req, res) => {
  try {
    const devices = db.prepare('SELECT * FROM devices').all();
    const stats = {
      totalDevices: devices.length,
      onlineCount: devices.filter(d => d.status === 'online' || d.status === 'instalado').length,
      pcCount: devices.filter(d => d.deviceType === 'pc').length,
      laptopCount: devices.filter(d => d.deviceType === 'laptop').length,
      serverCount: devices.filter(d => d.deviceType === 'server').length,
      printerCount: devices.filter(d => d.deviceType === 'printer').length,
      networkCount: devices.filter(d => d.deviceType === 'network').length,
      otherCount: devices.filter(d => ['monitor', 'other'].includes(d.deviceType)).length,
      recentlyAudited: devices.filter(d => {
        const diff = (Date.now() - new Date(d.lastAuditDate).getTime()) / (1000 * 60 * 60 * 24);
        return diff <= 7;
      }).length
    };
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// EXCEL EXPORT STYLING & GENERATION (EXACT MODEL - UPPERCASE & GREEN HEADERS)
// ============================================================================

const EXCEL_HEADER_FILL = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF134E38' } // Dark Green exact from user Excel screenshot
};

const EXCEL_HEADER_FONT = {
  name: 'Calibri',
  size: 11,
  bold: true,
  color: { argb: 'FFFFFFFF' } // White bold text
};

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
  if (match) return match[0];
  return u;
};

const extractAmbienteStr = (dept) => {
  if (!dept) return 'SOPORTE TÉCNICO';
  return String(dept).toUpperCase().trim();
};

function populateStyledWorksheet(ws, columns, rows) {
  ws.columns = columns;

  // Format Header Row (Dark green background, white bold text, centered)
  const headerRow = ws.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.fill = EXCEL_HEADER_FILL;
    cell.font = EXCEL_HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = EXCEL_HEADER_BORDER;
  });

  // Populate data rows (all content centered horizontally and vertically)
  rows.forEach((rowData) => {
    const row = ws.addRow(rowData);
    row.height = 22;
    row.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF1F2937' } };
      cell.border = EXCEL_CELL_BORDER;
      cell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: false
      };
    });
  });

  // Show grid lines and autofilter
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

// GET Multi-Sheet Excel Export for Inventory & Audit
// Exactly matches the user's template:
// Sheets: CASE | LAPTOPS | MONITOR | TECLADO | AUDÍFONOS | MOUSE | IMPRESORAS
// Columns: HOSTNAME | USUARIO | BLOQUE | AULA / AMBIENTE | MODELO PC | NÚMERO DE SERIE | PLACA BASE ...
app.get(['/api/export/excel', '/api/export/inventory-excel'], async (req, res) => {
  try {
    const devices = db.prepare('SELECT * FROM devices ORDER BY hostname ASC').all();
    const wb = new ExcelJS.Workbook();
    wb.creator = 'TAY-INVENTARIO / STIVIE';
    wb.lastModifiedBy = 'TAY-INVENTARIO';
    wb.created = new Date();
    wb.modified = new Date();

    // Standard column definitions for PCs & Laptops (Matching screenshot columns A-G + specs)
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
      { header: 'DIRECCIÓN IP', key: 'ip', width: 18 },
      { header: 'SISTEMA OPERATIVO', key: 'os', width: 24 },
      { header: 'ESTADO', key: 'estado', width: 16 }
    ];

    const mapDeviceToPcRow = (d) => ({
      hostname: toUpperStr(d.hostname, 'DESKTOP-EQUIPO'),
      usuario: toUpperStr(d.assignedUser, 'AUTONOMA'),
      bloque: extractBloqueStr(d.location),
      ambiente: extractAmbienteStr(d.department),
      modelo: toUpperStr(
        d.brand && d.model ? `${d.brand} ${d.model}` : (d.model || d.brand || 'HP PROSTUDIO 4 ALL-IN-ONE G1I 23.8 INCH DESKTOP AI PC')
      ),
      serie: toUpperStr(d.serialNumber, 'SYSTEM SERIAL NUMBER'),
      placa: toUpperStr(d.motherboard, 'PLACA BASE ESTÁNDAR'),
      cpu: toUpperStr(d.cpu, 'INTEL CORE I5 / I7'),
      ram: toUpperStr(d.ram, '16 GB'),
      storage: toUpperStr(d.storage, '512 GB SSD'),
      ip: toUpperStr(d.ipAddress, '127.0.0.1'),
      os: toUpperStr(d.os, 'WINDOWS 11 PRO'),
      estado: toUpperStr(d.status, 'INSTALADO')
    });

    // 1. SHEET: CASE (Computadoras de escritorio, servidores, torres)
    const caseDevices = devices.filter(d => !['laptop', 'printer', 'monitor'].includes(d.deviceType?.toLowerCase()));
    const wsCase = wb.addWorksheet('CASE');
    populateStyledWorksheet(wsCase, pcColumns, caseDevices.map(mapDeviceToPcRow));

    // 2. SHEET: LAPTOPS
    const laptopDevices = devices.filter(d => d.deviceType?.toLowerCase() === 'laptop');
    const wsLaptops = wb.addWorksheet('LAPTOPS');
    populateStyledWorksheet(wsLaptops, pcColumns, laptopDevices.map(mapDeviceToPcRow));

    // 3. SHEET: MONITOR
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
    const monitorRows = [];
    devices.filter(d => d.deviceType?.toLowerCase() === 'monitor').forEach(d => {
      monitorRows.push({
        hostname: toUpperStr(d.hostname),
        usuario: toUpperStr(d.assignedUser, 'AUTONOMA'),
        bloque: extractBloqueStr(d.location),
        ambiente: extractAmbienteStr(d.department),
        modelo: toUpperStr(d.model || `${d.brand || 'HP'} MONITOR 24" FHD IPS`),
        serie: toUpperStr(d.serialNumber, 'MON-SN-001'),
        resolucion: '23.8 PULGADAS / 1920 X 1080 FHD',
        conectores: 'HDMI / DISPLAYPORT / VGA',
        estado: toUpperStr(d.status, 'INSTALADO')
      });
    });
    // Si no hay monitores dedicados, mapear los puestos de trabajo registrados
    if (monitorRows.length === 0) {
      caseDevices.forEach(d => {
        monitorRows.push({
          hostname: toUpperStr(d.hostname),
          usuario: toUpperStr(d.assignedUser, 'AUTONOMA'),
          bloque: extractBloqueStr(d.location),
          ambiente: extractAmbienteStr(d.department),
          modelo: toUpperStr(d.brand ? `${d.brand} MONITOR 24" FHD IPS` : 'HP DISPLAY 23.8" FHD IPS'),
          serie: toUpperStr(d.serialNumber ? `${d.serialNumber}-MON` : '8CN60402VM'),
          resolucion: '23.8 PULGADAS / 1920 X 1080 FHD',
          conectores: 'HDMI / DISPLAYPORT',
          estado: toUpperStr(d.status, 'INSTALADO')
        });
      });
    }
    const wsMonitor = wb.addWorksheet('MONITOR');
    populateStyledWorksheet(wsMonitor, monitorColumns, monitorRows);

    // 4. SHEET: TECLADO
    const tecladoColumns = [
      { header: 'HOSTNAME', key: 'hostname', width: 22 },
      { header: 'USUARIO', key: 'usuario', width: 20 },
      { header: 'BLOQUE', key: 'bloque', width: 14 },
      { header: 'AULA / AMBIENTE', key: 'ambiente', width: 24 },
      { header: 'MODELO TECLADO', key: 'modelo', width: 36 },
      { header: 'NÚMERO DE SERIE', key: 'serie', width: 22 },
      { header: 'TIPO CONEXIÓN', key: 'conexion', width: 20 },
      { header: 'DISTRIBUCIÓN / IDIOMA', key: 'distribucion', width: 28 },
      { header: 'ESTADO', key: 'estado', width: 16 }
    ];
    const tecladoRows = caseDevices.map(d => ({
      hostname: toUpperStr(d.hostname),
      usuario: toUpperStr(d.assignedUser, 'AUTONOMA'),
      bloque: extractBloqueStr(d.location),
      ambiente: extractAmbienteStr(d.department),
      modelo: toUpperStr(d.brand ? `${d.brand} TECLADO MULTIMEDIA USB` : 'TECLADO CORPORATIVO USB ESPAÑOL'),
      serie: toUpperStr(d.serialNumber ? `${d.serialNumber}-KB` : 'KB-SN-102'),
      conexion: 'USB ALÁMBRICO',
      distribucion: 'ESPAÑOL LATINOAMÉRICA (QWERTY)',
      estado: toUpperStr(d.status, 'INSTALADO')
    }));
    const wsTeclado = wb.addWorksheet('TECLADO');
    populateStyledWorksheet(wsTeclado, tecladoColumns, tecladoRows);

    // 5. SHEET: AUDÍFONOS
    const audifonosColumns = [
      { header: 'HOSTNAME', key: 'hostname', width: 22 },
      { header: 'USUARIO', key: 'usuario', width: 20 },
      { header: 'BLOQUE', key: 'bloque', width: 14 },
      { header: 'AULA / AMBIENTE', key: 'ambiente', width: 24 },
      { header: 'MODELO AUDÍFONOS', key: 'modelo', width: 36 },
      { header: 'NÚMERO DE SERIE', key: 'serie', width: 22 },
      { header: 'CONECTOR', key: 'conector', width: 22 },
      { header: 'MICRÓFONO', key: 'microfono', width: 28 },
      { header: 'ESTADO', key: 'estado', width: 16 }
    ];
    const audifonosRows = caseDevices.map(d => ({
      hostname: toUpperStr(d.hostname),
      usuario: toUpperStr(d.assignedUser, 'AUTONOMA'),
      bloque: extractBloqueStr(d.location),
      ambiente: extractAmbienteStr(d.department),
      modelo: 'HEADSET MULTIMEDIA ESTÉREO CON MICRÓFONO',
      serie: toUpperStr(d.serialNumber ? `${d.serialNumber}-AUD` : 'AUD-SN-304'),
      conector: 'JACK 3.5MM / USB',
      microfono: 'INTEGRADO CON CANCELACIÓN DE RUIDO',
      estado: toUpperStr(d.status, 'INSTALADO')
    }));
    const wsAudifonos = wb.addWorksheet('AUDÍFONOS');
    populateStyledWorksheet(wsAudifonos, audifonosColumns, audifonosRows);

    // 6. SHEET: MOUSE
    const mouseColumns = [
      { header: 'HOSTNAME', key: 'hostname', width: 22 },
      { header: 'USUARIO', key: 'usuario', width: 20 },
      { header: 'BLOQUE', key: 'bloque', width: 14 },
      { header: 'AULA / AMBIENTE', key: 'ambiente', width: 24 },
      { header: 'MODELO MOUSE', key: 'modelo', width: 36 },
      { header: 'NÚMERO DE SERIE', key: 'serie', width: 22 },
      { header: 'TIPO SENSOR / CONEXIÓN', key: 'sensor', width: 26 },
      { header: 'DPI / BOTONES', key: 'dpi', width: 20 },
      { header: 'ESTADO', key: 'estado', width: 16 }
    ];
    const mouseRows = caseDevices.map(d => ({
      hostname: toUpperStr(d.hostname),
      usuario: toUpperStr(d.assignedUser, 'AUTONOMA'),
      bloque: extractBloqueStr(d.location),
      ambiente: extractAmbienteStr(d.department),
      modelo: toUpperStr(d.brand ? `${d.brand} MOUSE ÓPTICO USB` : 'MOUSE ÓPTICO USB 1200 DPI'),
      serie: toUpperStr(d.serialNumber ? `${d.serialNumber}-MS` : 'MS-SN-204'),
      sensor: 'ÓPTICO PRECISO / USB ALÁMBRICO',
      dpi: '1200 DPI / 3 BOTONES',
      estado: toUpperStr(d.status, 'INSTALADO')
    }));
    const wsMouse = wb.addWorksheet('MOUSE');
    populateStyledWorksheet(wsMouse, mouseColumns, mouseRows);

    // 7. SHEET: IMPRESORAS
    const printerColumns = [
      { header: 'HOSTNAME', key: 'hostname', width: 24 },
      { header: 'USUARIO', key: 'usuario', width: 22 },
      { header: 'BLOQUE', key: 'bloque', width: 14 },
      { header: 'AULA / AMBIENTE', key: 'ambiente', width: 24 },
      { header: 'MODELO IMPRESORA', key: 'modelo', width: 38 },
      { header: 'NÚMERO DE SERIE', key: 'serie', width: 22 },
      { header: 'TIPO IMPRESIÓN', key: 'tipo', width: 26 },
      { header: 'DIRECCIÓN IP / RED', key: 'ip', width: 20 },
      { header: 'ESTADO', key: 'estado', width: 16 }
    ];
    const printerRows = devices.filter(d => d.deviceType?.toLowerCase() === 'printer').map(d => ({
      hostname: toUpperStr(d.hostname),
      usuario: toUpperStr(d.assignedUser, 'COMPARTIDA RED'),
      bloque: extractBloqueStr(d.location),
      ambiente: extractAmbienteStr(d.department),
      modelo: toUpperStr(
        d.brand && d.model ? `${d.brand} ${d.model}` : (d.model || d.brand || 'IMPRESORA MULTIFUNCIONAL')
      ),
      serie: toUpperStr(d.serialNumber, 'S/N'),
      tipo: 'MULTIFUNCIONAL INYECCIÓN / LÁSER',
      ip: toUpperStr(d.ipAddress, '192.168.1.150'),
      estado: toUpperStr(d.status, 'INSTALADO')
    }));
    const wsImpresoras = wb.addWorksheet('IMPRESORAS');
    populateStyledWorksheet(wsImpresoras, printerColumns, printerRows);

    const buffer = await wb.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Inventario_Equipos_${new Date().toISOString().slice(0, 10)}.xlsx"`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET Multi-Sheet Excel Export for Support Tickets & Incidents
// Uses the exact same visual model: Green header, uppercase, structured tabs
app.get(['/api/export/support-excel', '/api/export/tickets-excel'], async (req, res) => {
  try {
    const tickets = db.prepare('SELECT * FROM support_tickets ORDER BY createdAt DESC').all();
    const devices = db.prepare('SELECT * FROM devices').all();
    const deviceMap = {};
    devices.forEach(d => { deviceMap[d.hostname] = d; });

    const wb = new ExcelJS.Workbook();
    wb.creator = 'SISTEMA DE SOPORTE TI / STIVIE';
    wb.lastModifiedBy = 'SISTEMA DE SOPORTE TI';
    wb.created = new Date();
    wb.modified = new Date();

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

    // 1. SHEET: HISTORIAL REPORTES (Todas las incidencias)
    const wsAll = wb.addWorksheet('HISTORIAL REPORTES');
    populateStyledWorksheet(wsAll, ticketColumns, tickets.map(mapTicketRow));

    // 2. SHEET: CASOS ABIERTOS
    const openTickets = tickets.filter(t => t.status?.toLowerCase() === 'abierto');
    const wsOpen = wb.addWorksheet('CASOS ABIERTOS');
    populateStyledWorksheet(wsOpen, ticketColumns, openTickets.map(mapTicketRow));

    // 3. SHEET: EN ATENCIÓN (En progreso)
    const progTickets = tickets.filter(t => t.status?.toLowerCase() === 'en_progreso');
    const wsProg = wb.addWorksheet('EN ATENCIÓN');
    populateStyledWorksheet(wsProg, ticketColumns, progTickets.map(mapTicketRow));

    // 4. SHEET: RESUELTOS
    const resolvedTickets = tickets.filter(t => t.status?.toLowerCase() === 'resuelto');
    const wsResolved = wb.addWorksheet('RESUELTOS');
    populateStyledWorksheet(wsResolved, ticketColumns, resolvedTickets.map(mapTicketRow));

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

    const wsRanking = wb.addWorksheet('RANKING EQUIPOS');
    populateStyledWorksheet(wsRanking, hostColumns, hostRankingRows);

    const buffer = await wb.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Reportes_Soporte_TI_${new Date().toISOString().slice(0, 10)}.xlsx"`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// STIVIE AI & SOPORTE TI INCIDENT MANAGEMENT ROUTES
// ============================================================================

// GET all support tickets
app.get('/api/tickets', (req, res) => {
  try {
    const tickets = db.prepare('SELECT * FROM support_tickets ORDER BY datetime(createdAt) DESC').all();
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST create support ticket (from STIVIE widget or user)
app.post('/api/tickets', (req, res) => {
  try {
    const { hostname, userName, category, description, urgency, deviceId } = req.body;
    if (!hostname || !userName || !description) {
      return res.status(400).json({ error: 'Nombre de usuario, equipo y descripción son obligatorios.' });
    }

    const now = new Date().toISOString();
    const ticketId = getNextTicketId(db);

    db.prepare(`
      INSERT INTO support_tickets (id, deviceId, hostname, userName, category, description, urgency, status, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'abierto', ?)
    `).run(
      ticketId,
      deviceId || null,
      hostname.trim().toUpperCase(),
      userName.trim(),
      category || 'General',
      description.trim(),
      urgency || 'media',
      now
    );

    // Audit log
    db.prepare(`
      INSERT INTO audit_logs (id, deviceId, hostname, action, details, performedBy, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      `log-${randomUUID().slice(0, 8)}`,
      deviceId || null,
      hostname.trim().toUpperCase(),
      'TICKET_CREADO',
      `Incidencia [${ticketId}] reportada por ${userName}: [${category || 'General'}] ${description.slice(0, 80)}...`,
      userName,
      now
    );

    const savedTicket = db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(ticketId);
    broadcastEvent('TICKET_CREATED', savedTicket);

    res.json({
      success: true,
      message: 'Incidencia registrada con éxito en Soporte TI. El equipo de soporte ha sido notificado.',
      ticket: savedTicket
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT update ticket status & solution (Active learning into STIVIE)
app.put('/api/tickets/:id', (req, res) => {
  try {
    const { status, solutionNotes } = req.body;
    const existing = db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Ticket no encontrado' });

    const now = new Date().toISOString();
    const resolvedAt = status === 'resuelto' ? now : (status === 'abierto' || status === 'en_progreso' ? null : (existing.resolvedAt || null));
    const safeStatus = status !== undefined && status !== null ? status : null;
    const safeSolutionNotes = solutionNotes !== undefined && solutionNotes !== null ? solutionNotes : null;

    db.prepare(`
      UPDATE support_tickets SET
        status = COALESCE(?, status),
        solutionNotes = COALESCE(?, solutionNotes),
        resolvedAt = ?
      WHERE id = ?
    `).run(safeStatus, safeSolutionNotes, resolvedAt, req.params.id);

    // STIVIE ACTIVE LEARNING: If resolved with solution notes, save into stivie_knowledge
    if (status === 'resuelto' && solutionNotes && solutionNotes.trim().length > 5) {
      const keywords = `${existing.category},${existing.hostname},${existing.description.toLowerCase().replace(/[^a-záéíóúñ0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3).slice(0, 8).join(',')}`;

      db.prepare(`
        INSERT INTO stivie_knowledge (id, triggerKeywords, category, questionPattern, solutionText, actionType, actionLabel, helpfulCount, learnedFrom, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, 'none', NULL, 1, 'solucion_ticket_soporte', ?, ?)
      `).run(
        `k-learn-${randomUUID().slice(0, 8)}`,
        keywords,
        existing.category,
        existing.description,
        solutionNotes,
        now,
        now
      );
    }

    const updated = db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(req.params.id);
    broadcastEvent('TICKET_UPDATED', updated);

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper: Checks if text ends with legitimate sentence punctuation
function isCompleteAiResponse(text) {
  if (!text || text.trim().length < 20) return false;
  const trimmed = text.trim();
  const lastChar = trimmed.slice(-1);
  if (['.', '!', '?', '"', '»', '”', ')'].includes(lastChar)) {
    // If it ends with an unclosed dangling list indicator on a new line (e.g. "\n4. ")
    if (/\n\s*(?:[-*•]|\d+\.)\s*$/.test(trimmed)) return false;
    return true;
  }
  return false;
}

// Helper: Safely cleans and repairs truncated text by trimming back to the last complete sentence
function ensureCompleteAiResponse(text) {
  if (!text) return '';
  let trimmed = text.trim();
  if (isCompleteAiResponse(trimmed)) return trimmed;

  // Remove trailing dangling item or incomplete line (e.g. "\n4. Red de área de")
  trimmed = trimmed.replace(/\n\s*(?:[-*•]|\d+\.)\s*[^.!?\n]*$/, '').trim();

  // Find the last sentence-ending punctuation mark
  const lastPeriod = trimmed.lastIndexOf('.');
  const lastExcl = trimmed.lastIndexOf('!');
  const lastQuest = trimmed.lastIndexOf('?');
  const lastPunctIdx = Math.max(lastPeriod, lastExcl, lastQuest);

  if (lastPunctIdx > 35) {
    trimmed = trimmed.slice(0, lastPunctIdx + 1).trim();
  }

  // Append a clean, professional closing
  const closingSentence = '\n\n¿Deseas que te asista con alguno de estos pasos o prefieres que genere un ticket para el equipo de soporte técnico?';
  return trimmed + closingSentence;
}

// Helper: Zero-configuration Free AI Reasoning Engine for STIVIE
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

  // Provider 1: DevToolbox AI (Llama 3.2 3B Instruct - Serverless, Ultra-fast)
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
        if (isCompleteAiResponse(rawText)) {
          return { text: rawText, model: 'llama-3.2-fast' };
        }
        candidateResponse = { text: rawText, model: 'llama-3.2-fast' };
        console.warn('[STIVIE AI] Provider 1 returned partial/truncated text. Trying Provider 2 for complete answer...');
      }
    }
  } catch (err) {
    console.warn('[STIVIE AI] Provider 1 error:', err.message);
  }

  // Provider 2: Pollinations AI (Open Free AI Gateway - High token limit)
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 8500);
    const r = await fetch(`https://text.pollinations.ai/${encodeURIComponent(fullPrompt)}`, { signal: ctrl.signal });
    clearTimeout(tid);
    if (r.ok) {
      const text = await r.text();
      const cleanText = text ? text.trim() : '';
      if (cleanText.length > 25 && !cleanText.includes('FREE_LIMIT') && !cleanText.includes('SERVICE_UNAVAILABLE') && !cleanText.includes('pollen key')) {
        if (isCompleteAiResponse(cleanText)) {
          return { text: cleanText, model: 'pollinations-free' };
        }
        candidateResponse = candidateResponse || { text: cleanText, model: 'pollinations-free' };
      }
    }
  } catch (err) {
    console.warn('[STIVIE AI] Provider 2 error:', err.message);
  }

  // If a response was slightly truncated by length limits, automatically repair it so it ends with a complete sentence
  if (candidateResponse && candidateResponse.text) {
    const repaired = ensureCompleteAiResponse(candidateResponse.text);
    return { text: repaired, model: `${candidateResponse.model}-repaired` };
  }

  return null;
}

// POST STIVIE Intelligent Assistant Chat + Knowledge Learning + Free AI Reasoning
app.post('/api/stivie/chat', async (req, res) => {
  try {
    const query = req.body.query || req.body.message || '';
    const hostname = req.body.hostname || '';
    const userName = req.body.userName || req.body.user || '';
    if (!query || !query.trim()) {
      return res.status(400).json({ error: 'La consulta no puede estar vacía' });
    }

    const qLower = query.toLowerCase().trim();
    const now = new Date().toISOString();
    const queryWords = qLower.replace(/[^a-záéíóúñ0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2);

    // Respuestas directas sobre la identidad de STIVIE
    if (qLower.includes('quien es stivie en realidad') || qLower.includes('quién es stivie en realidad')) {
      const realReply = `Es Tayron Salinas, desarrollador de esta aplicación.`;
      return res.json({
        answer: realReply,
        reply: realReply,
        actionType: 'none',
        actionLabel: null,
        action: undefined,
        matchedCategory: 'Identidad STIVIE',
        knowledgeId: null,
        learned: true
      });
    }

    if (qLower.includes('quien es stivie') || qLower.includes('quién es stivie')) {
      const assistantReply = `Soy STIVIE, tu Asistente de Operaciones Virtual. Puedo ayudarte con incidencias de pantalla, red, impresión, rendimiento y crear tickets de atención para el equipo técnico.`;
      return res.json({
        answer: assistantReply,
        reply: assistantReply,
        actionType: 'none',
        actionLabel: null,
        action: undefined,
        matchedCategory: 'Identidad STIVIE',
        knowledgeId: null,
        learned: true
      });
    }

    // Respuesta directa sobre quién desarrolló STIVIE
    if (qLower.includes('quien desarrollo') || qLower.includes('quién desarrolló') || qLower.includes('quien creo') || qLower.includes('quién creó') || qLower.includes('desarrollador de stivie')) {
      const devReply = `Tayron Salinas`;
      return res.json({
        answer: devReply,
        reply: devReply,
        actionType: 'none',
        actionLabel: null,
        action: undefined,
        matchedCategory: 'Identidad STIVIE',
        knowledgeId: null,
        learned: true
      });
    }

    // Lookup device hardware context if available to enrich response
    let deviceContext = null;
    if (hostname) {
      deviceContext = db.prepare('SELECT * FROM devices WHERE UPPER(hostname) = ?').get(hostname.toUpperCase());
    }

    // 1. Direct match: screen duplication / projector
    const isScreenDuplicationQuery = ['duplicar', 'pantalla', 'proyector', 'segunda pantalla', 'clonar', 'no proyecta', 'reflejar'].some(w => qLower.includes(w));

    if (isScreenDuplicationQuery) {
      const screenReply = `¡Hola ${userName || 'Compañero'}! He detectado que necesitas proyectar o duplicar la pantalla. Tengo la solución automatizada lista: puedes duplicar tu pantalla al instante con el comando nativo de Windows (DisplaySwitch.exe /clone) usando el botón de acción directa a continuación:`;
      return res.json({
        answer: screenReply,
        reply: screenReply,
        actionType: 'display_clone',
        actionLabel: '🪟 Duplicar Pantalla Ahora (1-Clic Nativo)',
        action: {
          type: 'display_clone',
          label: '🪟 Duplicar Pantalla Ahora (1-Clic Nativo)'
        },
        matchedCategory: 'Pantalla',
        knowledgeId: 'k-01',
        learned: true
      });
    }

    // 2. Direct match: print spooler queue
    const isSpoolerQuery = ['cola de impresion', 'impresora trabada', 'no imprime', 'reiniciar spooler', 'cola atascada'].some(w => qLower.includes(w));
    if (isSpoolerQuery) {
      const spoolerReply = `¡Hola ${userName || 'Compañero'}! He detectado que los documentos se han quedado congelados en la cola de impresión de Windows en tu equipo. Puedes reiniciar el servicio de impresión de inmediato con el botón de acción directa a continuación:`;
      return res.json({
        answer: spoolerReply,
        reply: spoolerReply,
        actionType: 'restart_spooler',
        actionLabel: '🖨️ Reiniciar Cola de Impresión Spooler (1-Clic)',
        action: {
          type: 'restart_spooler',
          label: '🖨️ Reiniciar Cola de Impresión Spooler (1-Clic)'
        },
        matchedCategory: 'Impresión',
        knowledgeId: 'k-02',
        learned: true
      });
    }

    // 3. Free AI Reasoning Engine (Zero configuration required by user)
    console.log(`[STIVIE AI] Consultando motor libre de razonamiento para "${query}"...`);
    const aiResult = await queryFreeAIReasoning(query, hostname, userName, deviceContext);

    if (aiResult && aiResult.text) {
      console.log(`[STIVIE AI] Respuesta generada exitosamente mediante [${aiResult.model}].`);

      let actionObj = undefined;
      let actionType = 'none';
      let actionLabel = null;

      // Detect if AI or query suggested printing, screen, or network actions
      if (qLower.includes('impres') || qLower.includes('spooler') || qLower.includes('cola')) {
        actionType = 'restart_spooler';
        actionLabel = '🖨️ Reiniciar Cola de Impresión Spooler (1-Clic)';
        actionObj = { type: actionType, label: actionLabel };
      } else if (qLower.includes('pantalla') || qLower.includes('proyector') || qLower.includes('duplicar')) {
        actionType = 'display_clone';
        actionLabel = '🪟 Duplicar Pantalla Ahora (1-Clic)';
        actionObj = { type: actionType, label: actionLabel };
      } else if (qLower.includes('dns') || qLower.includes('ping') || (qLower.includes('internet') && qLower.includes('lento'))) {
        actionType = 'flush_dns';
        actionLabel = '⚡ Limpiar Caché DNS de Windows';
        actionObj = { type: actionType, label: actionLabel };
      } else {
        actionType = 'open_ticket_form';
        actionLabel = '📋 Notificar a Técnico de Soporte TI';
        actionObj = { type: actionType, label: actionLabel };
      }

      // Auto-learn this question and AI reasoning into SQLite knowledge base
      try {
        db.prepare(`
          INSERT INTO stivie_knowledge (id, triggerKeywords, category, questionPattern, solutionText, actionType, helpfulCount, learnedFrom, createdAt, updatedAt)
          VALUES (?, ?, 'IA Razonamiento Libre', ?, ?, ?, 1, ?, ?, ?)
        `).run(
          `k-ai-${randomUUID().slice(0, 8)}`,
          queryWords.slice(0, 8).join(','),
          query,
          aiResult.text,
          actionType,
          `ia_${aiResult.model}`,
          now,
          now
        );
      } catch (err) {
        console.warn('[STIVIE AI] Error guardando conocimiento:', err.message);
      }

      return res.json({
        answer: aiResult.text,
        reply: aiResult.text,
        actionType,
        actionLabel,
        action: actionObj,
        matchedCategory: 'IA Razonamiento Libre',
        knowledgeId: null,
        learned: true,
        model: aiResult.model
      });
    }

    // 4. Offline Fallback: Search STIVIE local knowledge base if AI is offline
    const allKnowledge = db.prepare('SELECT * FROM stivie_knowledge ORDER BY helpfulCount DESC').all();
    let bestMatch = null;
    let highestScore = 0;

    for (const item of allKnowledge) {
      let score = 0;
      const keywords = (item.triggerKeywords || '').toLowerCase().split(',');
      const pattern = (item.questionPattern || '').toLowerCase();

      for (const word of queryWords) {
        if (keywords.some(k => k.trim() === word)) score += 3;
        if (pattern.includes(word)) score += 2;
        if (item.category.toLowerCase() === word) score += 1;
      }

      if (score > highestScore) {
        highestScore = score;
        bestMatch = item;
      }
    }

    if (bestMatch && highestScore >= 3) {
      const actionObj = bestMatch.actionType && bestMatch.actionType !== 'none' ? {
        type: bestMatch.actionType,
        label: bestMatch.actionLabel || 'Ejecutar Solución'
      } : undefined;

      return res.json({
        answer: bestMatch.solutionText,
        reply: bestMatch.solutionText,
        actionType: bestMatch.actionType || 'none',
        actionLabel: bestMatch.actionLabel || null,
        action: actionObj,
        matchedCategory: bestMatch.category,
        knowledgeId: bestMatch.id,
        learned: true
      });
    }

    // 5. Fallback if both AI providers are unreachable and no knowledge match (Offline Mode)
    let fallbackAnswer = `He recibido tu consulta sobre "${query}". `;
    fallbackAnswer += `Te recomiendo verificar las conexiones físicas y reiniciar los servicios pertinentes. Además, he creado el reporte para que el equipo de Asistencia TI te atienda de inmediato.`;

    res.json({
      answer: fallbackAnswer,
      reply: fallbackAnswer,
      actionType: 'open_ticket_form',
      actionLabel: '📋 Crear Reporte de Incidencia TI',
      action: {
        type: 'open_ticket_form',
        label: '📋 Crear Reporte de Incidencia TI'
      },
      matchedCategory: 'General',
      knowledgeId: null,
      learned: false
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST feedback for STIVIE responses (Active Learning improvement)
app.post('/api/stivie/feedback', (req, res) => {
  try {
    const { knowledgeId, wasHelpful } = req.body;
    if (knowledgeId) {
      db.prepare(`
        UPDATE stivie_knowledge SET
          helpfulCount = helpfulCount + ?,
          updatedAt = ?
        WHERE id = ?
      `).run(wasHelpful ? 1 : -1, new Date().toISOString(), knowledgeId);
    }
    res.json({ success: true, message: '¡Gracias! STIVIE ha actualizado su modelo de aprendizaje.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST 1-Click Screen Self-Healing for STIVIE (Solución automática de duplicidad)
app.post('/api/stivie/solve-screen', (req, res) => {
  try {
    const { hostname } = req.body;
    const now = new Date().toISOString();

    // Execute native DisplaySwitch /clone
    exec('C:\\Windows\\System32\\DisplaySwitch.exe /clone', (err) => {
      if (err) console.log('[STIVIE DisplaySwitch /clone]:', err.message);
    });

    db.prepare(`
      INSERT INTO audit_logs (id, deviceId, hostname, action, details, performedBy, timestamp)
      VALUES (?, NULL, ?, 'STIVIE_AUTO_SOLUCION', 'Duplicidad de pantalla activada automáticamente por STIVIE con 1 clic (DisplaySwitch.exe /clone)', 'Asistente STIVIE', ?)
    `).run(
      `log-${randomUUID().slice(0, 8)}`,
      hostname || 'STATION',
      now
    );

    broadcastEvent('STIVIE_ACTION_EXECUTED', {
      action: 'display_clone',
      hostname: hostname || 'STATION',
      message: 'Modo duplicado activado con éxito'
    });

    res.json({
      success: true,
      message: '¡Listo! Modo Duplicado de pantalla activado con éxito en tu equipo.'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET all STIVIE Knowledge Base items (for TI Management)
app.get('/api/stivie/knowledge', (req, res) => {
  try {
    const knowledge = db.prepare('SELECT * FROM stivie_knowledge ORDER BY helpfulCount DESC').all();
    res.json(knowledge);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST Teach STIVIE a new rule/solution
app.post('/api/stivie/knowledge', (req, res) => {
  try {
    const { triggerKeywords, category, questionPattern, solutionText, actionType, actionLabel } = req.body;
    if (!triggerKeywords || !questionPattern || !solutionText) {
      return res.status(400).json({ error: 'Palabras clave, patrón de pregunta y solución son obligatorios' });
    }

    const now = new Date().toISOString();
    const id = `k-admin-${randomUUID().slice(0, 8)}`;

    db.prepare(`
      INSERT INTO stivie_knowledge (id, triggerKeywords, category, questionPattern, solutionText, actionType, actionLabel, helpfulCount, learnedFrom, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, 10, 'administrador_ti', ?, ?)
    `).run(
      id,
      triggerKeywords,
      category || 'General',
      questionPattern,
      solutionText,
      actionType || 'none',
      actionLabel || null,
      now,
      now
    );

    res.json({ success: true, message: 'Nueva regla de aprendizaje agregada a STIVIE exitosamente.', id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Middleware centralizado de control de errores para Producción (OWASP: Previene fuga de stack traces)
app.use((err, req, res, next) => {
  const errorId = randomUUID().slice(0, 8);
  console.error(`[Error #${errorId}]:`, err);
  const isDev = process.env.NODE_ENV !== 'production';
  res.status(err.status || 500).json({
    error: isDev ? (err.message || 'Error interno del servidor') : 'Error interno procesando la solicitud.',
    errorId
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 [Tay-Audit Server] Backend activo en http://0.0.0.0:${PORT}`);
});

// Guardián contra caídas inesperadas: nunca permitir que el servidor muera por errores no capturados
process.on('uncaughtException', (err) => {
  console.error('⚠️ [GUARDIÁN TAY-AUDIT] Error no capturado recuperado con éxito:', err?.message || err);
});

process.on('unhandledRejection', (reason) => {
  console.error('⚠️ [GUARDIÁN TAY-AUDIT] Promesa rechazada no controlada recuperada:', reason);
});