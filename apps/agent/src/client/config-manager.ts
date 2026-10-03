import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export interface LocalAgentConfig {
  backendUrl: string; // e.g. "http://localhost:3001" or "https://my-panel.com"
  agentId: string;
  installationId: string;
  agentName: string;
  token: string;
  version: string;
  heartbeatIntervalSec: number;
  metricsIntervalSec: number;
  autoRestartMinecraft: boolean;
  maxRestartAttempts: number;
  restartCooldownSec: number;
  logLevel: string;
}

const rootDir = path.resolve(process.cwd(), process.cwd().includes('apps') ? '../..' : '.');
const configFilePath = path.join(rootDir, 'data', 'agent-config.json');

export class AgentConfigManager {
  public static getConfigPath(): string {
    return configFilePath;
  }

  public static loadConfig(): LocalAgentConfig | null {
    if (!fs.existsSync(configFilePath)) {
      return null;
    }
    try {
      const raw = fs.readFileSync(configFilePath, 'utf-8');
      return JSON.parse(raw) as LocalAgentConfig;
    } catch {
      return null;
    }
  }

  public static saveConfig(cfg: LocalAgentConfig): void {
    const dir = path.dirname(configFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(configFilePath, JSON.stringify(cfg, null, 2), 'utf-8');
  }

  public static getOrCreateInstallationId(): string {
    const installFile = path.join(rootDir, 'data', 'installation-id.txt');
    if (fs.existsSync(installFile)) {
      try {
        const id = fs.readFileSync(installFile, 'utf-8').trim();
        if (id) return id;
      } catch {}
    }
    const newId = `install_${crypto.randomBytes(8).toString('hex')}`;
    const dir = path.dirname(installFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(installFile, newId, 'utf-8');
    return newId;
  }

  public static deleteConfig(): void {
    if (fs.existsSync(configFilePath)) {
      try {
        fs.unlinkSync(configFilePath);
      } catch {}
    }
  }
}
