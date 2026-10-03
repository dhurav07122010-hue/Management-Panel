import { WebSocket } from 'ws';
import os from 'node:os';
import { AgentConfigManager, type LocalAgentConfig } from './config-manager.js';
import { processManager } from '../services/process.service.js';
import { StatsService } from '../services/stats.service.js';
import { FileService } from '../services/file.service.js';
import { ModService } from '../services/mod.service.js';
import type {
  AgentConnectionState,
  AgentCapabilities,
  AgentAuthMessage,
  AgentHeartbeatPayload,
  AgentStateSyncPayload,
  AgentCommand,
  AgentCommandAck,
  AgentCommandResponse,
  ConsoleLine,
  ServerState,
  PlayerInfo
} from '@mc-panel/types';

export class OutboundAgentClient {
  private config: LocalAgentConfig;
  private ws: WebSocket | null = null;
  private state: AgentConnectionState = 'DISCONNECTED';
  private reconnectAttempts = 0;
  private shouldRun = false;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private metricsTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private lastConnectedAt: number | null = null;
  private lastHeartbeatAt: number | null = null;
  private lastMessageAt: number | null = null;
  private lastPingSentAt: number | null = null;
  private latencyMs: number | null = null;
  private disconnectReason: string | null = null;

  private capabilities: AgentCapabilities = {
    minecraft: true,
    files: true,
    mods: true,
    console: true,
    systemStats: true,
    serverControl: true
  };

  constructor(config: LocalAgentConfig) {
    this.config = config;
  }

  public getState(): AgentConnectionState {
    return this.state;
  }

  public getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  public getSnapshot(): import('@mc-panel/types').AgentConnectionSnapshot {
    return {
      currentState: this.state,
      lastConnectedAt: this.lastConnectedAt ? new Date(this.lastConnectedAt).toISOString() : null,
      lastHeartbeatAt: this.lastHeartbeatAt ? new Date(this.lastHeartbeatAt).toISOString() : null,
      lastMessageAt: this.lastMessageAt ? new Date(this.lastMessageAt).toISOString() : null,
      reconnectAttempts: this.reconnectAttempts,
      disconnectReason: this.disconnectReason,
      latencyMs: this.latencyMs,
      agentVersion: this.config.version || '1.0.0'
    };
  }

  public start(): void {
    if (this.shouldRun) return;
    this.shouldRun = true;
    console.log(`[OutboundAgent] Starting persistent outbound client for agent ${this.config.agentId} (${this.config.agentName})...`);

    // Wire up local processManager listeners to forward console and status to cloud backend over persistent WSS
    processManager.registerListeners({
      onConsole: (line: ConsoleLine) => {
        this.sendEvent('server.console', line);
      },
      onStatus: (st: ServerState) => {
        this.sendEvent('server.status', { state: st, uptime: processManager.getUptimeSeconds() });
      },
      onPlayer: (players: PlayerInfo[]) => {
        this.sendEvent('server.players', players);
      },
      onCrash: (info) => {
        this.sendEvent('server.crashed', info);
      }
    });

    this.connect();
  }

  public stop(): void {
    this.shouldRun = false;
    this.state = 'STOPPING';
    this.cleanupTimers();
    if (this.ws) {
      try {
        this.ws.close(1000, 'Agent client stopped');
      } catch {}
      this.ws = null;
    }
    this.state = 'DISCONNECTED';
    console.log('[OutboundAgent] Agent client stopped cleanly.');
  }

  private cleanupTimers(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      this.metricsTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private getWebSocketUrl(): string {
    const rawUrl = this.config.backendUrl.trim().replace(/\/$/, '');
    const wsProto = rawUrl.startsWith('https://') ? 'wss:' : 'ws:';
    const cleanHost = rawUrl.replace(/^https?:\/\//, '');
    return `${wsProto}//${cleanHost}/ws?role=agent&agentId=${encodeURIComponent(this.config.agentId)}&token=${encodeURIComponent(this.config.token)}`;
  }

  private connect(): void {
    if (!this.shouldRun) return;

    this.cleanupTimers();
    this.state = this.reconnectAttempts > 0 ? 'RECONNECTING' : 'CONNECTING';

    const wsUrl = this.getWebSocketUrl();
    console.log(`[OutboundAgent] Connecting to ${wsUrl} (Attempt ${this.reconnectAttempts + 1})...`);

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.on('open', () => {
        this.handleOpen();
      });

      this.ws.on('message', (data: Buffer | string) => {
        this.handleMessage(data);
      });

      this.ws.on('close', (code, reason) => {
        this.handleClose(code, reason.toString());
      });

      this.ws.on('error', (err) => {
        this.handleError(err);
      });

      this.ws.on('pong', () => {
        this.lastMessageAt = Date.now();
      });
    } catch (err) {
      this.handleError(err instanceof Error ? err : new Error(String(err)));
    }
  }

  private handleOpen(): void {
    console.log('[OutboundAgent] Socket connected! Authenticating with cloud backend...');
    this.state = 'AUTHENTICATING';
    this.lastConnectedAt = Date.now();
    this.disconnectReason = null;
    this.reconnectAttempts = 0;

    // Send agent.auth message
    const authPayload: AgentAuthMessage = {
      protocolVersion: 1,
      agentId: this.config.agentId,
      installationId: this.config.installationId,
      token: this.config.token,
      name: this.config.agentName,
      version: this.config.version,
      capabilities: this.capabilities,
      systemInfo: {
        os: os.type(),
        platform: os.platform(),
        arch: os.arch(),
        hostname: os.hostname(),
        nodeVersion: process.version,
        uptimeSeconds: Math.floor(os.uptime())
      }
    };

    this.sendRaw('agent.auth', authPayload);

    // Send immediate state sync
    const syncPayload: AgentStateSyncPayload = {
      protocolVersion: 1,
      agentId: this.config.agentId,
      minecraft: {
        status: processManager.getState(),
        pid: processManager.getPid(),
        uptime: processManager.getUptimeSeconds()
      },
      system: {
        cpu: 0,
        ram: 0
      },
      capabilities: this.capabilities
    };
    this.sendRaw('agent.state_sync', syncPayload);

    this.state = 'CONNECTED';
    console.log('============================================================');
    console.log(`   AGENT ONLINE & PERSISTENTLY CONNECTED!`);
    console.log(`   Agent ID:    ${this.config.agentId}`);
    console.log(`   Agent Name:  ${this.config.agentName}`);
    console.log('============================================================');

    this.startHeartbeatAndMetrics();
  }

  private handleMessage(data: Buffer | string): void {
    this.lastMessageAt = Date.now();
    try {
      const parsed = JSON.parse(data.toString()) as { type: string; payload: unknown };

      if (parsed.type === 'agent.command') {
        const cmd = parsed.payload as AgentCommand;
        this.executeCommand(cmd);
      } else if (parsed.type === 'agent.pong' || parsed.type === 'heartbeat_ack') {
        this.lastHeartbeatAt = Date.now();
        if (this.lastPingSentAt) {
          this.latencyMs = Math.max(1, Date.now() - this.lastPingSentAt);
        }
        if (this.state === 'DEGRADED') {
          this.state = 'CONNECTED';
        }
      }
    } catch {
      // ignore
    }
  }

  private handleClose(code: number, reason: string): void {
    this.disconnectReason = reason ? `${reason} (code: ${code})` : `Socket closed (code: ${code})`;
    console.warn(`[OutboundAgent] Connection closed: ${this.disconnectReason}`);
    this.ws = null;
    this.cleanupTimers();

    if (code === 4003) {
      console.error('[OutboundAgent] Fatal: Agent authentication rejected by backend.');
      this.state = 'ERROR';
      return;
    }

    if (this.shouldRun) {
      this.scheduleReconnect();
    } else {
      this.state = 'DISCONNECTED';
    }
  }

  private handleError(err: unknown): void {
    const msg = err instanceof Error ? err.message : String(err);
    this.disconnectReason = `Network error: ${msg}`;
    console.warn(`[OutboundAgent] ${this.disconnectReason}`);
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    if (this.shouldRun) {
      this.scheduleReconnect();
    }
  }

  /**
   * Exponential backoff with jitter:
   * attempt 1: 1s, attempt 2: 2s, attempt 3: 4s, attempt 4: 8s, attempt 5: 15s, attempt 6+: 30s
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.state = 'RECONNECTING';
    this.reconnectAttempts++;

    const delays = [1000, 2000, 4000, 8000, 15000, 30000];
    const baseDelay = delays[Math.min(this.reconnectAttempts - 1, delays.length - 1)];
    const jitter = Math.floor(Math.random() * 500);
    const delay = baseDelay + jitter;

    console.log(`[OutboundAgent] Reconnecting in ${(delay / 1000).toFixed(1)}s (Attempt ${this.reconnectAttempts})...`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.shouldRun) {
        this.connect();
      }
    }, delay);
  }

  private startHeartbeatAndMetrics(): void {
    // Bidirectional Heartbeat every 12 seconds
    this.heartbeatTimer = setInterval(async () => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      try {
        // If last heartbeat acknowledgment is older than 25 seconds, mark state as DEGRADED
        if (this.lastHeartbeatAt && (Date.now() - this.lastHeartbeatAt) > 25000) {
          if (this.state === 'CONNECTED') {
            console.warn('[OutboundAgent] Heartbeat acknowledgment delayed. Transitioning state to DEGRADED.');
            this.state = 'DEGRADED';
          }
        }

        this.lastPingSentAt = Date.now();
        const stats = await StatsService.getMetrics(processManager.getPid(), processManager.getUptimeSeconds());
        const hb: AgentHeartbeatPayload = {
          agentId: this.config.agentId,
          installationId: this.config.installationId,
          timestamp: new Date().toISOString(),
          status: this.state === 'DEGRADED' ? 'degraded' : 'healthy',
          metrics: {
            cpuPercent: stats.systemCpuPercent,
            memoryUsedMb: stats.systemMemoryUsedMb,
            memoryTotalMb: stats.systemMemoryTotalMb,
            diskUsedPercent: stats.diskUsedPercent
          },
          minecraftState: processManager.getState()
        };
        this.sendRaw('agent.heartbeat', hb);
      } catch {}
    }, 12000);

    // Full Metrics interval every 6 seconds
    this.metricsTimer = setInterval(async () => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      try {
        const stats = await StatsService.getMetrics(processManager.getPid(), processManager.getUptimeSeconds());
        this.sendEvent('server.stats', stats);
      } catch {}
    }, 6000);
  }

  /**
   * Dispatches and handles commands with ACKs and structured result responses.
   */
  private async executeCommand(cmd: AgentCommand): Promise<void> {
    console.log(`[OutboundAgent] Received command ${cmd.id} (${cmd.type})`);

    // 1. COMMAND_RECEIVED ACK
    this.sendCommandAck(cmd.id, 'COMMAND_RECEIVED');

    // 2. COMMAND_STARTED ACK
    this.sendCommandAck(cmd.id, 'COMMAND_STARTED');

    try {
      let result: unknown = null;

      switch (cmd.type) {
        case 'minecraft.start': {
          const currentState = processManager.getState();
          if (currentState === 'ONLINE') {
            result = { status: 'already_running', message: 'Minecraft server is already running' };
          } else {
            await processManager.startServer('remote-control');
            result = { status: 'starting', message: 'Minecraft server starting' };
          }
          break;
        }

        case 'minecraft.stop': {
          const currentState = processManager.getState();
          if (currentState === 'OFFLINE') {
            result = { status: 'already_stopped', message: 'Minecraft server is already stopped' };
          } else {
            await processManager.stopServer('remote-control');
            result = { status: 'stopping', message: 'Minecraft server stopping' };
          }
          break;
        }

        case 'minecraft.restart': {
          await processManager.restartServer('remote-control');
          result = { status: 'restarting', message: 'Minecraft server restarting' };
          break;
        }

        case 'minecraft.kill': {
          processManager.killServer('remote-control');
          result = { status: 'killed', message: 'Minecraft server process terminated' };
          break;
        }

        case 'minecraft.command': {
          const payload = cmd.payload as { command: string };
          const sent = processManager.sendCommand(payload.command, 'remote-control');
          result = { sent, command: payload.command };
          break;
        }

        case 'files.list': {
          const payload = cmd.payload as { path?: string };
          const files = FileService.listFiles(payload?.path || '');
          result = { files };
          break;
        }

        case 'mods.list': {
          const mods = ModService.listInstalledMods();
          result = { mods };
          break;
        }

        case 'diagnostics.ping': {
          result = { pong: true, time: Date.now() };
          break;
        }

        default:
          throw new Error(`Unsupported command type: ${cmd.type}`);
      }

      // 3. COMMAND_COMPLETED ACK & Response
      this.sendCommandAck(cmd.id, 'COMMAND_COMPLETED');
      this.sendCommandResponse({
        id: cmd.id,
        success: true,
        timestamp: new Date().toISOString(),
        result
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn(`[OutboundAgent] Command ${cmd.id} failed:`, errMsg);
      this.sendCommandAck(cmd.id, 'COMMAND_FAILED', errMsg);
      this.sendCommandResponse({
        id: cmd.id,
        success: false,
        timestamp: new Date().toISOString(),
        error: {
          code: 'EXECUTION_FAILED',
          message: errMsg
        }
      });
    }
  }

  private sendCommandAck(id: string, status: AgentCommandAck['status'], error?: string): void {
    const ack: AgentCommandAck = {
      id,
      status,
      timestamp: new Date().toISOString(),
      error
    };
    this.sendRaw('agent.command_ack', ack);
  }

  private sendCommandResponse(res: AgentCommandResponse): void {
    this.sendRaw('agent.command_response', res);
  }

  private sendEvent(type: string, payload: unknown): void {
    this.sendRaw(type, payload);
  }

  private sendRaw(type: string, payload: unknown): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.send(JSON.stringify({ type, payload }));
    } catch (err) {
      console.warn('[OutboundAgent] Send error:', err);
    }
  }
}
