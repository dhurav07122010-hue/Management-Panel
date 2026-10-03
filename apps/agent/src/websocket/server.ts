import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';
import { SessionRepository, AgentRepository } from '../database/repositories.js';
import { SecurityService } from '../services/security.service.js';
import { processManager } from '../services/process.service.js';
import { StatsService } from '../services/stats.service.js';
import { config } from '../config/environment.js';
import { AgentHub } from '../services/agent-hub.service.js';
import { AgentAuthManager } from '../services/agent-auth.service.js';
import type {
  WebSocketMessage,
  WebSocketEventType,
  ConsoleLine,
  ServerState,
  PlayerInfo,
  AgentAuthMessage,
  AgentHeartbeatPayload,
  AgentStateSyncPayload,
  AgentCommandAck,
  AgentCommandResponse
} from '@mc-panel/types';

interface AuthenticatedSocket extends WebSocket {
  userId?: string;
  username?: string;
  agentId?: string;
  isAgent?: boolean;
  isAlive?: boolean;
}

export class AgentWebSocketServer {
  private wss: WebSocketServer;
  private statsInterval?: NodeJS.Timeout;
  private hub: AgentHub;

  constructor(server: Server) {
    this.hub = AgentHub.getInstance();

    // Listen on /ws for web clients and /agent-ws for outbound agents (or /ws?role=agent)
    this.wss = new WebSocketServer({
      server,
      path: '/ws'
    });

    // Wire up AgentHub -> Web Clients broadcaster
    this.hub.registerWebBroadcast((type: string, payload: unknown) => {
      this.broadcast(type as WebSocketEventType, payload);
    });

    this.wss.on('connection', (ws: AuthenticatedSocket, req) => {
      const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
      const token = url.searchParams.get('token');
      const agentIdParam = url.searchParams.get('agentId');
      const isAgentParam = url.searchParams.get('role') === 'agent' || !!agentIdParam;

      ws.isAlive = true;
      ws.on('pong', () => {
        ws.isAlive = true;
      });

      // ----------------------------------------------------
      // PATH A: OUTBOUND AGENT CONNECTION
      // ----------------------------------------------------
      if (isAgentParam) {
        ws.isAgent = true;
        let authenticatedAgentId: string | null = null;

        // If credentials sent via query parameter, attempt fast verification
        if (token && agentIdParam) {
          const agent = AgentRepository.findById(agentIdParam);
          const credHash = AgentAuthManager.hashAgentCredential(token);
          if (agent && agent.credential_hash === credHash) {
            authenticatedAgentId = agent.id;
            ws.agentId = agent.id;
            this.hub.handleAgentAuthenticated(agent, ws);
            this.sendToClient(ws, 'agent.connected' as WebSocketEventType, {
              status: 'authenticated',
              protocolVersion: 1
            });
          }
        }

        ws.on('message', (data: Buffer | string) => {
          try {
            const parsed = JSON.parse(data.toString()) as { type: string; payload: unknown };

            switch (parsed.type) {
              case 'agent.auth': {
                const authMsg = parsed.payload as AgentAuthMessage;
                const agent = AgentRepository.findById(authMsg.agentId);
                const credHash = AgentAuthManager.hashAgentCredential(authMsg.token);

                if (!agent || agent.credential_hash !== credHash) {
                  ws.close(4003, 'Invalid agent credentials');
                  return;
                }

                authenticatedAgentId = agent.id;
                ws.agentId = agent.id;
                this.hub.handleAgentAuthenticated(agent, ws);
                this.sendToClient(ws, 'agent.connected' as WebSocketEventType, {
                  status: 'authenticated',
                  protocolVersion: 1
                });
                break;
              }

              case 'agent.heartbeat': {
                if (!authenticatedAgentId) return;
                const hb = parsed.payload as AgentHeartbeatPayload;
                this.hub.handleHeartbeat(authenticatedAgentId, hb);
                this.sendToClient(ws, 'agent.pong' as WebSocketEventType, {
                  type: 'heartbeat_ack',
                  timestamp: new Date().toISOString()
                });
                break;
              }

              case 'agent.state_sync': {
                if (!authenticatedAgentId) return;
                const sync = parsed.payload as AgentStateSyncPayload;
                const agent = AgentRepository.findById(authenticatedAgentId);
                if (agent) {
                  this.hub.handleAgentAuthenticated(agent, ws, sync);
                }
                break;
              }

              case 'agent.command_ack': {
                if (!authenticatedAgentId) return;
                this.hub.handleCommandAck(parsed.payload as AgentCommandAck);
                break;
              }

              case 'agent.command_response': {
                if (!authenticatedAgentId) return;
                this.hub.handleCommandResponse(parsed.payload as AgentCommandResponse);
                break;
              }

              case 'server.console': {
                // Forward console stream from agent directly to connected web clients
                const log = parsed.payload as ConsoleLine;
                this.broadcast('server.console', log);
                break;
              }

              case 'server.status': {
                const statusPayload = parsed.payload as { state: ServerState; uptime: number };
                this.broadcast('server.status', statusPayload);
                break;
              }

              case 'server.stats': {
                this.broadcast('server.stats', parsed.payload);
                break;
              }

              case 'server.players': {
                this.broadcast('server.players', parsed.payload as PlayerInfo[]);
                break;
              }

              default:
                break;
            }
          } catch {
            // ignore malformed messages
          }
        });

        ws.on('close', (code, reason) => {
          if (authenticatedAgentId) {
            this.hub.handleAgentDisconnected(authenticatedAgentId, ws, reason.toString() || `Code ${code}`);
          }
        });

        return;
      }

      // ----------------------------------------------------
      // PATH B: WEB CLIENT / USER CONNECTION
      // ----------------------------------------------------
      if (!token) {
        ws.close(4001, 'Authentication token required');
        return;
      }

      const tokenHash = SecurityService.hashToken(token);
      const session = SessionRepository.findByTokenHash(tokenHash);

      if (!session) {
        ws.close(4003, 'Invalid or expired session');
        return;
      }

      ws.userId = session.user_id;
      ws.username = session.username;
      ws.isAgent = false;
      this.hub.registerWebClient(ws);

      // Send initial connection event
      this.sendToClient(ws, 'agent.connected', {
        agentVersion: '1.0.0',
        state: processManager.getState(),
        players: processManager.getPlayers()
      });

      // Send recent console buffer so the console immediately populates
      const recentLogs = processManager.getConsoleBuffer(100);
      for (const log of recentLogs) {
        this.sendToClient(ws, 'server.console', log);
      }

      ws.on('message', async (data: Buffer | string) => {
        try {
          const parsed = JSON.parse(data.toString()) as { type: string; payload: unknown; agentId?: string };
          if (parsed.type === 'server.command' && typeof parsed.payload === 'string') {
            const commandStr = parsed.payload;

            // If an outbound registered agent is active, dispatch to it; otherwise run locally
            const agents = AgentRepository.list();
            const activeAgent = agents.find((a) => this.hub.isAgentOnline(a.id));

            if (activeAgent) {
              await this.hub.dispatchCommand(activeAgent.id, 'minecraft.command', { command: commandStr });
            } else {
              processManager.sendCommand(commandStr, ws.username || 'web-user');
            }
          } else if (parsed.type === 'agent.ping') {
            this.sendToClient(ws, 'agent.pong', { timestamp: Date.now() });
          }
        } catch {
          // ignore malformed messages
        }
      });
    });

    // Register process manager event listeners
    processManager.registerListeners({
      onConsole: (line: ConsoleLine) => {
        this.broadcast('server.console', line);
      },
      onStatus: (state: ServerState) => {
        this.broadcast('server.status', { state, uptime: processManager.getUptimeSeconds() });
      },
      onPlayer: (players: PlayerInfo[]) => {
        this.broadcast('server.players', players);
      },
      onCrash: (info) => {
        this.broadcast('server.crashed', info);
      }
    });

    // Start background stats broadcast ticker (every 2 seconds) for local process
    this.statsInterval = setInterval(async () => {
      if (this.wss.clients.size === 0) return;
      try {
        const stats = await StatsService.getMetrics(
          processManager.getPid(),
          processManager.getUptimeSeconds(),
          config.mockMode && processManager.getState() === 'ONLINE'
        );
        this.broadcast('server.stats', stats);
      } catch {
        // ignore
      }
    }, 2000);

    // Keep-alive heartbeat ping every 30s
    setInterval(() => {
      for (const client of this.wss.clients) {
        const authClient = client as AuthenticatedSocket;
        if (authClient.isAlive === false) {
          authClient.terminate();
          continue;
        }
        authClient.isAlive = false;
        authClient.ping();
      }
    }, 30000);
  }

  public broadcast<T>(type: WebSocketEventType, payload: T): void {
    const msg: WebSocketMessage<T> = {
      type,
      payload,
      timestamp: new Date().toISOString()
    };
    const json = JSON.stringify(msg);

    for (const client of this.wss.clients) {
      const authClient = client as AuthenticatedSocket;
      // Do not mirror console/stats to other agent sockets
      if (client.readyState === WebSocket.OPEN && !authClient.isAgent) {
        client.send(json);
      }
    }
  }

  private sendToClient<T>(client: WebSocket, type: WebSocketEventType, payload: T): void {
    if (client.readyState === WebSocket.OPEN) {
      const msg: WebSocketMessage<T> = {
        type,
        payload,
        timestamp: new Date().toISOString()
      };
      client.send(JSON.stringify(msg));
    }
  }

  public close(): void {
    if (this.statsInterval) clearInterval(this.statsInterval);
    this.wss.close();
  }
}
