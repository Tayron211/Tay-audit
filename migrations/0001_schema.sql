-- ====================================================================
-- TAY-AUDIT + STIVIE CLOUD 24/7: CLOUDFLARE D1 DATABASE SCHEMA
-- ====================================================================

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
  qrCodeData TEXT,
  stivieInstalled INTEGER DEFAULT 0,
  lastAgentPing TEXT,
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

CREATE TABLE IF NOT EXISTS agent_commands (
  id TEXT PRIMARY KEY,
  hostname TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT,
  createdAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS system_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_devices_hostname ON devices(hostname);
CREATE INDEX IF NOT EXISTS idx_devices_type ON devices(deviceType);
CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_hostname ON support_tickets(hostname);
CREATE INDEX IF NOT EXISTS idx_commands_hostname ON agent_commands(hostname);
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON audit_logs(timestamp);

INSERT OR IGNORE INTO system_meta (key, value) VALUES ('last_change_ts', '1');

