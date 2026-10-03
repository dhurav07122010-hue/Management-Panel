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
