import { useEffect, useRef, useState, useCallback } from 'react';
import { getAuthToken, getAgentBaseUrl } from '../services/api.js';
import type {
  WebSocketMessage,
  ConsoleLine,
  ServerStats,
  PlayerInfo,
  ServerState,
  AgentCommandAck,
  AgentOfflineStatus
} from '@mc-panel/types';

interface UseWebSocketOptions {
  onConsole?: (line: ConsoleLine) => void;
  onStatus?: (state: ServerState, uptime: number) => void;
  onStats?: (stats: ServerStats) => void;
  onPlayers?: (players: PlayerInfo[]) => void;
  onAgentState?: (status: AgentOfflineStatus) => void;
  onCommandAck?: (ack: AgentCommandAck) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const connect = useCallback(() => {
    const token = getAuthToken();
    if (!token) return;

    if (socketRef.current && (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const agentBase = getAgentBaseUrl();
    let wsUrl: string;

    if (agentBase) {
      const isHttps = agentBase.startsWith('https://');
      const wsProtocol = isHttps ? 'wss:' : 'ws:';
      const cleanHost = agentBase.replace(/^https?:\/\//, '');
      wsUrl = `${wsProtocol}//${cleanHost}/ws?token=${encodeURIComponent(token)}`;
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.port === '3000' ? `${window.location.hostname}:3001` : window.location.host;
      wsUrl = `${protocol}//${host}/ws?token=${encodeURIComponent(token)}`;
    }

    try {
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setIsReconnecting(false);
        setReconnectAttempts(0);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as WebSocketMessage;
          switch (msg.type) {
            case 'server.console':
              optionsRef.current.onConsole?.(msg.payload as ConsoleLine);
              break;
            case 'server.status': {
              const p = msg.payload as { state: ServerState; uptime: number };
              optionsRef.current.onStatus?.(p.state, p.uptime);
              break;
            }
            case 'server.stats':
              optionsRef.current.onStats?.(msg.payload as ServerStats);
              break;
            case 'server.players':
              optionsRef.current.onPlayers?.(msg.payload as PlayerInfo[]);
              break;
            case 'agent.command_ack':
              optionsRef.current.onCommandAck?.(msg.payload as AgentCommandAck);
              break;
            case 'agent.connected':
              optionsRef.current.onAgentState?.('ONLINE');
              break;
            default:
              break;
          }
        } catch {
          // ignore
        }
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        socketRef.current = null;

        // If not closed by auth failure, schedule reconnect with exponential backoff
        if (event.code !== 4001 && event.code !== 4003) {
          setIsReconnecting(true);
          setReconnectAttempts((prev) => {
            const next = prev + 1;
            const delays = [1000, 2000, 4000, 8000, 15000, 30000];
            const delay = delays[Math.min(next - 1, delays.length - 1)] + Math.floor(Math.random() * 500);

            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = setTimeout(() => {
              connect();
            }, delay);

            return next;
          });
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      setIsConnected(false);
      setIsReconnecting(true);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    }
  }, []);

  const sendCommand = useCallback((cmd: string) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'server.command', payload: cmd }));
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [connect]);

  return {
    isConnected,
    isReconnecting,
    reconnectAttempts,
    sendCommand,
    reconnect: connect
  };
}
