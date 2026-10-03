import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { AgentConfigManager, type LocalAgentConfig } from './config-manager.js';
import { OutboundAgentClient } from './outbound-agent.js';
import { AgentDoctor } from './doctor.js';

const VERSION = '1.0.0';

export async function runCli(args: string[]): Promise<void> {
  const command = args[0] || '--help';

  switch (command.toLowerCase()) {
    case 'start': {
      let cfg = AgentConfigManager.loadConfig();
      if (!cfg) {
        console.log('[Notice] Agent is not paired yet. Defaulting to local backend mode...');
        cfg = {
          backendUrl: 'http://localhost:3001',
          agentId: `agent_local_${Date.now().toString(36)}`,
          installationId: AgentConfigManager.getOrCreateInstallationId(),
          agentName: 'Gaming PC',
          token: 'local-internal-token',
          version: VERSION,
          heartbeatIntervalSec: 12,
          metricsIntervalSec: 6,
          autoRestartMinecraft: true,
          maxRestartAttempts: 3,
          restartCooldownSec: 10,
          logLevel: 'INFO'
        };
        AgentConfigManager.saveConfig(cfg);
      }

      const client = new OutboundAgentClient(cfg);
      client.start();

      process.on('SIGINT', () => {
        client.stop();
        process.exit(0);
      });
      process.on('SIGTERM', () => {
        client.stop();
        process.exit(0);
      });
      break;
    }

    case 'pair':
    case '--pair': {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const prompt = (query: string): Promise<string> =>
        new Promise((resolve) => rl.question(query, resolve));

      console.log('============================================================');
      console.log('       MINECRAFT SERVER AGENT - PAIRING SETUP');
      console.log('============================================================');

      const backendUrlInput = await prompt('Cloud Backend URL (e.g. https://your-panel.com or http://localhost:3001): ');
      const backendUrl = (backendUrlInput.trim() || 'http://localhost:3001').replace(/\/$/, '');

      const codeInput = await prompt('Pairing Code from Web Panel (e.g. XXXX-XXXX): ');
      const code = codeInput.trim().toUpperCase();

      const nameInput = await prompt('Agent Friendly Name [Gaming PC]: ');
      const agentName = nameInput.trim() || 'Gaming PC';

      rl.close();

      console.log(`\nContacting ${backendUrl} to verify pairing code ${code}...`);
      const installationId = AgentConfigManager.getOrCreateInstallationId();

      try {
        const postData = JSON.stringify({
          code,
          name: agentName,
          installationId,
          version: VERSION
        });

        const isHttps = backendUrl.startsWith('https://');
        const clientMod = isHttps ? https : http;
        const targetUrl = new URL(`${backendUrl}/api/agents/pair`);

        const req = clientMod.request(
          targetUrl,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(postData)
            }
          },
          (res) => {
            let resData = '';
            res.on('data', (chunk) => { resData += chunk; });
            res.on('end', () => {
              try {
                const parsed = JSON.parse(resData);
                if (parsed.success) {
                  const cfg: LocalAgentConfig = {
                    backendUrl,
                    agentId: parsed.data.agentId,
                    installationId,
                    agentName,
                    token: parsed.data.token,
                    version: VERSION,
                    heartbeatIntervalSec: 12,
                    metricsIntervalSec: 6,
                    autoRestartMinecraft: true,
                    maxRestartAttempts: 3,
                    restartCooldownSec: 10,
                    logLevel: 'INFO'
                  };
                  AgentConfigManager.saveConfig(cfg);
                  console.log('\n============================================================');
                  console.log('   PAIRING SUCCESSFUL!');
                  console.log(`   Agent ID:    ${cfg.agentId}`);
                  console.log(`   Agent Name:  ${cfg.agentName}`);
                  console.log(`   Backend URL: ${cfg.backendUrl}`);
                  console.log('============================================================\n');
                  console.log('You can now run: agent.exe start (or start-agent.bat)');
                } else {
                  console.error('\n[Error] Pairing rejected:', parsed.error?.message || 'Invalid code');
                }
              } catch (e) {
                console.error('\n[Error] Failed to parse backend response:', e);
              }
            });
          }
        );

        req.on('error', (err) => {
          console.error('\n[Error] Network error reaching backend:', err.message);
        });

        req.write(postData);
        req.end();
      } catch (err) {
        console.error('[Error] Pairing failed:', err);
      }
      break;
    }

    case 'unpair': {
      AgentConfigManager.deleteConfig();
      console.log('Agent unpaired and local credentials removed.');
      break;
    }

    case 'status': {
      const cfg = AgentConfigManager.loadConfig();
      if (!cfg) {
        console.log('Status: UNPAIRED (No config found)');
        return;
      }
      console.log('============================================================');
      console.log(`Agent Name:       ${cfg.agentName}`);
      console.log(`Agent ID:         ${cfg.agentId}`);
      console.log(`Backend URL:      ${cfg.backendUrl}`);
      console.log(`Installation ID:  ${cfg.installationId}`);
      console.log(`Version:          ${cfg.version}`);
      console.log('============================================================');
      break;
    }

    case 'doctor': {
      console.log('============================================================');
      console.log('          MINECRAFT MANAGEMENT AGENT DOCTOR');
      console.log('============================================================\n');
      const { checks, diagnosis } = await AgentDoctor.runDiagnostics();

      for (const check of checks) {
        const tag = check.status === 'OK' ? '[OK]  ' : check.status === 'WARN' ? '[WARN]' : '[FAIL]';
        console.log(`${tag} ${check.name.padEnd(26)} : ${check.message}`);
      }

      console.log('\n------------------------------------------------------------');
      console.log(`Diagnosis: ${diagnosis}`);
      console.log('------------------------------------------------------------\n');
      break;
    }

    case 'logs': {
      const logFile = path.resolve(process.cwd(), 'data', 'agent-service.log');
      if (!fs.existsSync(logFile)) {
        console.log('No log file found at data/agent-service.log');
        return;
      }
      const content = fs.readFileSync(logFile, 'utf-8');
      const lines = content.split('\n');
      console.log(lines.slice(-50).join('\n'));

      if (args.includes('--follow') || args.includes('-f')) {
        console.log('\n--- Following logs (Ctrl+C to stop) ---');
        let currentSize = fs.statSync(logFile).size;
        setInterval(() => {
          try {
            const newStat = fs.statSync(logFile);
            if (newStat.size > currentSize) {
              const stream = fs.createReadStream(logFile, { start: currentSize, end: newStat.size });
              stream.pipe(process.stdout);
              currentSize = newStat.size;
            }
          } catch {}
        }, 1000);
      }
      break;
    }

    case 'version':
    case '--version':
    case '-v': {
      console.log(`Minecraft Management Agent v${VERSION}`);
      break;
    }

    case '--help':
    case 'help':
    default: {
      console.log(`
Minecraft Server Management Outbound Agent CLI (v${VERSION})

Usage:
  agent.exe start              Start outbound agent in background/foreground
  agent.exe stop               Gracefully stop running agent process
  agent.exe restart            Restart agent process
  agent.exe pair               Pair this Windows host to Web Control Panel
  agent.exe unpair             Remove local agent credentials
  agent.exe status             Check agent identity and configuration
  agent.exe doctor             Run comprehensive environment & network diagnostics
  agent.exe logs [--follow]    View agent service log output
  agent.exe version            Display agent software version
  agent.exe --help             Display this help message
`);
      break;
    }
  }
}
