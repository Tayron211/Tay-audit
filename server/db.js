import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '..', 'tay_audit.db');

export const db = new DatabaseSync(dbPath);

// Optimizaciones de Base de Datos para Producción 24/7 (WAL, Concurrencia, Integridad)
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;
`);

// Initialize tables
export function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      hostname TEXT UNIQUE NOT NULL,
      deviceType TEXT NOT NULL,
      status TEXT NOT NULL,
      os TEXT,
      ram TEXT,
      cpu TEXT,
      storage TEXT,
      ipAddress TEXT,
      macAddress TEXT,
      serialNumber TEXT,
      motherboard TEXT,
      compatibility TEXT,
      brand TEXT,
      model TEXT,
      assignedUser TEXT,
      department TEXT,
      location TEXT,
      lastAuditDate TEXT,
      notes TEXT,
      qrCodeData TEXT,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      deviceId TEXT,
      hostname TEXT,
      action TEXT,
      details TEXT,
      performedBy TEXT,
      timestamp TEXT
    );

    CREATE TABLE IF NOT EXISTS support_tickets (
      id TEXT PRIMARY KEY,
      deviceId TEXT,
      hostname TEXT NOT NULL,
      userName TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      urgency TEXT DEFAULT 'media',
      status TEXT DEFAULT 'abierto',
      solutionNotes TEXT,
      createdAt TEXT,
      resolvedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS stivie_knowledge (
      id TEXT PRIMARY KEY,
      triggerKeywords TEXT NOT NULL,
      category TEXT NOT NULL,
      questionPattern TEXT NOT NULL,
      solutionText TEXT NOT NULL,
      actionType TEXT DEFAULT 'none',
      actionLabel TEXT,
      helpfulCount INTEGER DEFAULT 0,
      learnedFrom TEXT DEFAULT 'sistema',
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_devices_hostname ON devices(hostname);
    CREATE INDEX IF NOT EXISTS idx_devices_type ON devices(deviceType);
    CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
    CREATE INDEX IF NOT EXISTS idx_tickets_status ON support_tickets(status);
    CREATE INDEX IF NOT EXISTS idx_tickets_hostname ON support_tickets(hostname);
  `);

  // Automatic migration for inventory lifecycle statuses: instalado, custodia, baja
  try {
    db.exec(`
      UPDATE devices SET status = 'instalado' WHERE status IN ('online', 'audited');
      UPDATE devices SET status = 'custodia' WHERE status IN ('offline', 'maintenance');
    `);
  } catch (err) {
    // Ignore migration errors
  }

  // Ensure motherboard, compatibility, supplies, specs, stivieInstalled and lastAgentPing columns exist
  try {
    db.exec("ALTER TABLE devices ADD COLUMN motherboard TEXT;");
  } catch (err) {}
  try {
    db.exec("ALTER TABLE devices ADD COLUMN compatibility TEXT;");
  } catch (err) {}
  try {
    db.exec("ALTER TABLE devices ADD COLUMN supplies TEXT;");
  } catch (err) {}
  try {
    db.exec("ALTER TABLE devices ADD COLUMN specs TEXT;");
  } catch (err) {}
  try {
    db.exec("ALTER TABLE devices ADD COLUMN stivieInstalled INTEGER DEFAULT 0;");
  } catch (err) {}
  try {
    db.exec("ALTER TABLE devices ADD COLUMN lastAgentPing TEXT;");
  } catch (err) {}

  // Backfill motherboard and compatibility for existing inventory items
  try {
    db.exec(`
      UPDATE devices SET motherboard = 'Lenovo 3183 (Intel B660)', compatibility = 'Compatible' WHERE hostname = 'PC-CONTAB-01' AND (motherboard IS NULL OR motherboard = '');
      UPDATE devices SET motherboard = 'Dell 00V6X4 (Intel vPro)', compatibility = 'Compatible' WHERE hostname = 'LAPTOP-GERENCIA-03' AND (motherboard IS NULL OR motherboard = '');
      UPDATE devices SET motherboard = 'HPE ProLiant DL380 Gen10', compatibility = 'Compatible' WHERE hostname = 'SRV-DATABASE-CORE' AND (motherboard IS NULL OR motherboard = '');
      UPDATE devices SET motherboard = 'Epson Mainboard Rev.B', compatibility = 'Compatible' WHERE hostname = 'PRINTER-RRHH-L3150' AND (motherboard IS NULL OR motherboard = '');
      UPDATE devices SET motherboard = 'Cisco Catalyst 9200 Motherboard', compatibility = 'Compatible' WHERE hostname = 'SW-CORE-CISCO-G24' AND (motherboard IS NULL OR motherboard = '');
      UPDATE devices SET motherboard = 'HP 8716 (Intel Q470)', compatibility = 'No Compatible' WHERE hostname = 'PC-RECEPCION-01' AND (motherboard IS NULL OR motherboard = '');
      UPDATE devices SET motherboard = 'HP 832A (Intel C236)', compatibility = 'Compatible' WHERE hostname = 'DESKTOP-6S90FTV' AND (motherboard IS NULL OR motherboard = '');
      UPDATE devices SET motherboard = 'Placa Base Estándar ' || brand, compatibility = 'Compatible' WHERE motherboard IS NULL OR motherboard = '';
      UPDATE devices SET compatibility = 'Compatible' WHERE compatibility IS NULL OR compatibility = '';
    `);
  } catch (err) {}

  // Check if we need seed data
  const checkCount = db.prepare('SELECT COUNT(*) as count FROM devices').get();
  if (checkCount && checkCount.count === 0) {
    seedDatabase();
  }

  seedStivieKnowledge();

  // Migración automática a nomenclatura TCK-0000 ascendente
  migrateTicketNomenclature(db);
}

function seedStivieKnowledge() {
  const checkK = db.prepare('SELECT COUNT(*) as count FROM stivie_knowledge').get();
  if (checkK && checkK.count > 0) return;

  const now = new Date().toISOString();
  const insertK = db.prepare(`
    INSERT INTO stivie_knowledge (id, triggerKeywords, category, questionPattern, solutionText, actionType, actionLabel, helpfulCount, learnedFrom, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const initialKnowledge = [
    {
      id: 'k-01',
      triggerKeywords: 'duplicar,pantalla,proyector,duplicidad,segunda pantalla,monitor,clonar,no proyecta,reflejar',
      category: 'Pantalla',
      questionPattern: 'Problemas de duplicación de pantalla o proyector secundario',
      solutionText: '¡Hola! Detecté que necesitas duplicar la pantalla hacia un proyector o monitor secundario. He preparado la solución nativa directa de Windows (DisplaySwitch /clone) para que lo resuelvas en 1 clic sin llamar a soporte técnico.',
      actionType: 'display_clone',
      actionLabel: '🪟 Duplicar Pantalla Ahora (1-Clic Nativo)',
      helpfulCount: 15,
      learnedFrom: 'aprendizaje_maestro'
    },
    {
      id: 'k-02',
      triggerKeywords: 'internet,lento,red,desconectado,wifi,dns,sin red,cable,gateway',
      category: 'Red',
      questionPattern: 'Sin conexión a internet o lentitud de navegación LAN',
      solutionText: 'He analizado los parámetros de red. La mayoría de problemas de navegación se solucionan liberando y renovando la caché DNS de Windows y refrescando la dirección IP del adaptador de red.',
      actionType: 'flush_dns',
      actionLabel: '⚡ Limpiar Caché DNS y Refrescar Red',
      helpfulCount: 9,
      learnedFrom: 'aprendizaje_maestro'
    },
    {
      id: 'k-03',
      triggerKeywords: 'lento,congelado,ram,memoria,traba,bloqueado,disco,rendimiento',
      category: 'Rendimiento',
      questionPattern: 'Equipo extremadamente lento o congelamiento de aplicaciones',
      solutionText: 'He revisado el inventario de hardware de tu equipo. Cuando la memoria RAM o procesos en segundo plano se saturan, un reinicio limpio programado restaura el rendimiento al 100%.',
      actionType: 'restart',
      actionLabel: '🔄 Solicitar Reinicio Limpio de Estación',
      helpfulCount: 12,
      learnedFrom: 'aprendizaje_maestro'
    },
    {
      id: 'k-04',
      triggerKeywords: 'impresora,imprimir,hojas,cola,spooler,no imprime,impresion',
      category: 'Impresión',
      questionPattern: 'La impresora no responde o documentos atascados en cola',
      solutionText: 'Se detecta bloqueo en el servicio de cola de impresión (Spooler de Windows). Se enviará una orden de reinicio del servicio de impresión para desbloquear los trabajos pendientes.',
      actionType: 'restart_spooler',
      actionLabel: '🖨️ Desbloquear Cola de Impresión',
      helpfulCount: 7,
      learnedFrom: 'aprendizaje_maestro'
    },
    {
      id: 'k-05',
      triggerKeywords: 'remoto,asistencia,ayuda,tecnico,entrar,soporte,control',
      category: 'Soporte TI',
      questionPattern: 'Requiero asistencia directa de un técnico de soporte TI',
      solutionText: 'He notificado al panel central de TI. Puedes habilitar una sesión de Escritorio Remoto con el botón inferior para que el auditor TI se conecte de inmediato.',
      actionType: 'remote_access',
      actionLabel: '🖥️ Iniciar Sesión de Acceso Remoto RDP',
      helpfulCount: 18,
      learnedFrom: 'aprendizaje_maestro'
    }
  ];

  for (const k of initialKnowledge) {
    insertK.run(
      k.id, k.triggerKeywords, k.category, k.questionPattern,
      k.solutionText, k.actionType, k.actionLabel, k.helpfulCount,
      k.learnedFrom, now, now
    );
  }

  // Initial sample ticket
  db.prepare(`
    INSERT INTO support_tickets (id, deviceId, hostname, userName, category, description, urgency, status, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'TCK-0001',
    'dev-001',
    'PC-CONTAB-01',
    'Carlos Méndez',
    'Pantalla',
    'Al conectar el proyector de la sala de reuniones no duplica la imagen de mis hojas contables.',
    'alta',
    'abierto',
    now
  );
}

function seedDatabase() {
  const now = new Date().toISOString();
  const sampleDevices = [
    {
      id: 'dev-001',
      hostname: 'PC-CONTAB-01',
      deviceType: 'pc',
      status: 'online',
      os: 'Windows 11 Pro 64-bit (23H2)',
      ram: '16 GB DDR4 3200MHz',
      cpu: 'Intel Core i5-12400 (6 Cores, 4.4 GHz)',
      storage: '512 GB NVMe M.2 SSD',
      ipAddress: '192.168.1.45',
      macAddress: 'B4:2E:99:A1:34:F1',
      serialNumber: 'LNV-M70Q-9912',
      brand: 'Lenovo',
      model: 'ThinkCentre M70q Gen 3',
      assignedUser: 'Carlos Méndez',
      department: 'Contabilidad y Finanzas',
      location: 'Sede Central - Piso 2 (Oficina 204)',
      lastAuditDate: now,
      notes: 'Equipo principal de facturación electrónica. Auditoría OK.',
      qrCodeData: 'TAY-PC-CONTAB-01-LNV-M70Q-9912'
    },
    {
      id: 'dev-002',
      hostname: 'LAPTOP-GERENCIA-03',
      deviceType: 'laptop',
      status: 'online',
      os: 'Windows 11 Pro 64-bit (24H2)',
      ram: '32 GB DDR5 4800MHz',
      cpu: 'Intel Core i7-1365U vPro (10 Cores)',
      storage: '1 TB PCIe Gen4 NVMe SSD',
      ipAddress: '192.168.1.88',
      macAddress: 'DC:71:96:33:41:88',
      serialNumber: 'DELL-LAT-7440-2024',
      brand: 'Dell',
      model: 'Latitude 7440 Carbon',
      assignedUser: 'Dra. Elena Silva',
      department: 'Gerencia General',
      location: 'Sede Central - Piso 5 (Gerencia)',
      lastAuditDate: now,
      notes: 'Laptop ejecutiva asignada con BitLocker habilitado.',
      qrCodeData: 'TAY-LAPTOP-GERENCIA-03-DELL-LAT-7440-2024'
    },
    {
      id: 'dev-003',
      hostname: 'SRV-DATABASE-CORE',
      deviceType: 'server',
      status: 'online',
      os: 'Windows Server 2022 Datacenter',
      ram: '64 GB ECC Registered DDR4',
      cpu: '2x Intel Xeon Silver 4314 (32 Hilos)',
      storage: '4x 1.92TB SAS SSD RAID 10',
      ipAddress: '192.168.1.10',
      macAddress: '00:1E:67:89:AB:01',
      serialNumber: 'HPE-DL380-G10-449',
      brand: 'HPE',
      model: 'ProLiant DL380 Gen10',
      assignedUser: 'Área de Infraestructura / TI',
      department: 'Tecnologías de Información',
      location: 'Datacenter Principal - Rack A3',
      lastAuditDate: now,
      notes: 'Servidor de base de datos principal ERP y Tay-Audit. Misión crítica.',
      qrCodeData: 'TAY-SRV-DATABASE-CORE-HPE-DL380-G10-449'
    },
    {
      id: 'dev-004',
      hostname: 'PRINTER-RRHH-L3150',
      deviceType: 'printer',
      status: 'audited',
      os: 'Firmware v3.14.0',
      ram: '256 MB',
      cpu: 'Embedded SoC Controller',
      storage: 'Flash 128 MB',
      ipAddress: '192.168.1.120',
      macAddress: '38:D5:47:91:02:AA',
      serialNumber: 'EPSON-L3150-8472',
      brand: 'Epson',
      model: 'EcoTank L3150 Wi-Fi',
      assignedUser: 'Compartida (Recursos Humanos)',
      department: 'Talento Humano',
      location: 'Sede Central - Piso 3 (Pasillo RRHH)',
      lastAuditDate: now,
      notes: 'Impresora multifuncional de red. Sin soporte de control remoto interactivo.',
      qrCodeData: 'TAY-PRINTER-RRHH-L3150-EPSON-L3150-8472'
    },
    {
      id: 'dev-005',
      hostname: 'SW-CORE-CISCO-G24',
      deviceType: 'network',
      status: 'online',
      os: 'Cisco IOS-XE 17.6.3a',
      ram: '4 GB DDR3',
      cpu: 'ARMv7 Dual-Core 1.5 GHz',
      storage: '8 GB eMMC Flash',
      ipAddress: '192.168.1.2',
      macAddress: '2C:3F:0B:44:EE:12',
      serialNumber: 'CSCO-C9200L-24T-4G',
      brand: 'Cisco Systems',
      model: 'Catalyst 9200L 24 Puertos Gigabit',
      assignedUser: 'Redes y Comunicaciones',
      department: 'Tecnologías de Información',
      location: 'Datacenter Principal - Rack A1',
      lastAuditDate: now,
      notes: 'Switch de capa de distribución para toda la sede central.',
      qrCodeData: 'TAY-SW-CORE-CISCO-G24-CSCO-C9200L-24T-4G'
    },
    {
      id: 'dev-006',
      hostname: 'PC-RECEPCION-01',
      deviceType: 'pc',
      status: 'offline',
      os: 'Windows 10 Pro 64-bit (22H2)',
      ram: '8 GB DDR4 2666MHz',
      cpu: 'Intel Core i3-10100 (4 Cores, 4.3 GHz)',
      storage: '256 GB SATA SSD',
      ipAddress: '192.168.1.52',
      macAddress: '00:2B:67:11:00:D3',
      serialNumber: 'HP-PRODESK-400-G7',
      brand: 'HP',
      model: 'ProDesk 400 G7 SFF',
      assignedUser: 'Mariana Lopez',
      department: 'Atención al Cliente / Recepción',
      location: 'Entrada Principal - Recepción',
      lastAuditDate: now,
      notes: 'Equipo apagado al terminar turno. Se recomienda actualización a Windows 11.',
      qrCodeData: 'TAY-PC-RECEPCION-01-HP-PRODESK-400-G7'
    }
  ];

  const insert = db.prepare(`
    INSERT INTO devices (
      id, hostname, deviceType, status, os, ram, cpu, storage,
      ipAddress, macAddress, serialNumber, brand, model,
      assignedUser, department, location, lastAuditDate, notes, qrCodeData,
      createdAt, updatedAt
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?
    )
  `);

  for (const d of sampleDevices) {
    insert.run(
      d.id, d.hostname, d.deviceType, d.status, d.os, d.ram, d.cpu, d.storage,
      d.ipAddress, d.macAddress, d.serialNumber, d.brand, d.model,
      d.assignedUser, d.department, d.location, d.lastAuditDate, d.notes, d.qrCodeData,
      now, now
    );
  }

  // Initial audit log
  const insertLog = db.prepare(`
    INSERT INTO audit_logs (id, deviceId, hostname, action, details, performedBy, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertLog.run(
    'log-init',
    'dev-001',
    'PC-CONTAB-01',
    'SISTEMA_INICIADO',
    'Inicialización de base de datos corporativa Tay-Audit con equipos de inventario.',
    'Sistema Tay-Audit',
    now
  );
}

/**
 * Normaliza todos los tickets existentes a la nomenclatura TCK-0000 en orden cronológico ascendente.
 * (TCK-0001, TCK-0002, TCK-0003...)
 */
export function migrateTicketNomenclature(database = db) {
  try {
    const tickets = database.prepare('SELECT id, createdAt FROM support_tickets ORDER BY datetime(createdAt) ASC, rowid ASC').all();
    if (!tickets || tickets.length === 0) return;

    // Verificar si algún ticket no cumple el formato TCK-0001 correlativo ascendente
    const needsMigration = tickets.some((t, index) => {
      const expected = `TCK-${String(index + 1).padStart(4, '0')}`;
      return t.id !== expected;
    });

    if (needsMigration) {
      console.log('🔄 [DB Migration] Normalizando nomenclatura de tickets a formato TCK-0000 ascendente...');
      database.exec('BEGIN TRANSACTION;');
      // Paso 1: Asignar IDs temporales únicos para evitar violaciones de PRIMARY KEY
      for (const t of tickets) {
        database.prepare('UPDATE support_tickets SET id = ? WHERE id = ?').run(`__temp_${t.id}__`, t.id);
      }
      // Paso 2: Asignar IDs limpios TCK-0001, TCK-0002... en orden ascendente
      for (let i = 0; i < tickets.length; i++) {
        const oldTempId = `__temp_${tickets[i].id}__`;
        const newId = `TCK-${String(i + 1).padStart(4, '0')}`;
        database.prepare('UPDATE support_tickets SET id = ? WHERE id = ?').run(newId, oldTempId);
      }
      database.exec('COMMIT;');
      console.log(`✅ [DB Migration] ${tickets.length} tickets actualizados a nomenclatura TCK-0001... TCK-${String(tickets.length).padStart(4, '0')}`);
    }
  } catch (err) {
    try { database.exec('ROLLBACK;'); } catch (e) {}
    console.error('⚠️ [DB Migration Error] Error al normalizar tickets:', err.message);
  }
}

/**
 * Genera el siguiente ID secuencial ascendente en formato TCK-0000.
 * Ejemplo: Si existe TCK-0014, el siguiente será TCK-0015.
 */
export function getNextTicketId(database = db) {
  const rows = database.prepare('SELECT id FROM support_tickets').all();
  let maxNum = 0;
  for (const r of rows) {
    if (!r.id) continue;
    const match = String(r.id).match(/^TCK-(\d+)$/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }
  const nextNum = maxNum + 1;
  return `TCK-${String(nextNum).padStart(4, '0')}`;
}

