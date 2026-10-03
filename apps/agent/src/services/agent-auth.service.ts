import crypto from 'node:crypto';
import type { AgentRow } from '../database/repositories.js';
import type { AgentOfflineStatus } from '@mc-panel/types';

export const OFFLINE_THRESHOLDS = {
  ONLINE_MAX_MS: 20 * 1000,      // 0 - 20s
  DEGRADED_MAX_MS: 45 * 1000,    // 20 - 45s
  OFFLINE_MS: 45 * 1000          // 45s+
};

export class AgentAuthManager {
  /**
   * Generates a 32-byte secure agent token (hex).
   */
  public static generateAgentToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generates a secure single-use pairing code (e.g. '7F4A-9B2C').
   */
  public static generatePairingCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let codePart1 = '';
    let codePart2 = '';
    const bytes = crypto.randomBytes(8);
    for (let i = 0; i < 4; i++) {
      codePart1 += chars[bytes[i] % chars.length];
      codePart2 += chars[bytes[i + 4] % chars.length];
    }
    return `${codePart1}-${codePart2}`;
  }

  /**
   * Hashes an agent authentication credential with SHA-256 for database comparison.
   */
  public static hashAgentCredential(token: string): string {
    return crypto.createHash('sha256').update(token.trim()).digest('hex');
  }

  /**
   * Determines current status given the lastSeen timestamp.
   * 0 - 20s: ONLINE
   * 20 - 45s: DEGRADED
   * 45s+: OFFLINE
   */
  public static computeAgentStatus(lastSeenIso: string | null): AgentOfflineStatus {
    if (!lastSeenIso) return 'OFFLINE';
    const lastSeenTime = new Date(lastSeenIso).getTime();
    if (isNaN(lastSeenTime)) return 'OFFLINE';

    const diff = Date.now() - lastSeenTime;
    if (diff <= OFFLINE_THRESHOLDS.ONLINE_MAX_MS) {
      return 'ONLINE';
    }
    if (diff <= OFFLINE_THRESHOLDS.DEGRADED_MAX_MS) {
      return 'DEGRADED';
    }
    return 'OFFLINE';
  }

  /**
   * Calculates how many seconds ago lastSeen was recorded.
   */
  public static getSecondsAgo(lastSeenIso: string | null): number | null {
    if (!lastSeenIso) return null;
    const lastSeenTime = new Date(lastSeenIso).getTime();
    if (isNaN(lastSeenTime)) return null;
    return Math.max(0, Math.floor((Date.now() - lastSeenTime) / 1000));
  }
}
