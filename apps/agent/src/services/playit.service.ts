import { execSync } from 'node:child_process';
import fs from 'node:fs';

export class PlayitService {
  /**
   * Starts the playit tunnel service when Minecraft server is started.
   */
  public static start(): void {
    try {
      const playitPath = this.getPlayitExecutable();
      if (!playitPath) {
        console.log('[PlayitService] playit executable not detected on this system.');
        return;
      }

      if (this.isRunning()) {
        console.log('[PlayitService] Playit tunnel service is already active and running.');
        return;
      }

      console.log('[PlayitService] Starting playit tunnel for Minecraft server...');
      execSync(`"${playitPath}" start`, {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 10000
      });
      console.log('[PlayitService] Playit tunnel service started.');
    } catch (err) {
      console.error('[PlayitService] Error starting playit:', err instanceof Error ? err.message : err);
    }
  }

  /**
   * Stops the playit tunnel service when Minecraft server is stopped.
   */
  public static stop(): void {
    try {
      const playitPath = this.getPlayitExecutable();
      if (!playitPath) return;

      if (!this.isRunning()) {
        return;
      }

      console.log('[PlayitService] Stopping playit tunnel service...');
      execSync(`"${playitPath}" stop`, {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 10000
      });
      console.log('[PlayitService] Playit tunnel service stopped.');
    } catch (err) {
      console.error('[PlayitService] Error stopping playit:', err instanceof Error ? err.message : err);
    }
  }

  public static isRunning(): boolean {
    const playitPath = this.getPlayitExecutable();
    if (!playitPath) return false;

    try {
      const statusOutput = execSync(`"${playitPath}" status`, {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 5000
      });
      return statusOutput.includes('Phase: running');
    } catch {
      return false;
    }
  }

  public static getPlayitExecutable(): string | null {
    // Check known default paths
    const standardPath = 'C:\\Program Files\\playit_gg\\bin\\playit.exe';
    if (fs.existsSync(standardPath)) {
      return standardPath;
    }

    try {
      const where = execSync('where playit', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      const firstLine = where.split(/\r?\n/)[0];
      if (firstLine && fs.existsSync(firstLine)) {
        return firstLine;
      }
    } catch {
      // not in PATH
    }

    return null;
  }
}

