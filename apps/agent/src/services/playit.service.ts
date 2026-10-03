import { spawn, execSync, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export class PlayitService {
  private static serviceChecked = false;

  /**
   * Discovers and guarantees that playit is running.
   */
  public static ensureRunning(): void {
    if (this.serviceChecked) return;
    this.serviceChecked = true;

    try {
      const playitPath = this.getPlayitExecutable();
      if (!playitPath) {
        console.log('[PlayitService] playit executable not detected on this system.');
        return;
      }

      console.log('[PlayitService] Ensuring playit tunnel service is active...');

      // Check status using playit CLI
      try {
        const statusOutput = execSync(`"${playitPath}" status`, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
        if (statusOutput.includes('Phase: running')) {
          console.log('[PlayitService] Playit tunnel service is already active and running.');
          return;
        }
      } catch {
        // playit status might fail if service not started
      }

      // Try starting via playit CLI
      const startProc = spawn(playitPath, ['start'], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true
      });
      startProc.unref();
      console.log('[PlayitService] Dispatched start command to playit service.');
    } catch (err) {
      console.error('[PlayitService] Error checking/starting playit:', err instanceof Error ? err.message : err);
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
