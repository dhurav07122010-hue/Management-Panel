import { getDatabase } from './db.js';
import { v4 as uuidv4 } from 'uuid';
import type { BackupRecord, AuditLogEntry } from '@mc-panel/types';

export interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  created_at: string;
}

export interface SessionRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export const UserRepository = {
  findByUsername(username: string): UserRow | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
    const row = stmt.get(username) as UserRow | undefined;
    return row || null;
  },

  findById(id: string): UserRow | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    const row = stmt.get(id) as UserRow | undefined;
    return row || null;
  },

  count(): number {
    const db = getDatabase();
    const stmt = db.prepare('SELECT COUNT(*) as count FROM users');
    const row = stmt.get() as { count: number };
    return row.count;
  },

  create(username: string, passwordHash: string): UserRow {
    const db = getDatabase();
    const id = uuidv4();
    const createdAt = new Date().toISOString();
    const stmt = db.prepare('INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)');
    stmt.run(id, username, passwordHash, createdAt);
    return { id, username, password_hash: passwordHash, created_at: createdAt };
  },

  updatePassword(userId: string, newPasswordHash: string): void {
    const db = getDatabase();
    const stmt = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?');
    stmt.run(newPasswordHash, userId);
  }
};

export const SessionRepository = {
  create(userId: string, tokenHash: string, expiresAt: string, ipAddress?: string, userAgent?: string): SessionRow {
    const db = getDatabase();
    const id = uuidv4();
    const createdAt = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO sessions (id, user_id, token_hash, expires_at, ip_address, user_agent, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, userId, tokenHash, expiresAt, ipAddress || null, userAgent || null, createdAt);
    return { id, user_id: userId, token_hash: tokenHash, expires_at: expiresAt, ip_address: ipAddress, user_agent: userAgent, created_at: createdAt };
  },

  findByTokenHash(tokenHash: string): (SessionRow & { username: string }) | null {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT s.*, u.username 
      FROM sessions s 
      JOIN users u ON s.user_id = u.id 
      WHERE s.token_hash = ? AND s.expires_at > ?
    `);
    const now = new Date().toISOString();
    const row = stmt.get(tokenHash, now) as (SessionRow & { username: string }) | undefined;
    return row || null;
  },

  deleteByTokenHash(tokenHash: string): void {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM sessions WHERE token_hash = ?');
    stmt.run(tokenHash);
  },

  deleteAllForUser(userId: string): void {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM sessions WHERE user_id = ?');
    stmt.run(userId);
  },

  cleanExpired(): void {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM sessions WHERE expires_at <= ?');
    stmt.run(new Date().toISOString());
  }
};

export const SettingsRepository = {
  get(key: string): string | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
    const row = stmt.get(key) as { value: string } | undefined;
    return row ? row.value : null;
  },

  getAll(): Record<string, string> {
    const db = getDatabase();
    const stmt = db.prepare('SELECT key, value FROM settings');
    const rows = stmt.all() as Array<{ key: string; value: string }>;
    const result: Record<string, string> = {};
    for (const r of rows) {
      result[r.key] = r.value;
    }
    return result;
  },

  set(key: string, value: string): void {
    const db = getDatabase();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO settings (key, value, updated_at) 
      VALUES (?, ?, ?) 
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `);
    stmt.run(key, value, now);
  },

  setMultiple(settings: Record<string, string>): void {
    for (const [key, value] of Object.entries(settings)) {
      this.set(key, value);
    }
  }
};

export const AuditLogRepository = {
  create(username: string, action: string, details?: string, userId?: string, ipAddress?: string): AuditLogEntry {
    const db = getDatabase();
    const id = uuidv4();
    const timestamp = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO audit_logs (id, user_id, username, action, details, ip_address, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, userId || null, username, action, details || null, ipAddress || null, timestamp);
    return { id, userId, username, action, details, ipAddress, timestamp };
  },

  list(limit = 100, offset = 0): AuditLogEntry[] {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT id, user_id as userId, username, action, details, ip_address as ipAddress, timestamp 
      FROM audit_logs 
      ORDER BY timestamp DESC 
      LIMIT ? OFFSET ?
    `);
    return stmt.all(limit, offset) as unknown as AuditLogEntry[];
  }
};

export const BackupRepository = {
  create(filename: string, sizeBytes: number, status: 'COMPLETED' | 'IN_PROGRESS' | 'FAILED', type: BackupRecord['type'], notes?: string): BackupRecord {
    const db = getDatabase();
    const id = uuidv4();
    const createdAt = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO backup_records (id, filename, size_bytes, status, type, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, filename, sizeBytes, status, type, notes || null, createdAt);
    return { id, filename, sizeBytes, status, type, notes, createdAt };
  },

  updateStatus(id: string, status: 'COMPLETED' | 'FAILED', sizeBytes?: number): void {
    const db = getDatabase();
    if (sizeBytes !== undefined) {
      const stmt = db.prepare('UPDATE backup_records SET status = ?, size_bytes = ? WHERE id = ?');
      stmt.run(status, sizeBytes, id);
    } else {
      const stmt = db.prepare('UPDATE backup_records SET status = ? WHERE id = ?');
      stmt.run(status, id);
    }
  },

  list(): BackupRecord[] {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT id, filename, size_bytes as sizeBytes, status, type, notes, created_at as createdAt 
      FROM backup_records 
      ORDER BY created_at DESC
    `);
    return stmt.all() as unknown as BackupRecord[];
  },

  findById(id: string): BackupRecord | null {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT id, filename, size_bytes as sizeBytes, status, type, notes, created_at as createdAt 
      FROM backup_records 
      WHERE id = ?
    `);
    const row = stmt.get(id) as unknown as BackupRecord | undefined;
    return row || null;
  },

  delete(id: string): void {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM backup_records WHERE id = ?');
    stmt.run(id);
  }
};

export interface AgentRow {
  id: string;
  name: string;
  installation_id: string;
  credential_hash: string;
  status: string;
  last_seen: string | null;
  last_connected: string | null;
  version: string;
  os: string;
  hostname: string;
  capabilities_json: string;
  created_at: string;
  updated_at: string;
}

export const AgentRepository = {
  createOrUpdate(agent: {
    id: string;
    name: string;
    installationId: string;
    credentialHash: string;
    version: string;
    os: string;
    hostname: string;
    capabilitiesJson: string;
  }): void {
    const db = getDatabase();
    const now = new Date().toISOString();
    const existing = db.prepare('SELECT id FROM registered_agents WHERE id = ? OR installation_id = ?').get(agent.id, agent.installationId) as { id: string } | undefined;

    if (existing) {
      const stmt = db.prepare(`
        UPDATE registered_agents
        SET name = ?, version = ?, os = ?, hostname = ?, capabilities_json = ?, credential_hash = ?, updated_at = ?
        WHERE id = ?
      `);
      stmt.run(agent.name, agent.version, agent.os, agent.hostname, agent.capabilitiesJson, agent.credentialHash, now, existing.id);
    } else {
      const stmt = db.prepare(`
        INSERT INTO registered_agents
        (id, name, installation_id, credential_hash, status, last_seen, last_connected, version, os, hostname, capabilities_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'OFFLINE', ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        agent.id,
        agent.name,
        agent.installationId,
        agent.credentialHash,
        now,
        now,
        agent.version,
        agent.os,
        agent.hostname,
        agent.capabilitiesJson,
        now,
        now
      );
    }
  },

  findById(id: string): AgentRow | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM registered_agents WHERE id = ?');
    const row = stmt.get(id) as AgentRow | undefined;
    return row || null;
  },

  findByInstallationId(installationId: string): AgentRow | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM registered_agents WHERE installation_id = ?');
    const row = stmt.get(installationId) as AgentRow | undefined;
    return row || null;
  },

  list(): AgentRow[] {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM registered_agents ORDER BY updated_at DESC');
    return stmt.all() as unknown as AgentRow[];
  },

  updateHeartbeat(id: string, status: string = 'ONLINE'): void {
    const db = getDatabase();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      UPDATE registered_agents
      SET last_seen = ?, status = ?, updated_at = ?
      WHERE id = ?
    `);
    stmt.run(now, status, now, id);
  },

  updateConnectionStatus(id: string, status: string, connectedNow: boolean = false): void {
    const db = getDatabase();
    const now = new Date().toISOString();
    if (connectedNow) {
      const stmt = db.prepare(`
        UPDATE registered_agents
        SET status = ?, last_connected = ?, last_seen = ?, updated_at = ?
        WHERE id = ?
      `);
      stmt.run(status, now, now, now, id);
    } else {
      const stmt = db.prepare(`
        UPDATE registered_agents
        SET status = ?, updated_at = ?
        WHERE id = ?
      `);
      stmt.run(status, now, id);
    }
  },

  delete(id: string): void {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM registered_agents WHERE id = ?');
    stmt.run(id);
  }
};

export interface PairingCodeRow {
  code: string;
  agent_id: string | null;
  expires_at: string;
  is_used: number;
  created_at: string;
}

export const PairingCodeRepository = {
  create(code: string, expiresAt: string, agentId?: string): void {
    const db = getDatabase();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO pairing_codes (code, agent_id, expires_at, is_used, created_at)
      VALUES (?, ?, ?, 0, ?)
    `);
    stmt.run(code, agentId || null, expiresAt, now);
  },

  findValid(code: string): PairingCodeRow | null {
    const db = getDatabase();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      SELECT * FROM pairing_codes
      WHERE code = ? AND is_used = 0 AND expires_at > ?
    `);
    const row = stmt.get(code, now) as PairingCodeRow | undefined;
    return row || null;
  },

  markUsed(code: string): void {
    const db = getDatabase();
    const stmt = db.prepare('UPDATE pairing_codes SET is_used = 1 WHERE code = ?');
    stmt.run(code);
  },

  cleanExpired(): void {
    const db = getDatabase();
    const now = new Date().toISOString();
    const stmt = db.prepare('DELETE FROM pairing_codes WHERE expires_at <= ? OR is_used = 1');
    stmt.run(now);
  }
};

export interface CommandRow {
  id: string;
  agent_id: string;
  type: string;
  payload_json: string;
  status: string;
  queueable: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export const AgentCommandRepository = {
  create(cmd: {
    id: string;
    agentId: string;
    type: string;
    payloadJson: string;
    status: string;
    queueable: boolean;
  }): void {
    const db = getDatabase();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO agent_commands (id, agent_id, type, payload_json, status, queueable, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(cmd.id, cmd.agentId, cmd.type, cmd.payloadJson, cmd.status, cmd.queueable ? 1 : 0, now, now);
  },

  updateStatus(id: string, status: string, errorMessage?: string): void {
    const db = getDatabase();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      UPDATE agent_commands
      SET status = ?, error_message = ?, updated_at = ?
      WHERE id = ?
    `);
    stmt.run(status, errorMessage || null, now, id);
  },

  getQueuedCommands(agentId: string): CommandRow[] {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM agent_commands
      WHERE agent_id = ? AND queueable = 1 AND status = 'COMMAND_SENT'
      ORDER BY created_at ASC
    `);
    return stmt.all(agentId) as unknown as CommandRow[];
  }
};

