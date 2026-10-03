import dns from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { AgentConfigManager } from './config-manager.js';
import { ServerConfigService } from '../services/server-config.service.js';
import { ProcessService } from '../services/process.service.js';

const execAsync = promisify(exec);

export interface DoctorCheckResult {
  name: string;
  status: 'OK' | 'WARN' | 'FAIL';
  message: string;
}

export class AgentDoctor {
  public static async runDiagnostics(): Promise<{ checks: DoctorCheckResult[]; diagnosis: string }> {
    const checks: DoctorCheckResult[] = [];

    // 1. Internet Connectivity & DNS
    try {
      const addresses = await dns.resolve('1.1.1.1').catch(() => dns.resolve('google.com'));
      checks.push({
        name: 'Internet & DNS',
        status: 'OK',
        message: `Resolved remote host (${addresses[0] || 'active'})`
      });
    } catch {
      checks.push({
        name: 'Internet & DNS',
        status: 'WARN',
        message: 'Could not resolve public DNS. Local network operations only.'
      });
    }

    // 2. Configuration & Pairing
    const cfg = AgentConfigManager.loadConfig();
    if (!cfg) {
      checks.push({
        name: 'Agent Configuration',
        status: 'WARN',
        message: 'Agent is not yet paired. Run "agent.exe pair" or start setup.'
      });
    } else {
      checks.push({
        name: 'Agent Configuration',
        status: 'OK',
        message: `Agent ID: ${cfg.agentId} (${cfg.agentName})`
      });

      // 3. Backend Reachability
      try {
        const url = new URL(cfg.backendUrl);
        const isHttps = url.protocol === 'https:';
        const clientModule = isHttps ? https : http;

        const reachable = await new Promise<boolean>((resolve) => {
          const req = clientModule.get(`${cfg.backendUrl.replace(/\/$/, '')}/health`, { timeout: 4000 }, (res) => {
            resolve(res.statusCode !== undefined && res.statusCode < 500);
          });
          req.on('error', () => resolve(false));
          req.on('timeout', () => { req.destroy(); resolve(false); });
        });

        if (reachable) {
          checks.push({
            name: 'Backend Reachability',
            status: 'OK',
            message: `Connected to ${cfg.backendUrl}`
          });
        } else {
          checks.push({
            name: 'Backend Reachability',
            status: 'WARN',
            message: `Could not reach ${cfg.backendUrl}. Backend may be starting or offline.`
          });
        }
      } catch {
        checks.push({
          name: 'Backend Reachability',
          status: 'FAIL',
          message: `Invalid backend URL: ${cfg.backendUrl}`
        });
      }
    }

    // 4. Minecraft Server Directory
    try {
      const serverConfig = ServerConfigService.readConfig();
      const serverDir = serverConfig.serverDirectory;
      if (fs.existsSync(serverDir)) {
        checks.push({
          name: 'Minecraft Directory',
          status: 'OK',
          message: `Found at ${serverDir}`
        });
      } else {
        checks.push({
          name: 'Minecraft Directory',
          status: 'WARN',
          message: `Directory not yet created: ${serverDir}`
        });
      }
    } catch {
      checks.push({
        name: 'Minecraft Directory',
        status: 'WARN',
        message: 'Could not verify server directory.'
      });
    }

    // 5. Java Detection
    const javaPaths = ProcessService.detectJavaInstallations();
    if (javaPaths.length > 0) {
      checks.push({
        name: 'Java Runtime',
        status: 'OK',
        message: `Found: ${javaPaths[0]}`
      });
    } else {
      checks.push({
        name: 'Java Runtime',
        status: 'WARN',
        message: 'Java runtime not detected automatically in default PATH or Registry.'
      });
    }

    // 6. System Resources (RAM & CPU)
    const totalMemGb = (os.totalmem() / (1024 ** 3)).toFixed(1);
    const freeMemGb = (os.freemem() / (1024 ** 3)).toFixed(1);
    const cpuCount = os.cpus().length;
    checks.push({
      name: 'System Hardware',
      status: 'OK',
      message: `${cpuCount} CPU cores, ${totalMemGb} GB RAM (${freeMemGb} GB available)`
    });

    // 7. Windows Watchdog & Startup Configuration
    try {
      const startupVbs = process.env.APPDATA
        ? path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup', 'MinecraftServerAgent.vbs')
        : '';
      const hasStartupFolderEntry = Boolean(startupVbs && fs.existsSync(startupVbs));

      const { stdout } = await execAsync('schtasks /Query /TN "MinecraftServerAgent" /FO CSV /NH').catch(() => ({ stdout: '' }));
      const hasScheduledTask = stdout.includes('MinecraftServerAgent');

      if (hasScheduledTask || hasStartupFolderEntry) {
        checks.push({
          name: 'Windows Startup Service',
          status: 'OK',
          message: hasScheduledTask
            ? 'Registered in Windows Task Scheduler (MinecraftServerAgent)'
            : 'Configured in Windows Startup folder (MinecraftServerAgent.vbs)'
        });
      } else {
        checks.push({
          name: 'Windows Startup Service',
          status: 'WARN',
          message: 'Autostart not detected. Run install-startup.bat or scripts/install-agent-service.ps1.'
        });
      }
    } catch {
      checks.push({
        name: 'Windows Startup Service',
        status: 'WARN',
        message: 'Could not verify Windows startup configuration.'
      });
    }

    // Generate Summary Diagnosis
    const hasFail = checks.some((c) => c.status === 'FAIL');
    const hasWarn = checks.some((c) => c.status === 'WARN');
    let diagnosis = 'All critical systems are operational and ready for production management.';
    if (hasFail) {
      diagnosis = 'Critical issues detected. Please check configuration and backend URL.';
    } else if (hasWarn) {
      diagnosis = 'System is functional with minor warnings. Review highlighted notices above.';
    }

    return { checks, diagnosis };
  }
}
