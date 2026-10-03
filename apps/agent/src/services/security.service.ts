import path from 'node:path';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { config } from '../config/environment.js';

export class SecurityError extends Error {
  public code: string;
  constructor(message: string, code = 'ACCESS_DENIED') {
    super(message);
    this.name = 'SecurityError';
    this.code = code;
  }
}

export const SecurityService = {
  /**
   * Hashes a password securely using bcrypt with 12 rounds.
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  },

  /**
   * Verifies a plain text password against a bcrypt hash.
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  },

  /**
   * Generates a secure random 32-byte authentication token.
   */
  generateSessionToken(): string {
    return crypto.randomBytes(32).toString('hex');
  },

  /**
   * Hashes a session token for secure SQLite storage using SHA-256.
   */
  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  },

  /**
   * Resolves and verifies that a target path remains strictly inside the approved root directory.
   * Defends against:
   *  - Traversal sequences (../../)
   *  - Drive hopping (C:\Windows, D:\...)
   *  - Null byte poisoning (%00)
   *  - URL-encoded traversal (%2e%2e)
   */
  resolveSafePath(baseDir: string, relativeOrSubPath: string): string {
    if (!relativeOrSubPath || typeof relativeOrSubPath !== 'string') {
      return path.resolve(baseDir);
    }

    // Check for null bytes
    if (relativeOrSubPath.indexOf('\0') !== -1) {
      throw new SecurityError('Path contains invalid null byte sequence', 'INVALID_PATH');
    }

    // Decode URL encodings if present
    let cleanPath = relativeOrSubPath;
    try {
      cleanPath = decodeURIComponent(cleanPath);
    } catch {
      // ignore decode failure and continue with raw
    }

    // Resolve base to canonical absolute path
    const resolvedBase = path.resolve(baseDir);

    // Resolve target path
    const resolvedTarget = path.resolve(resolvedBase, cleanPath);

    // Normalize casing and separators for Windows
    const normalizedBase = resolvedBase.toLowerCase();
    const normalizedTarget = resolvedTarget.toLowerCase();

    // The target path MUST be either the base directory or a subdirectory inside it
    if (normalizedTarget !== normalizedBase && !normalizedTarget.startsWith(normalizedBase + path.sep)) {
      throw new SecurityError(
        'Access denied: Path traversal outside authorized directory detected',
        'PATH_TRAVERSAL_DETECTED'
      );
    }

    return resolvedTarget;
  },

  /**
   * Safe path check against server root directory
   */
  resolveServerPath(subPath: string): string {
    return this.resolveSafePath(config.serverDir, subPath);
  },

  /**
   * Safe path check against backup root directory
   */
  resolveBackupPath(subPath: string): string {
    return this.resolveSafePath(config.backupDir, subPath);
  },

  /**
   * Sanitizes uploaded filenames to prevent dangerous characters.
   */
  sanitizeFilename(filename: string): string {
    const base = path.basename(filename);
    // Remove any path traversal or invalid windows filename characters: < > : " / \ | ? * and controls
    const sanitized = base.replace(/[\x00-\x1f\x80-\x9f<>:"/\\|?*]+/g, '_').trim();
    if (!sanitized || sanitized === '.' || sanitized === '..') {
      return 'unnamed_file';
    }
    return sanitized;
  }
};
