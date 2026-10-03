import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';
import { SessionRepository } from '../database/repositories.js';
import { SecurityService } from '../services/security.service.js';
import { processManager } from '../services/process.service.js';
import { StatsService } from '../services/stats.service.js';
import { config } from '../config/environment.js';
import type { WebSocketMessage, WebSocketEventType, ConsoleLine, ServerState, PlayerInfo } from '@mc-panel/types';

interface AuthenticatedSocket extends WebSocket {
  userId?: string;
  username?: string;
  isAlive?: boolean;
}

export class AgentWebSocketServer {
  private wss: WebSocketServer;
  private statsInterval?: NodeJS.Timeout;

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws: AuthenticatedSocket, req) => {
      // Authenticate socket via query parameter ?token=...
      const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
      const token = url.searchParams.get('token');

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
      ws.isAlive = true;

      ws.on('pong', () => {
        ws.isAlive = true;
      });

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

      ws.on('message', (data: Buffer | string) => {
        try {
          const parsed = JSON.parse(data.toString()) as { type: string; payload: unknown };
          if (parsed.type === 'server.command' && typeof parsed.payload === 'string') {
            processManager.sendCommand(parsed.payload, ws.username || 'web-user');
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

    // Start background stats broadcast ticker (every 2 seconds)
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
      if (client.readyState === WebSocket.OPEN) {
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
