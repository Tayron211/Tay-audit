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
      supplies TEXT,
      specs TEXT,
      monitorBrand TEXT,
      monitorModel TEXT,
      monitorSerial TEXT,
      monitorSpecs TEXT,
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

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id TEXT PRIMARY KEY,
      endpoint TEXT UNIQUE,
      p256dh TEXT,
      auth TEXT,
      userAgent TEXT,
      createdAt TEXT
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
  try {
    db.exec("ALTER TABLE devices ADD COLUMN monitorBrand TEXT;");
  } catch (err) {}
  try {
    db.exec("ALTER TABLE devices ADD COLUMN monitorModel TEXT;");
  } catch (err) {}
  try {
    db.exec("ALTER TABLE devices ADD COLUMN monitorSerial TEXT;");
  } catch (err) {}
  try {
    db.exec("ALTER TABLE devices ADD COLUMN monitorSpecs TEXT;");
  } catch (err) {}

  // Backfill motherboard and compatibility for existing inventory items if needed
  try {
    db.exec(`
      UPDATE devices SET motherboard = 'Placa Base Estándar ' || brand, compatibility = 'Compatible' WHERE motherboard IS NULL OR motherboard = '';
      UPDATE devices SET compatibility = 'Compatible' WHERE compatibility IS NULL OR compatibility = '';
    `);
  } catch (_err) {}

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

