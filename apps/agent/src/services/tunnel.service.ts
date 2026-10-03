import { spawn, execSync, exec, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { config } from '../config/environment.js';

export class TunnelService {
  private static tunnelProcess: ChildProcess | null = null;
  private static currentUrl: string | null = null;
  private static shouldRun = false;

  public static getTunnelUrl(): string | null {
    return this.currentUrl;
  }

  public static startTunnel(): void {
    if (this.tunnelProcess) return;
    this.shouldRun = true;

    const rootDir = path.resolve(process.cwd(), process.cwd().includes('apps') ? '../..' : '.');
    const cloudflaredExe = path.join(rootDir, 'cloudflared.exe');

    if (!fs.existsSync(cloudflaredExe)) {
      console.log('[TunnelService] cloudflared.exe not found at:', cloudflaredExe);
      return;
    }

    if (process.platform === 'win32') {
      try {
        execSync('taskkill /IM cloudflared.exe /F', { stdio: 'ignore' });
      } catch {
        // ignore if not running
      }
    }

    console.log('[TunnelService] Launching Cloudflare Tunnel for management system...');

    try {
      this.tunnelProcess = spawn(
        cloudflaredExe,
        ['tunnel', '--no-autoupdate', '--metrics', 'localhost:0', '--edge-ip-version', '4', '--url', `http://localhost:${config.port}`],
        {
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: true
        }
      );

      const handleData = (data: Buffer) => {
        const text = data.toString('utf-8');
        const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
        if (match && match[0] !== this.currentUrl) {
          this.currentUrl = match[0];
          console.log('\n============================================================');
          console.log('   CLOUDFLARE TUNNEL ONLINE FOR VERCEL / REMOTE ACCESS!');
          console.log('   Public Agent URL: ' + this.currentUrl);
          console.log('============================================================\n');

          // Save to tunnel-url.txt for convenience
          const urlFile = path.join(rootDir, 'tunnel-url.txt');
          fs.writeFileSync(urlFile, this.currentUrl, 'utf-8');

          // Automatically commit and push tunnel.json to GitHub so Vercel can auto-connect
          this.syncUrlToGitHub(rootDir, this.currentUrl);
        } else if (text.includes('ERR') || text.includes('failed') || text.includes('error')) {
          console.warn(`[TunnelService] ${text.trim()}`);
        }
      };

      this.tunnelProcess.stdout?.on('data', handleData);
      this.tunnelProcess.stderr?.on('data', handleData);

      this.tunnelProcess.on('exit', (code) => {
        this.currentUrl = null;
        this.tunnelProcess = null;
        if (!this.shouldRun) return;
        console.log(`[TunnelService] Tunnel exited with code ${code}. Reconnecting in 5s...`);
        setTimeout(() => {
          if (this.shouldRun) this.startTunnel();
        }, 5000);
      });

      this.tunnelProcess.on('error', (err) => {
        console.error('[TunnelService] Tunnel error:', err.message);
        this.tunnelProcess = null;
      });
    } catch (e) {
      this.tunnelProcess = null;
      console.error('[TunnelService] Failed to spawn tunnel:', e);
    }
  }

  private static syncUrlToGitHub(rootDir: string, url: string): void {
    try {
      // Write to public/tunnel.json inside apps/web so any deployed site or raw GitHub fetch sees it
      const webPublicFile = path.join(rootDir, 'apps/web/public/tunnel.json');
      fs.writeFileSync(webPublicFile, JSON.stringify({ url, updatedAt: new Date().toISOString() }, null, 2), 'utf-8');

      const distPublicFile = path.join(rootDir, 'apps/web/dist/tunnel.json');
      if (fs.existsSync(path.dirname(distPublicFile))) {
        fs.writeFileSync(distPublicFile, JSON.stringify({ url, updatedAt: new Date().toISOString() }, null, 2), 'utf-8');
      }

      console.log(`[TunnelService] Syncing live tunnel URL to GitHub repository...`);

      const gitCommand = 'git add apps/web/public/tunnel.json tunnel-url.txt && git commit -m "chore: update live agent tunnel URL [skip ci]" && git pull --rebase origin main && git push origin main';
      exec(gitCommand, { cwd: rootDir }, (error, _stdout, stderr) => {
        if (error) {
          console.warn('[TunnelService] Git sync warning:', error.message);
          if (stderr) console.warn('[TunnelService] Git stderr:', stderr);
          return;
        }
        console.log('[TunnelService] Successfully pushed live agent tunnel URL to GitHub.');
      });
    } catch (err) {
      console.warn('[TunnelService] Error syncing tunnel URL to GitHub:', err);
    }
  }

  public static stop(): void {
    this.shouldRun = false;
    if (this.tunnelProcess) {
      try {
        if (process.platform === 'win32' && this.tunnelProcess.pid) {
          spawn('taskkill', ['/pid', this.tunnelProcess.pid.toString(), '/T', '/F']);
        } else {
          this.tunnelProcess.kill('SIGKILL');
        }
      } catch {
        // ignore
      }
      this.tunnelProcess = null;
    }
    this.currentUrl = null;
    console.log('[TunnelService] Cloudflare tunnel stopped.');
  }
}
