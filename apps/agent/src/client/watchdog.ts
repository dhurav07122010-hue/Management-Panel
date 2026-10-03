import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const rootDir = path.resolve(process.cwd(), process.cwd().includes('apps') ? '../..' : '.');
const logFile = path.join(rootDir, 'data', 'watchdog.log');
const pidFile = path.join(rootDir, 'data', 'agent.pid');

function log(msg: string): void {
  const line = `[${new Date().toISOString()}] [Watchdog] ${msg}\n`;
  process.stdout.write(line);
  try {
    fs.appendFileSync(logFile, line, 'utf-8');
  } catch {}
}

export class WindowsAgentWatchdog {
  private agentProcess: ChildProcess | null = null;
  private shouldRun = true;
  private failureCount = 0;
  private maxRestarts = 10;
  private checkIntervalMs = 5000;

  public start(): void {
    log('Starting Windows Agent Process Watchdog Supervisor...');

    this.spawnAgent();

    // Health check loop
    setInterval(() => {
      this.checkAgentHealth();
    }, this.checkIntervalMs);

    process.on('SIGINT', () => this.stop());
    process.on('SIGTERM', () => this.stop());
  }

  private spawnAgent(): void {
    if (!this.shouldRun) return;

    const entryPoint = path.join(rootDir, 'apps', 'agent', 'dist', 'index.js');
    log(`Spawning agent process with Node: ${entryPoint}`);

    const child = spawn(process.execPath, [entryPoint, '--agent-client'], {
      cwd: rootDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'production' }
    });

    this.agentProcess = child;

    if (child.pid) {
      try {
        fs.writeFileSync(pidFile, child.pid.toString(), 'utf-8');
      } catch {}
    }

    child.stdout?.on('data', (d) => {
      process.stdout.write(d);
    });

    child.stderr?.on('data', (d) => {
      process.stderr.write(d);
    });

    child.on('exit', (code, signal) => {
      log(`Agent process exited with code ${code}, signal ${signal}`);
      this.agentProcess = null;

      if (this.shouldRun) {
        this.failureCount++;
        const backoff = Math.min(30000, 2000 * Math.pow(1.5, Math.min(this.failureCount, 5)));
        log(`Agent crashed or terminated. Watchdog restarting in ${(backoff / 1000).toFixed(1)}s (Incident #${this.failureCount})...`);

        setTimeout(() => {
          if (this.shouldRun) {
            this.spawnAgent();
          }
        }, backoff);
      }
    });
  }

  private checkAgentHealth(): void {
    if (!this.shouldRun) return;

    if (!this.agentProcess || !this.agentProcess.pid) {
      log('Agent process is not running! Triggering immediate resurrection...');
      this.spawnAgent();
      return;
    }

    // Process is alive
    try {
      // In Node.js on Windows, sending signal 0 checks if PID exists
      process.kill(this.agentProcess.pid, 0);
    } catch {
      log(`Agent PID ${this.agentProcess.pid} died without exit event. Restarting...`);
      this.agentProcess = null;
      this.spawnAgent();
    }
  }

  public stop(): void {
    log('Stopping Watchdog supervisor cleanly...');
    this.shouldRun = false;
    if (this.agentProcess && this.agentProcess.pid) {
      try {
        process.kill(this.agentProcess.pid, 'SIGTERM');
      } catch {}
    }
    try {
      if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile);
    } catch {}
    process.exit(0);
  }
}

// If run directly: node dist/client/watchdog.js
if (process.argv[1]?.includes('watchdog')) {
  const watchdog = new WindowsAgentWatchdog();
  watchdog.start();
}
