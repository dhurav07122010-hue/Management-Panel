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

const app = createApp();
const server = http.createServer(app);
const wsServer = new AgentWebSocketServer(server);

// Start backup scheduler
BackupService.initScheduler();

// Start Cloudflare Tunnel automatically for Vercel
TunnelService.startTunnel();

// Ensure Playit.gg tunnel is running for player connections
PlayitService.ensureRunning();

// Check if server auto-start is configured
processManager.checkAutoStart();

server.listen(config.port, config.host, () => {
  const localIps = getLocalIpAddresses();

  console.log('\n============================================================');
  console.log('   MINECRAFT SERVER MANAGEMENT CONTROL PANEL & AGENT');
  console.log('============================================================');
  console.log(`Agent & API Status: ONLINE`);
  console.log(`Local Access:       http://localhost:${config.port}`);
  if (localIps.length > 0) {
    for (const ip of localIps) {
      console.log(`LAN (Phone) Access: http://${ip}:${config.port}`);
    }
  }
  console.log(`WebSocket:          ws://localhost:${config.port}/ws`);
  console.log(`Mock Mode:          ${config.mockMode ? 'ENABLED (Simulated MC)' : 'DISABLED (Real Java)'}`);
  console.log('============================================================\n');
});

// Graceful process shutdown handler
function shutdown(signal: string) {
  console.log(`\nReceived ${signal}. Shutting down Minecraft Server Panel...`);
  wsServer.close();

  if (processManager.getState() === 'ONLINE') {
    console.log('Stopping Minecraft server process...');
    processManager.stopServer('system-shutdown').catch(() => {
      processManager.killServer('system-shutdown');
    });
  }

  closeDatabase();
  server.close(() => {
    console.log('Server shut down cleanly.');
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
