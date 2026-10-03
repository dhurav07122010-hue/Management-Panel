import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import cron from 'node-cron';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/environment.js';
import { SettingsRepository, AuditLogRepository } from '../database/repositories.js';
import { ServerConfigService } from './server-config.service.js';
import { StatsService } from './stats.service.js';
import type { ServerState, ConsoleLine, PlayerInfo, ServerHealthSummary, LogLevel } from '@mc-panel/types';

export class ProcessService {
  private state: ServerState = 'OFFLINE';
  private process: ChildProcess | null = null;
  private pid: number | null = null;
  private startTime: number | null = null;
  private intentionalStop = false;
  private restartAttempts = 0;
  private lastRestartWindow = Date.now();

  private consoleBuffer: ConsoleLine[] = [];
  private maxBufferLines = 1000;
  private onlinePlayers = new Map<string, PlayerInfo>();
  private maxPlayers = 20;

  private detectedMinecraftVersion?: string;
  private detectedFabricVersion?: string;
  private currentTps: number = 20.0;
  private scheduledRestartTask: cron.ScheduledTask | null = null;

  private onConsoleCallback?: (line: ConsoleLine) => void;
  private onStatusCallback?: (state: ServerState) => void;
  private onPlayerCallback?: (players: PlayerInfo[]) => void;
  private onCrashCallback?: (info: { exitCode: number | null; reason?: string }) => void;

  private mockInterval?: NodeJS.Timeout;

  constructor() {
    // If mock mode is configured, initialize mock initial state
    if (config.mockMode) {
      this.initMockMode();
    }
    this.initScheduledRestart();
  }

  public getState(): ServerState {
    return this.state;
  }

  public getPid(): number | null {
    return this.pid;
  }

  public getUptimeSeconds(): number {
    if (this.state !== 'ONLINE' || !this.startTime) return 0;
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  public getConsoleBuffer(limit = 200): ConsoleLine[] {
    return this.consoleBuffer.slice(-limit);
  }

  public clearConsoleBuffer(): void {
    this.consoleBuffer = [];
  }

  public getPlayers(): PlayerInfo[] {
    return Array.from(this.onlinePlayers.values());
  }

  public registerListeners(callbacks: {
    onConsole?: (line: ConsoleLine) => void;
    onStatus?: (state: ServerState) => void;
    onPlayer?: (players: PlayerInfo[]) => void;
    onCrash?: (info: { exitCode: number | null; reason?: string }) => void;
  }): void {
    if (callbacks.onConsole) this.onConsoleCallback = callbacks.onConsole;
    if (callbacks.onStatus) this.onStatusCallback = callbacks.onStatus;
    if (callbacks.onPlayer) this.onPlayerCallback = callbacks.onPlayer;
    if (callbacks.onCrash) this.onCrashCallback = callbacks.onCrash;
  }

  private setState(newState: ServerState): void {
    this.state = newState;
    if (this.onStatusCallback) {
      this.onStatusCallback(newState);
    }
  }

  private appendConsole(raw: string, level: LogLevel = 'INFO'): void {
    const clean = raw.replace(/\x1b\[[0-9;]*m/g, '').trim();
    if (!clean) return;

    // Detect level from text if default
    let detectedLevel = level;
    if (clean.includes('/WARN') || clean.includes('[WARN]')) {
      detectedLevel = 'WARN';
    } else if (clean.includes('/ERROR') || clean.includes('[ERROR]') || clean.includes('Exception:')) {
      detectedLevel = 'ERROR';
    }

    const line: ConsoleLine = {
      id: uuidv4(),
      timestamp: new Date().toLocaleTimeString(),
      level: detectedLevel,
      raw,
      clean
    };

    this.consoleBuffer.push(line);
    if (this.consoleBuffer.length > this.maxBufferLines) {
      this.consoleBuffer.shift();
    }

    if (this.onConsoleCallback) {
      this.onConsoleCallback(line);
    }

    // Inspect line for player events
    this.inspectLineForPlayerEvents(clean);

    // Inspect line for startup readiness
    if (this.state === 'STARTING') {
      if (clean.includes('Done (') || clean.includes('Done!') || clean.includes('For help, type "help"')) {
        this.setState('ONLINE');
        this.startTime = Date.now();
        this.appendConsole('[Panel] Minecraft server reported ready and online!', 'INFO');
      }
    }
  }

  private inspectLineForPlayerEvents(text: string): void {
    // Regex for player join: "<player> joined the game"
    const joinMatch = text.match(/:\s*([a-zA-Z0-9_]{3,16})\s+joined the game/);
    if (joinMatch) {
      const username = joinMatch[1];
      this.onlinePlayers.set(username, {
        username,
        isOnline: true,
        isOp: false,
        isWhitelisted: true,
        lastSeen: new Date().toISOString()
      });
      if (this.onPlayerCallback) {
        this.onPlayerCallback(this.getPlayers());
      }
      return;
    }

    // Regex for player leave: "<player> left the game"
    const leaveMatch = text.match(/:\s*([a-zA-Z0-9_]{3,16})\s+left the game/);
    if (leaveMatch) {
      const username = leaveMatch[1];
      this.onlinePlayers.delete(username);
      if (this.onPlayerCallback) {
        this.onPlayerCallback(this.getPlayers());
      }
      return;
    }

    // Inspect for Minecraft version
    const mcMatch = text.match(/(?:Loading Minecraft|Starting minecraft server version)\s+([0-9.]+)/i);
    if (mcMatch) {
      this.detectedMinecraftVersion = mcMatch[1];
    }

    // Inspect for Fabric Loader
    const fabricMatch = text.match(/Fabric Loader\s+([0-9.]+)/i);
    if (fabricMatch) {
      this.detectedFabricVersion = fabricMatch[1];
    }

    // Inspect for TPS
    const tpsMatch = text.match(/TPS from last.*:\s*([0-9.]+)/i);
    if (tpsMatch) {
      this.currentTps = parseFloat(tpsMatch[1]);
    }
  }

  /**
   * Starts the Minecraft server process.
   */
  public async startServer(username = 'admin'): Promise<void> {
    if (this.state === 'ONLINE' || this.state === 'STARTING') {
      throw new Error('Server is already running or starting.');
    }

    if (config.mockMode) {
      return this.startMockServer(username);
    }

    const cfg = ServerConfigService.readConfig();
    const serverDir = cfg.serverDirectory || SettingsRepository.get('serverDirectory') || config.serverDir;

    if (!fs.existsSync(serverDir)) {
      fs.mkdirSync(serverDir, { recursive: true });
    }

    // Ensure eula.txt is agreed or exists
    const eulaPath = path.resolve(serverDir, 'eula.txt');
    if (!fs.existsSync(eulaPath)) {
      fs.writeFileSync(eulaPath, '# Generated by Minecraft Panel\neula=true\n', 'utf-8');
    }

    const { executable, args } = ServerConfigService.parseStartCommand(cfg.startCommand);

    // Verify JAR file if '-jar' is in args
    const jarIndex = args.indexOf('-jar');
    if (jarIndex !== -1 && args[jarIndex + 1]) {
      const jarTarget = args[jarIndex + 1];
      const jarFullPath = path.isAbsolute(jarTarget) ? jarTarget : path.resolve(serverDir, jarTarget);
      if (!fs.existsSync(jarFullPath)) {
        const files = fs.existsSync(serverDir) ? fs.readdirSync(serverDir) : [];
        const availableJars = files.filter(f => f.endsWith('.jar'));
        const jarMsg = availableJars.length > 0
          ? ` Available JARs in directory: ${availableJars.join(', ')}`
          : ` No .jar files found in ${serverDir}. Place your fabric-server-launch.jar there or update server-config.json.`;
        throw new Error(`Server JAR "${jarTarget}" not found at: ${jarFullPath}.${jarMsg}`);
      }
    }

    this.intentionalStop = false;
    this.setState('STARTING');
    this.appendConsole(`[Panel] Starting Minecraft server in: ${serverDir}`, 'INFO');
    this.appendConsole(`[Panel] Command: ${executable} ${args.join(' ')}`, 'INFO');

    try {
      this.process = spawn(executable, args, {
        cwd: serverDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false
      });

      this.pid = this.process.pid ?? null;
      AuditLogRepository.create(username, 'SERVER_START', `Server started with PID: ${this.pid}`);

      this.process.stdout?.on('data', (data: Buffer) => {
        const text = data.toString('utf-8');
        const lines = text.split(/\r?\n/);
        for (const line of lines) {
          if (line) this.appendConsole(line, 'INFO');
        }
      });

      this.process.stderr?.on('data', (data: Buffer) => {
        const text = data.toString('utf-8');
        const lines = text.split(/\r?\n/);
        for (const line of lines) {
          if (line) this.appendConsole(line, 'ERROR');
        }
      });

      this.process.on('error', (err) => {
        this.appendConsole(`[Panel] Process error: ${err.message}`, 'ERROR');
        this.handleProcessExit(1, 'Failed to launch process: ' + err.message);
      });

      this.process.on('exit', (code, signal) => {
        this.handleProcessExit(code, signal ? `Killed with signal ${signal}` : undefined);
      });
    } catch (error) {
      this.setState('OFFLINE');
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to start Java process: ${msg}`);
    }
  }

  private handleProcessExit(exitCode: number | null, reason?: string): void {
    const wasRunning = this.state === 'ONLINE' || this.state === 'STARTING';
    const isCrash = !this.intentionalStop && exitCode !== 0 && wasRunning;

    this.pid = null;
    this.process = null;
    this.startTime = null;
    this.onlinePlayers.clear();

    if (this.onPlayerCallback) {
      this.onPlayerCallback([]);
    }

    if (isCrash) {
      this.setState('CRASHED');
      this.appendConsole(`[Panel] SERVER CRASHED! Exit code: ${exitCode}. ${reason || ''}`, 'ERROR');
      AuditLogRepository.create('system', 'SERVER_CRASH', `Exit code: ${exitCode}`);

      if (this.onCrashCallback) {
        this.onCrashCallback({ exitCode, reason });
      }

      this.checkAutoRestart();
    } else {
      this.setState('OFFLINE');
      this.appendConsole(`[Panel] Server stopped cleanly. Exit code: ${exitCode ?? 0}`, 'INFO');
      AuditLogRepository.create('system', 'SERVER_STOP', `Clean shutdown with code ${exitCode ?? 0}`);
    }
  }

  private checkAutoRestart(): void {
    const autoRestart = SettingsRepository.get('autoRestartOnCrash') === 'true' || config.autoRestartOnCrash;
    const maxAttempts = parseInt(SettingsRepository.get('maxRestartAttempts') || String(config.maxRestartAttempts), 10);
    const delaySeconds = parseInt(SettingsRepository.get('restartDelaySeconds') || String(config.restartDelaySeconds), 10);

    if (!autoRestart) return;

    const now = Date.now();
    if (now - this.lastRestartWindow > 5 * 60 * 1000) {
      this.restartAttempts = 0;
      this.lastRestartWindow = now;
    }

    if (this.restartAttempts >= maxAttempts) {
      this.appendConsole(`[Panel] Maximum restart attempts (${maxAttempts}) reached. Auto-restart aborted to prevent infinite loop.`, 'WARN');
      return;
    }

    this.restartAttempts += 1;
    this.appendConsole(`[Panel] Auto-restart enabled. Restarting in ${delaySeconds} seconds (Attempt ${this.restartAttempts}/${maxAttempts})...`, 'WARN');

    setTimeout(() => {
      if (this.state === 'CRASHED' || this.state === 'OFFLINE') {
        this.startServer('system-auto-restart').catch((err) => {
          this.appendConsole(`[Panel] Auto-restart failed: ${err.message}`, 'ERROR');
        });
      }
    }, delaySeconds * 1000);
  }

  /**
   * Gracefully stops the server.
   */
  public async stopServer(username = 'admin', timeoutSeconds = 25): Promise<void> {
    if (this.state === 'OFFLINE') {
      throw new Error('Server is already offline.');
    }

    if (config.mockMode) {
      return this.stopMockServer(username);
    }

    this.intentionalStop = true;
    this.setState('STOPPING');
    this.appendConsole('[Panel] Sending graceful stop command to Minecraft server...', 'INFO');
    AuditLogRepository.create(username, 'SERVER_STOP_INITIATED', 'Graceful shutdown requested');

    // Send stop command to stdin
    this.sendCommand('stop');

    // Wait for shutdown or force kill after timeout
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (!this.process || this.state === 'OFFLINE') {
          clearInterval(checkInterval);
          clearTimeout(forceKillTimer);
          resolve();
        }
      }, 500);

      const forceKillTimer = setTimeout(() => {
        clearInterval(checkInterval);
        if (this.process && this.state === 'STOPPING') {
          this.appendConsole('[Panel] Server did not stop gracefully within timeout. Forcing termination...', 'WARN');
          this.killServer(username);
        }
        resolve();
      }, timeoutSeconds * 1000);
    });
  }

  /**
   * Forcefully kills the Minecraft server.
   */
  public killServer(username = 'admin'): void {
    if (config.mockMode) {
      this.stopMockServer(username);
      return;
    }

    this.intentionalStop = true;
    this.appendConsole('[Panel] Force killing Minecraft process...', 'WARN');
    AuditLogRepository.create(username, 'SERVER_KILL', `Server forcefully killed (PID: ${this.pid})`);

    if (this.process) {
      try {
        if (process.platform === 'win32' && this.pid) {
          spawn('taskkill', ['/pid', this.pid.toString(), '/T', '/F']);
        } else {
          this.process.kill('SIGKILL');
        }
      } catch (e) {
        console.error('Error killing process:', e);
      }
    }

    this.pid = null;
    this.process = null;
    this.setState('OFFLINE');
    this.startTime = null;
  }

  /**
   * Restarts the Minecraft server gracefully.
   */
  public async restartServer(username = 'admin'): Promise<void> {
    AuditLogRepository.create(username, 'SERVER_RESTART', 'Server restart initiated');
    if (this.state === 'ONLINE' || this.state === 'STARTING') {
      await this.stopServer(username);
      await new Promise((r) => setTimeout(r, 2000));
    }
    await this.startServer(username);
  }

  /**
   * Sends a console command to Minecraft stdin.
   */
  public sendCommand(command: string, username = 'console'): boolean {
    const cleanCmd = command.startsWith('/') ? command.substring(1) : command;
    this.appendConsole(`> ${cleanCmd}`, 'INFO');
    AuditLogRepository.create(username, 'SERVER_COMMAND', cleanCmd);

    if (config.mockMode) {
      this.handleMockCommand(cleanCmd);
      return true;
    }

    if (!this.process || !this.process.stdin || this.state !== 'ONLINE') {
      this.appendConsole('[Panel] Cannot send command: Server is not running.', 'WARN');
      return false;
    }

    try {
      this.process.stdin.write(cleanCmd + '\n');
      return true;
    } catch (err) {
      this.appendConsole(`[Panel] Failed to write to stdin: ${err}`, 'ERROR');
      return false;
    }
  }

  public async getHealthSummary(): Promise<ServerHealthSummary> {
    const cfg = ServerConfigService.readConfig();
    const stats = await StatsService.getMetrics(this.pid, this.getUptimeSeconds(), config.mockMode && this.state === 'ONLINE');
    return {
      state: this.state,
      pid: this.pid,
      uptimeSeconds: this.getUptimeSeconds(),
      playerCount: this.onlinePlayers.size,
      maxPlayers: this.maxPlayers,
      fabricDetected: this.isFabricDetected(),
      geyserDetected: this.isGeyserDetected(),
      floodgateDetected: this.isFloodgateDetected(),
      minecraftVersion: this.detectedMinecraftVersion || cfg.minecraftVersion || '1.21.1',
      fabricVersion: this.detectedFabricVersion || cfg.fabricVersion || '0.16.5',
      tps: this.currentTps,
      startCommand: cfg.startCommand,
      stats
    };
  }

  public initScheduledRestart(): void {
    if (this.scheduledRestartTask) {
      this.scheduledRestartTask.stop();
      this.scheduledRestartTask = null;
    }

    const cfg = ServerConfigService.readConfig();
    if (!cfg.scheduledRestartEnabled) return;

    const cronExpr = cfg.scheduledRestartCron || '0 4 * * *';
    if (!cron.validate(cronExpr)) {
      console.warn(`[ProcessService] Invalid scheduled restart cron expression: "${cronExpr}"`);
      return;
    }

    this.scheduledRestartTask = cron.schedule(cronExpr, async () => {
      if (this.state === 'ONLINE') {
        this.appendConsole('[Panel] Triggering scheduled server restart...', 'WARN');
        this.sendCommand('say [Server] Scheduled server restart in 60 seconds! Please find safety.');
        await new Promise((r) => setTimeout(r, 60000));
        await this.restartServer('system-scheduled-restart');
      }
    });

    console.log(`[ProcessService] Scheduled server restart active: "${cronExpr}"`);
  }

  public checkAutoStart(): void {
    const cfg = ServerConfigService.readConfig();
    if (cfg.autoStart && this.state === 'OFFLINE') {
      console.log('[ProcessService] Server auto-start is enabled. Launching Minecraft server...');
      setTimeout(() => {
        this.startServer('system-auto-start').catch((err) => {
          console.error('[ProcessService] Auto-start failed:', err.message);
        });
      }, 3000);
    }
  }

  private isFabricDetected(): boolean {
    const cfg = ServerConfigService.readConfig();
    const serverDir = cfg.serverDirectory || SettingsRepository.get('serverDirectory') || config.serverDir;
    const serverJar = SettingsRepository.get('serverJar') || config.serverJar;
    return serverJar.toLowerCase().includes('fabric') || fs.existsSync(path.resolve(serverDir, '.fabric'));
  }

  private isGeyserDetected(): boolean {
    const serverDir = SettingsRepository.get('serverDirectory') || config.serverDir;
    const modsDir = path.resolve(serverDir, 'mods');
    if (!fs.existsSync(modsDir)) return false;
    try {
      return fs.readdirSync(modsDir).some((f) => f.toLowerCase().includes('geyser') && f.endsWith('.jar'));
    } catch {
      return false;
    }
  }

  private isFloodgateDetected(): boolean {
    const serverDir = SettingsRepository.get('serverDirectory') || config.serverDir;
    const modsDir = path.resolve(serverDir, 'mods');
    if (!fs.existsSync(modsDir)) return false;
    try {
      return fs.readdirSync(modsDir).some((f) => f.toLowerCase().includes('floodgate') && f.endsWith('.jar'));
    } catch {
      return false;
    }
  }

  /**
   * Scans common Windows and environment locations for Java installations.
   */
  public static detectJavaInstallations(): string[] {
    const foundPaths = new Set<string>();

    // 1. Check current PATH
    foundPaths.add('java');

    // 2. Check standard Windows Program Files directories
    const potentialBases = [
      'C:\\Program Files\\Java',
      'C:\\Program Files (x86)\\Java',
      'C:\\Program Files\\Eclipse Adoptium',
      'C:\\Program Files\\BellSoft',
      'C:\\Program Files\\Microsoft\\jdk',
      'C:\\Program Files\\Amazon Corretto',
      'C:\\Program Files\\Zulu'
    ];

    for (const base of potentialBases) {
      if (fs.existsSync(base)) {
        try {
          const entries = fs.readdirSync(base);
          for (const entry of entries) {
            const javaExe = path.join(base, entry, 'bin', 'java.exe');
            if (fs.existsSync(javaExe)) {
              foundPaths.add(javaExe);
            }
          }
        } catch {
          // ignore permission errors
        }
      }
    }

    // 3. Check JAVA_HOME
    if (process.env.JAVA_HOME) {
      const javaHomeExe = path.join(process.env.JAVA_HOME, 'bin', 'java.exe');
      if (fs.existsSync(javaHomeExe)) {
        foundPaths.add(javaHomeExe);
      }
    }

    return Array.from(foundPaths);
  }

  // --- MOCK MODE LOGIC (Section 60) ---
  private initMockMode(): void {
    this.appendConsole('[Panel] Initializing in MOCK MODE for development and testing.', 'INFO');
  }

  private async startMockServer(username: string): Promise<void> {
    this.setState('STARTING');
    this.pid = 99999;
    this.appendConsole('[Panel] [Mock] Launching simulated Fabric 1.21.1 server...', 'INFO');
    AuditLogRepository.create(username, 'SERVER_START', 'Simulated server started in Mock Mode');

    setTimeout(() => {
      this.appendConsole('[00:00:01] [main/INFO]: Loading Minecraft 1.21.1 with Fabric Loader 0.16.5', 'INFO');
      this.appendConsole('[00:00:02] [main/INFO]: Loading 18 mods: fabric-api, lithium, sodium, geyser-fabric, floodgate', 'INFO');
    }, 500);

    setTimeout(() => {
      this.appendConsole('[00:00:03] [Server thread/INFO]: Preparing start region for dimension minecraft:overworld', 'INFO');
      this.appendConsole('[00:00:04] [Server thread/INFO]: Done (4.120s)! For help, type "help"', 'INFO');
      this.setState('ONLINE');
      this.startTime = Date.now();

      // Add a couple of simulated online players
      this.onlinePlayers.set('Steve', {
        username: 'Steve',
        uuid: '069a79f4-44e9-4726-a5be-fca90e38aaf5',
        isOnline: true,
        isOp: true,
        isWhitelisted: true,
        lastSeen: new Date().toISOString()
      });
      this.onlinePlayers.set('Alex', {
        username: 'Alex',
        uuid: '550e8400-e29b-41d4-a716-446655440000',
        isOnline: true,
        isOp: false,
        isWhitelisted: true,
        lastSeen: new Date().toISOString()
      });

      if (this.onPlayerCallback) {
        this.onPlayerCallback(this.getPlayers());
      }
    }, 1500);
  }

  private stopMockServer(username: string): void {
    this.setState('STOPPING');
    this.appendConsole('[00:00:05] [Server thread/INFO]: Stopping server', 'INFO');
    this.appendConsole('[00:00:06] [Server thread/INFO]: Saving players & worlds...', 'INFO');
    AuditLogRepository.create(username, 'SERVER_STOP', 'Simulated server stopped in Mock Mode');

    setTimeout(() => {
      this.pid = null;
      this.startTime = null;
      this.onlinePlayers.clear();
      this.setState('OFFLINE');
      this.appendConsole('[Panel] Server stopped cleanly.', 'INFO');
      if (this.onPlayerCallback) {
        this.onPlayerCallback([]);
      }
    }, 1000);
  }

  private handleMockCommand(cmd: string): void {
    const parts = cmd.trim().split(' ');
    const root = parts[0].toLowerCase();

    if (root === 'say') {
      const msg = parts.slice(1).join(' ');
      this.appendConsole(`[Server thread/INFO]: [Server] ${msg}`, 'INFO');
    } else if (root === 'list') {
      const names = Array.from(this.onlinePlayers.keys()).join(', ');
      this.appendConsole(`[Server thread/INFO]: There are ${this.onlinePlayers.size} of a max of ${this.maxPlayers} players online: ${names}`, 'INFO');
    } else if (root === 'op') {
      const user = parts[1];
      if (user) {
        const p = this.onlinePlayers.get(user);
        if (p) p.isOp = true;
        this.appendConsole(`[Server thread/INFO]: Made ${user} a server operator`, 'INFO');
        if (this.onPlayerCallback) this.onPlayerCallback(this.getPlayers());
      }
    } else if (root === 'deop') {
      const user = parts[1];
      if (user) {
        const p = this.onlinePlayers.get(user);
        if (p) p.isOp = false;
        this.appendConsole(`[Server thread/INFO]: Made ${user} no longer a server operator`, 'INFO');
        if (this.onPlayerCallback) this.onPlayerCallback(this.getPlayers());
      }
    } else if (root === 'kick') {
      const user = parts[1];
      if (user && this.onlinePlayers.has(user)) {
        this.onlinePlayers.delete(user);
        this.appendConsole(`[Server thread/INFO]: Kicked ${user}`, 'INFO');
        if (this.onPlayerCallback) this.onPlayerCallback(this.getPlayers());
      }
    } else {
      this.appendConsole(`[Server thread/INFO]: Unknown or incomplete command: ${cmd}`, 'INFO');
    }
  }
}

export const processManager = new ProcessService();
