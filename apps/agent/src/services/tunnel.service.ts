import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

export class TunnelService {
  private static tunnelProcess: ChildProcess | null = null;
  private static currentUrl: string | null = null;

  public static getTunnelUrl(): string | null {
    return this.currentUrl;
  }

  public static startTunnel(): void {
    const rootDir = path.resolve(process.cwd(), process.cwd().includes('apps') ? '../..' : '.');
    const cloudflaredExe = path.join(rootDir, 'cloudflared.exe');

    if (!fs.existsSync(cloudflaredExe)) {
      console.log('[TunnelService] cloudflared.exe not found at:', cloudflaredExe);
      return;
    }

    console.log('[TunnelService] Launching automatic Cloudflare Tunnel for Vercel connection...');

    try {
      this.tunnelProcess = spawn(cloudflaredExe, ['tunnel', '--url', 'http://localhost:3001'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
      });

      const handleData = (data: Buffer) => {
        const text = data.toString('utf-8');
        const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
        if (match && match[0] !== this.currentUrl) {
          this.currentUrl = match[0];
          console.log('\n============================================================');
          console.log('   AUTOMATIC CLOUDFLARE TUNNEL ONLINE FOR VERCEL!');
          console.log('   Public Agent URL: ' + this.currentUrl);
          console.log('============================================================\n');

          // Save to tunnel-url.txt for convenience
          const urlFile = path.join(rootDir, 'tunnel-url.txt');
          fs.writeFileSync(urlFile, this.currentUrl, 'utf-8');

          // Automatically commit and push tunnel-url.json to GitHub so Vercel can auto-connect
          this.syncUrlToGitHub(rootDir, this.currentUrl);
        }
      };

      this.tunnelProcess.stdout?.on('data', handleData);
      this.tunnelProcess.stderr?.on('data', handleData);

      this.tunnelProcess.on('exit', (code) => {
        console.log(`[TunnelService] Tunnel exited with code ${code}. Reconnecting in 10s...`);
        this.currentUrl = null;
        setTimeout(() => this.startTunnel(), 10000);
      });

      this.tunnelProcess.on('error', (err) => {
        console.error('[TunnelService] Tunnel error:', err.message);
      });
    } catch (e) {
      console.error('[TunnelService] Failed to spawn tunnel:', e);
    }
  }

  private static syncUrlToGitHub(rootDir: string, url: string): void {
    try {
      // Write to public/tunnel.json inside apps/web so any deployed site or raw GitHub fetch sees it
      const webPublicFile = path.join(rootDir, 'apps/web/public/tunnel.json');
      fs.writeFileSync(webPublicFile, JSON.stringify({ url, updatedAt: new Date().toISOString() }, null, 2), 'utf-8');

      // Use git to push tunnel.json automatically
      const gitCmd = spawn('git', ['add', 'apps/web/public/tunnel.json'], { cwd: rootDir });
      gitCmd.on('close', (c1) => {
        if (c1 === 0) {
          const commitCmd = spawn('git', ['commit', '-m', 'chore: update live agent tunnel URL [skip ci]'], { cwd: rootDir });
          commitCmd.on('close', (c2) => {
            if (c2 === 0) {
              spawn('git', ['push', 'origin', 'main'], { cwd: rootDir });
            }
          });
        }
      });
    } catch {
      // ignore git sync errors
    }
  }

  public static stop(): void {
    if (this.tunnelProcess) {
      this.tunnelProcess.kill();
      this.tunnelProcess = null;
    }
  }
}
