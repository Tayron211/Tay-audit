import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const db = new DatabaseSync('tay_audit.db');

function sqlVal(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  return "'" + String(v).replace(/'/g, "''") + "'";
}

const lines = [
  '-- ====================================================================',
  '-- TAY-AUDIT + STIVIE: MIGRACIÓN INICIAL DE DATOS DESDE SQLITE LOCAL',
  '-- ====================================================================',
  ''
];

// 1. devices
const devices = db.prepare('SELECT * FROM devices').all();
for (const d of devices) {
  lines.push(
    `INSERT OR REPLACE INTO devices (id, hostname, deviceType, status, os, ram, cpu, storage, ipAddress, macAddress, serialNumber, motherboard, compatibility, brand, model, assignedUser, department, location, lastAuditDate, notes, supplies, specs, qrCodeData, stivieInstalled, lastAgentPing, createdAt, updatedAt) VALUES (${[
      d.id, d.hostname, d.deviceType, d.status, d.os, d.ram, d.cpu, d.storage,
      d.ipAddress, d.macAddress, d.serialNumber, d.motherboard, d.compatibility,
      d.brand, d.model, d.assignedUser, d.department, d.location, d.lastAuditDate,
      d.notes, d.supplies, d.specs, d.qrCodeData, d.stivieInstalled ?? 0,
      d.lastAgentPing, d.createdAt, d.updatedAt
    ].map(sqlVal).join(', ')});`
  );
}

// 2. support_tickets
const tickets = db.prepare('SELECT * FROM support_tickets').all();
for (const t of tickets) {
  lines.push(
    `INSERT OR REPLACE INTO support_tickets (id, deviceId, hostname, userName, category, description, urgency, status, solutionNotes, createdAt, resolvedAt) VALUES (${[
      t.id, t.deviceId, t.hostname, t.userName, t.category, t.description,
      t.urgency, t.status, t.solutionNotes, t.createdAt, t.resolvedAt
    ].map(sqlVal).join(', ')});`
  );
}

// 3. stivie_knowledge
const knowledge = db.prepare('SELECT * FROM stivie_knowledge').all();
for (const k of knowledge) {
  lines.push(
    `INSERT OR REPLACE INTO stivie_knowledge (id, triggerKeywords, category, questionPattern, solutionText, actionType, actionLabel, helpfulCount, learnedFrom, createdAt, updatedAt) VALUES (${[
      k.id, k.triggerKeywords, k.category, k.questionPattern, k.solutionText,
      k.actionType, k.actionLabel, k.helpfulCount ?? 0, k.learnedFrom, k.createdAt, k.updatedAt
    ].map(sqlVal).join(', ')});`
  );
}

// 4. audit_logs
const logs = db.prepare('SELECT * FROM audit_logs ORDER BY datetime(timestamp) DESC LIMIT 200').all();
for (const l of logs) {
  lines.push(
    `INSERT OR REPLACE INTO audit_logs (id, deviceId, hostname, action, details, performedBy, timestamp) VALUES (${[
      l.id, l.deviceId, l.hostname, l.action, l.details, l.performedBy, l.timestamp
    ].map(sqlVal).join(', ')});`
  );
}

lines.push(`INSERT OR REPLACE INTO system_meta (key, value) VALUES ('last_change_ts', '${Date.now()}');`);

fs.mkdirSync('migrations', { recursive: true });
fs.writeFileSync('migrations/0002_seed_data.sql', lines.join('\n'), 'utf8');

// Also generate functions/_stivieCsSource.js with base64 of server/STIVIE.cs
fs.mkdirSync('functions', { recursive: true });
const csBase64 = fs.readFileSync(path.join('server', 'STIVIE.cs')).toString('base64');
fs.writeFileSync(
  'functions/_stivieCsSource.js',
  `// Auto-generated base64 of server/STIVIE.cs for fallback compilation\nexport const STIVIE_CS_BASE64 = ${JSON.stringify(csBase64)};\n`,
  'utf8'
);

console.log(`Exported: ${devices.length} devices, ${tickets.length} tickets, ${knowledge.length} knowledge, ${logs.length} logs.`);

