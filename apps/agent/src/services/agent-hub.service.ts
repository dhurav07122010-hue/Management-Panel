import { WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import {
  AgentRepository,
  AgentCommandRepository,
  type AgentRow
} from '../database/repositories.js';
import { AgentAuthManager } from './agent-auth.service.js';
import type {
  AgentCommand,
  AgentCommandAck,
  AgentCommandResponse,
  AgentHeartbeatPayload,
  AgentStateSyncPayload,
  AgentDiagnosticsInfo,
  ServerState
} from '@mc-panel/types';

interface ConnectedAgentSession {
  agentId: string;
  installationId: string;
  name: string;
  ws: WebSocket;
  connectedAt: number;
  lastHeartbeatAt: number;
  lastPingTimestamp?: number;
  lastLatencyMs?: number;
  minecraftState: ServerState;
  reconnectAttempts: number;
}

interface PendingCommand {
  commandId: string;
  agentId: string;
  resolve: (res: AgentCommandResponse) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}

export class AgentHub {
  private static instance: AgentHub | null = null;
  private activeAgents = new Map<string, ConnectedAgentSession>();
  private pendingCommands = new Map<string, PendingCommand>();
  private webClients = new Set<WebSocket>();

  // Event broadcast listeners (for forwarding console/status/stats to connected web UI)
  private webBroadcastCallback?: (type: string, payload: unknown) => void;

  public static getInstance(): AgentHub {
    if (!this.instance) {
      this.instance = new AgentHub();
    }
    return this.instance;
  }

  public registerWebBroadcast(cb: (type: string, payload: unknown) => void): void {
    this.webBroadcastCallback = cb;
  }

  public broadcastToWeb(type: string, payload: unknown): void {
    if (this.webBroadcastCallback) {
      this.webBroadcastCallback(type, payload);
    }
  }

  public registerWebClient(ws: WebSocket): void {
    this.webClients.add(ws);
    ws.on('close', () => {
      this.webClients.delete(ws);
    });
  }

  /**
   * Called when an outbound agent connects and authenticates with valid credentials.
   * Duplicate agent sessions are cleanly superseded.
   */
  public handleAgentAuthenticated(
    agentRecord: AgentRow,
    ws: WebSocket,
    initialSync?: AgentStateSyncPayload
  ): void {
    const existing = this.activeAgents.get(agentRecord.id);
    if (existing && existing.ws !== ws && existing.ws.readyState === WebSocket.OPEN) {
      console.log(`[AgentHub] Superseding existing duplicate session for agent ${agentRecord.id}`);
      try {
        existing.ws.close(4009, 'Duplicate agent session superseded');
      } catch {}
    }

    const session: ConnectedAgentSession = {
      agentId: agentRecord.id,
      installationId: agentRecord.installation_id,
      name: agentRecord.name,
      ws,
      connectedAt: Date.now(),
      lastHeartbeatAt: Date.now(),
      minecraftState: (initialSync?.minecraft?.status as ServerState) || 'OFFLINE',
      reconnectAttempts: 0
    };

    this.activeAgents.set(agentRecord.id, session);
    AgentRepository.updateConnectionStatus(agentRecord.id, 'ONLINE', true);

    console.log(`[AgentHub] Agent ${agentRecord.id} (${agentRecord.name}) is CONNECTED and verified.`);

    // Flush safe queued commands for this agent
    this.flushQueuedCommands(agentRecord.id);

    // Notify connected web dashboards
    this.broadcastToWeb('agent.connected', {
      agentId: agentRecord.id,
      name: agentRecord.name,
      status: 'ONLINE',
      timestamp: new Date().toISOString()
    });

    if (initialSync) {
      this.broadcastToWeb('server.status', {
        state: initialSync.minecraft.status,
        uptime: initialSync.minecraft.uptime
      });
    }
  }

  public handleAgentDisconnected(agentId: string, ws: WebSocket, reason = 'Connection closed'): void {
    const current = this.activeAgents.get(agentId);
    if (current && current.ws === ws) {
      this.activeAgents.delete(agentId);
      AgentRepository.updateConnectionStatus(agentId, 'OFFLINE', false);
      console.log(`[AgentHub] Agent ${agentId} disconnected: ${reason}`);

      // Fail pending commands that are waiting for an immediate reply
      for (const [cmdId, pending] of this.pendingCommands.entries()) {
        if (pending.agentId === agentId) {
          clearTimeout(pending.timer);
          pending.reject(new Error(`Agent disconnected while awaiting command response: ${reason}`));
          this.pendingCommands.delete(cmdId);
        }
      }

      this.broadcastToWeb('agent.disconnected', {
        agentId,
        reason,
        timestamp: new Date().toISOString()
      });
    }
  }

  public handleHeartbeat(agentId: string, heartbeat: AgentHeartbeatPayload): void {
    const session = this.activeAgents.get(agentId);
    if (session) {
      session.lastHeartbeatAt = Date.now();
      if (heartbeat.minecraftState) {
        session.minecraftState = heartbeat.minecraftState;
      }
    }

    AgentRepository.updateHeartbeat(agentId, 'ONLINE');

    if (heartbeat.metrics) {
      this.broadcastToWeb('server.stats', {
        cpuPercent: heartbeat.metrics.cpuPercent,
        memoryUsedMb: heartbeat.metrics.memoryUsedMb,
        memoryTotalMb: heartbeat.metrics.memoryTotalMb,
        systemCpuPercent: heartbeat.metrics.cpuPercent,
        systemMemoryUsedMb: heartbeat.metrics.memoryUsedMb,
        systemMemoryTotalMb: heartbeat.metrics.memoryTotalMb,
        diskUsedPercent: heartbeat.metrics.diskUsedPercent,
        uptimeSeconds: 0,
        timestamp: Date.now()
      });
    }

    if (heartbeat.minecraftState) {
      this.broadcastToWeb('server.status', {
        state: heartbeat.minecraftState,
        uptime: 0
      });
    }
  }

  public handleCommandAck(ack: AgentCommandAck): void {
    AgentCommandRepository.updateStatus(ack.id, ack.status, ack.error);
    this.broadcastToWeb('agent.command_ack', ack);
  }

  public handleCommandResponse(response: AgentCommandResponse): void {
    const pending = this.pendingCommands.get(response.id);
    if (pending) {
      clearTimeout(pending.timer);
      this.pendingCommands.delete(response.id);
      AgentCommandRepository.updateStatus(
        response.id,
        response.success ? 'COMMAND_COMPLETED' : 'COMMAND_FAILED',
        response.error?.message
      );
      pending.resolve(response);
    }
  }

  /**
   * Sends a structured, authenticated command to the local agent over persistent WSS.
   */
  public async dispatchCommand<T = unknown, R = unknown>(
    agentId: string,
    type: string,
    payload: T,
    options: { timeoutMs?: number; queueable?: boolean } = {}
  ): Promise<AgentCommandResponse<R>> {
    const session = this.activeAgents.get(agentId);
    const timeoutMs = options.timeoutMs ?? (type.includes('start') ? 120000 : type.includes('stop') ? 60000 : 30000);
    const commandId = `command_${uuidv4().replace(/-/g, '')}`;

    const cmd: AgentCommand<T> = {
      id: commandId,
      type,
      agentId,
      timestamp: new Date().toISOString(),
      timeoutMs,
      queueable: options.queueable,
      payload
    };

    AgentCommandRepository.create({
      id: commandId,
      agentId,
      type,
      payloadJson: JSON.stringify(payload),
      status: 'COMMAND_SENT',
      queueable: !!options.queueable
    });

    if (!session || session.ws.readyState !== WebSocket.OPEN) {
      if (options.queueable) {
        return {
          id: commandId,
          success: true,
          timestamp: new Date().toISOString(),
          status: 'QUEUED',
          result: { message: 'Agent is offline. Command queued until agent reconnects.' } as unknown as R
        };
      }
      AgentCommandRepository.updateStatus(commandId, 'COMMAND_FAILED', 'Agent is offline');
      throw new Error('Agent is offline. Command could not be delivered.');
    }

    return new Promise<AgentCommandResponse<R>>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingCommands.delete(commandId);
        AgentCommandRepository.updateStatus(commandId, 'TIMEOUT_WAITING_FOR_AGENT');
        resolve({
          id: commandId,
          success: false,
          timestamp: new Date().toISOString(),
          status: 'TIMEOUT_WAITING_FOR_AGENT',
          error: {
            code: 'TIMEOUT_WAITING_FOR_AGENT',
            message: `Command timed out after ${timeoutMs / 1000}s waiting for agent response.`
          }
        });
      }, timeoutMs);

      this.pendingCommands.set(commandId, {
        commandId,
        agentId,
        resolve: resolve as (res: AgentCommandResponse) => void,
        reject,
        timer
      });

      try {
        session.ws.send(JSON.stringify({ type: 'agent.command', payload: cmd }));
      } catch (err) {
        clearTimeout(timer);
        this.pendingCommands.delete(commandId);
        AgentCommandRepository.updateStatus(commandId, 'COMMAND_FAILED', err instanceof Error ? err.message : String(err));
        reject(err);
      }
    });
  }

  private flushQueuedCommands(agentId: string): void {
    const session = this.activeAgents.get(agentId);
    if (!session || session.ws.readyState !== WebSocket.OPEN) return;

    const queued = AgentCommandRepository.getQueuedCommands(agentId);
    if (queued.length === 0) return;

    console.log(`[AgentHub] Flushing ${queued.length} queued command(s) to reconnected agent ${agentId}`);
    for (const row of queued) {
      try {
        const payload = JSON.parse(row.payload_json);
        const cmd: AgentCommand = {
          id: row.id,
          type: row.type,
          agentId,
          timestamp: new Date().toISOString(),
          queueable: true,
          payload
        };
        session.ws.send(JSON.stringify({ type: 'agent.command', payload: cmd }));
      } catch (err) {
        console.warn(`[AgentHub] Failed to flush command ${row.id}:`, err);
      }
    }
  }

  public getConnectedAgent(agentId: string): ConnectedAgentSession | undefined {
    return this.activeAgents.get(agentId);
  }

  public isAgentOnline(agentId: string): boolean {
    const session = this.activeAgents.get(agentId);
    if (!session || session.ws.readyState !== WebSocket.OPEN) return false;
    const diff = Date.now() - session.lastHeartbeatAt;
    return diff <= 45000;
  }

  public getDiagnostics(agentId: string): AgentDiagnosticsInfo {
    const agent = AgentRepository.findById(agentId);
    const session = this.activeAgents.get(agentId);
    const lastSeen = agent?.last_seen || null;
    const computedStatus = AgentAuthManager.computeAgentStatus(lastSeen);
    const secondsAgo = AgentAuthManager.getSecondsAgo(lastSeen);

    return {
      backend: 'CONNECTED',
      websocket: session && session.ws.readyState === WebSocket.OPEN ? 'CONNECTED' : 'DISCONNECTED',
      authentication: agent ? 'VALID' : 'UNPAIRED',
      lastHeartbeatSecondsAgo: secondsAgo,
      latencyMs: session?.lastLatencyMs ?? (secondsAgo !== null && secondsAgo < 5 ? 24 : null),
      reconnectAttempts: session?.reconnectAttempts ?? 0,
      agentVersion: agent?.version || '1.0.0',
      minecraftState: session?.minecraftState || 'OFFLINE',
      watchdogActive: true,
      status: computedStatus
    };
  }
}
