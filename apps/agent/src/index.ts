import http from 'node:http';
import os from 'node:os';
import { createApp } from './app.js';
import { config } from './config/environment.js';
import { AgentWebSocketServer } from './websocket/server.js';
import { BackupService } from './services/backup.service.js';
import { closeDatabase } from './database/db.js';
import { processManager } from './services/process.service.js';
import { TunnelService } from './services/tunnel.service.js';
import { PlayitService } from './services/playit.service.js';
import { AgentConfigManager, type LocalAgentConfig } from './client/config-manager.js';
import { OutboundAgentClient } from './client/outbound-agent.js';
import { runCli } from './client/cli.js';

// If called with CLI arguments (e.g. `node index.js start`, `pair`, `doctor`, etc.)
const cliArgs = process.argv.slice(2);
const isCliCommand = cliArgs.length > 0 && !cliArgs.includes('--standalone-server');

if (isCliCommand && !cliArgs.includes('--agent-client')) {
  // Run CLI tool
  runCli(cliArgs).then(() => {
    if (!['start', 'logs'].includes(cliArgs[0]?.toLowerCase())) {
      process.exit(0);
    }
  }).catch((err) => {
    console.error('[CLI Error]', err);
    process.exit(1);
  });
} else {
  // Run Cloud Control Backend & Hub
  startMainServer();
}

function getLocalIpAddresses(): string[] {
  const interfaces = os.networkInterfaces();
  const ips: string[] = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address);
      }
    }
  }
  return ips;
}

function startMainServer(): void {
  const app = createApp();
  const server = http.createServer(app);
  const wsServer = new AgentWebSocketServer(server);

  // Start backup scheduler
  BackupService.initScheduler();

  let outboundClient: OutboundAgentClient | null = null;

  // Initialize outbound agent client automatically if agent-config.json exists or if local default is desired
  const agentConfig = AgentConfigManager.loadConfig();
  if (agentConfig) {
    console.log('[Server] Discovered configured Outbound Agent. Launching persistent outbound connection...');
    outboundClient = new OutboundAgentClient(agentConfig);
    outboundClient.start();
  }

  // Localtunnel enables public remote / Vercel web access without open ports
  if (process.env.ENABLE_TUNNEL !== 'false') {
    TunnelService.startTunnel();
  }

  server.listen(config.port, config.host, () => {
    const localIps = getLocalIpAddresses();

    console.log('\n============================================================');
    console.log('   MINECRAFT SERVER MANAGEMENT CONTROL BACKEND & AGENT');
    console.log('============================================================');
    console.log(`Cloud Control Backend: ONLINE (Port ${config.port})`);
    console.log(`Local Access:          http://localhost:${config.port}`);
    if (localIps.length > 0) {
      for (const ip of localIps) {
        console.log(`LAN (Phone) Access:    http://${ip}:${config.port}`);
      }
    }
    console.log(`WebSocket Endpoint:    ws://localhost:${config.port}/ws`);
    console.log(`Outbound Agent:        ${agentConfig ? `ENABLED (ID: ${agentConfig.agentId})` : 'READY (Pair via Web or CLI)'}`);
    console.log(`Mock Mode:             ${config.mockMode ? 'ENABLED (Simulated MC)' : 'DISABLED (Real Java)'}`);
    console.log('============================================================\n');
  });

  // Graceful process shutdown handler
  function shutdown(signal: string) {
    console.log(`\nReceived ${signal}. Shutting down Minecraft Server Panel...`);
    if (outboundClient) {
      outboundClient.stop();
    }
    wsServer.close();

    if (processManager.getState() === 'ONLINE') {
      console.log('Stopping Minecraft server process...');
      processManager.stopServer('system-shutdown').catch(() => {
        processManager.killServer('system-shutdown');
      });
    }
    PlayitService.stop();
    TunnelService.stop();

    closeDatabase();
    server.close(() => {
      console.log('Server shut down cleanly.');
      process.exit(0);
    });
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  process.on('uncaughtException', (err) => {
    console.error('[Agent Exception]', err);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('[Agent Rejection]', reason);
  });
}
