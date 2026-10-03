import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { exec } from 'node:child_process';
import localtunnel, { type Tunnel } from 'localtunnel';
import { config } from '../config/environment.js';

export class TunnelService {
  private static tunnelProcess: ChildProcess | null = null;
  private static tunnelInstance: Tunnel | null = null;
  private static currentUrl: string | null = null;
  private static shouldRun = false;
  private static reconnectTimer: NodeJS.Timeout | null = null;

  public static getTunnelUrl(): string | null {
    return this.currentUrl;
  }

  public static async startTunnel(): Promise<void> {
    if (this.tunnelProcess || this.tunnelInstance) return;
    this.shouldRun = true;

    const rootDir = path.resolve(process.cwd(), process.cwd().includes('apps') ? '../..' : '.');
    const cloudflaredExe = path.join(rootDir, 'cloudflared.exe');

    if (fs.existsSync(cloudflaredExe)) {
      this.startCloudflareTunnel(rootDir, cloudflaredExe);
    } else {
      this.startLocaltunnel(rootDir);
    }
  }

  private static startCloudflareTunnel(rootDir: string, cloudflaredExe: string): void {
    console.log(`[TunnelService] Launching Cloudflare Tunnel on port ${config.port}...`);
    try {
      this.tunnelProcess = spawn(cloudflaredExe, [
        'tunnel',
        '--edge-ip-version', '4',
        '--url', `http://localhost:${config.port}`
      ], {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
      });

      const handleData = (data: Buffer | string) => {
        const text = data.toString();
        const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
        if (match && match[0] !== this.currentUrl) {
          this.currentUrl = match[0];
          console.log('\n============================================================');
          console.log('   CLOUDFLARE TUNNEL ONLINE (HIGH-SPEED HTTPS & WSS)!');
          console.log('   Public Agent URL: ' + this.currentUrl);
          console.log('============================================================\n');

          const urlFile = path.join(rootDir, 'tunnel-url.txt');
          fs.writeFileSync(urlFile, this.currentUrl, 'utf-8');

          this.syncUrlToGitHub(rootDir, this.currentUrl);
        }
      };

      this.tunnelProcess.stdout?.on('data', handleData);
      this.tunnelProcess.stderr?.on('data', handleData);

      this.tunnelProcess.on('exit', (code) => {
        console.log(`[TunnelService] Cloudflare tunnel exited with code ${code}. Reconnecting in 5s...`);
        this.tunnelProcess = null;
        this.currentUrl = null;
        if (this.shouldRun) {
          this.scheduleReconnect(rootDir);
        }
      });

      this.tunnelProcess.on('error', (err) => {
        console.warn('[TunnelService] Cloudflare tunnel error:', err.message);
      });
    } catch (err) {
      console.error('[TunnelService] Failed to spawn cloudflared:', err);
      this.startLocaltunnel(rootDir);
    }
  }

  private static async startLocaltunnel(rootDir: string): Promise<void> {
    const preferredSubdomain = process.env.LOCALTUNNEL_SUBDOMAIN || 'mc-manager-dhurav';
    console.log(`[TunnelService] Connecting Localtunnel on port ${config.port} (subdomain: ${preferredSubdomain})...`);

    try {
      const tunnel = await localtunnel(config.port, { subdomain: preferredSubdomain });
      this.tunnelInstance = tunnel;
      this.currentUrl = tunnel.url;

      console.log('\n============================================================');
      console.log('   LOCALTUNNEL ONLINE (FIXED HTTPS ADDRESS)!');
      console.log('   Public Agent URL: ' + this.currentUrl);
      console.log('============================================================\n');

      const urlFile = path.join(rootDir, 'tunnel-url.txt');
      fs.writeFileSync(urlFile, this.currentUrl, 'utf-8');

      this.syncUrlToGitHub(rootDir, this.currentUrl);

      tunnel.on('close', () => {
        console.log('[TunnelService] Localtunnel closed. Reconnecting in 5s...');
        this.tunnelInstance = null;
        this.currentUrl = null;
        if (this.shouldRun) {
          this.scheduleReconnect(rootDir);
        }
      });

      tunnel.on('error', (err) => {
        console.warn('[TunnelService] Localtunnel error:', err?.message || err);
      });
    } catch (err) {
      console.error('[TunnelService] Failed to establish Localtunnel:', err instanceof Error ? err.message : err);
      this.tunnelInstance = null;
      if (this.shouldRun) {
        this.scheduleReconnect(rootDir);
      }
    }
  }

  private static scheduleReconnect(rootDir: string): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      if (this.shouldRun) {
        this.startTunnel().catch(() => {});
      }
    }, 5000);
  }

  private static syncUrlToGitHub(rootDir: string, url: string): void {
    try {
      const webPublicFile = path.join(rootDir, 'apps/web/public/tunnel.json');
      fs.writeFileSync(webPublicFile, JSON.stringify({ url, updatedAt: new Date().toISOString() }, null, 2), 'utf-8');

      const distPublicFile = path.join(rootDir, 'apps/web/dist/tunnel.json');
      if (fs.existsSync(path.dirname(distPublicFile))) {
        fs.writeFileSync(distPublicFile, JSON.stringify({ url, updatedAt: new Date().toISOString() }, null, 2), 'utf-8');
      }

      const gitCommand = 'git add apps/web/public/tunnel.json tunnel-url.txt && (git diff --cached --quiet || (git commit -m "chore: update live agent tunnel URL [skip ci]" && git push origin main))';
      exec(gitCommand, { cwd: rootDir }, (error, _stdout, stderr) => {
        if (error) {
          console.warn('[TunnelService] Git sync warning:', error.message);
          if (stderr) console.warn('[TunnelService] Git stderr:', stderr);
          return;
        }
        console.log('[TunnelService] Successfully pushed fixed agent tunnel URL to GitHub.');
      });
    } catch (err) {
      console.warn('[TunnelService] Error syncing tunnel URL to GitHub:', err);
    }
  }

  public static stop(): void {
    this.shouldRun = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.tunnelProcess) {
      try {
        if (process.platform === 'win32' && this.tunnelProcess.pid) {
          spawn('taskkill', ['/pid', this.tunnelProcess.pid.toString(), '/T', '/F']);
        } else {
          this.tunnelProcess.kill('SIGTERM');
        }
      } catch {}
      this.tunnelProcess = null;
    }
    if (this.tunnelInstance) {
      try {
        this.tunnelInstance.close();
      } catch {}
      this.tunnelInstance = null;
    }
    this.currentUrl = null;
    console.log('[TunnelService] Tunnel stopped.');
  }
}
