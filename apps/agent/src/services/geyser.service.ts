import fs from 'node:fs';
import path from 'node:path';
import { SettingsRepository } from '../database/repositories.js';
import { ServerConfigService } from './server-config.service.js';
import { config } from '../config/environment.js';
import type { GeyserStatus, FloodgateStatus } from '@mc-panel/types';

export class GeyserService {
  private static getServerDir(): string {
    return ServerConfigService.readConfig().serverDirectory || SettingsRepository.get('serverDirectory') || config.serverDir;
  }

  public static getGeyserStatus(): GeyserStatus {
    const serverDir = this.getServerDir();
    const modsDir = path.join(serverDir, 'mods');

    let installed = false;
    let version: string | undefined;

    if (fs.existsSync(modsDir)) {
      try {
        const files = fs.readdirSync(modsDir);
        const geyserJar = files.find((f) => f.toLowerCase().includes('geyser') && f.endsWith('.jar'));
        if (geyserJar) {
          installed = true;
          const match = geyserJar.match(/geyser[^\d]*([\d.]+)/i);
          if (match) version = match[1];
        }
      } catch {
        // ignore error
      }
    }

    if (!installed) {
      return { installed: false, status: 'NOT_CONFIGURED' };
    }

    // Inspect config/Geyser-Fabric/config.yml or config/Geyser/config.yml
    const potentialPaths = [
      path.join(serverDir, 'config', 'Geyser-Fabric', 'config.yml'),
      path.join(serverDir, 'config', 'Geyser', 'config.yml'),
      path.join(serverDir, 'plugins', 'Geyser-Spigot', 'config.yml')
    ];

    let foundConfigPath: string | undefined;
    let bedrockPort = 19132;
    let bedrockAddress = '0.0.0.0';
    let javaPort = 25565;
    let javaAddress = 'auto';
    let authType = 'online';

    for (const p of potentialPaths) {
      if (fs.existsSync(p)) {
        foundConfigPath = p;
        try {
          const content = fs.readFileSync(p, 'utf-8');
          // Parse lines safely without external heavy yaml dependency
          const portMatch = content.match(/bedrock:[\s\S]*?port:\s*(\d+)/i);
          if (portMatch) bedrockPort = parseInt(portMatch[1], 10);

          const addrMatch = content.match(/bedrock:[\s\S]*?address:\s*['"]?([^\s'"]+)/i);
          if (addrMatch) bedrockAddress = addrMatch[1];

          const authMatch = content.match(/auth-type:\s*['"]?([^\s'"]+)/i);
          if (authMatch) authType = authMatch[1];
        } catch {
          // ignore parsing error
        }
        break;
      }
    }

    return {
      installed: true,
      version,
      configPath: foundConfigPath ? path.relative(serverDir, foundConfigPath).replace(/\\/g, '/') : undefined,
      bedrockAddress,
      bedrockPort,
      javaAddress,
      javaPort,
      authType,
      status: installed ? 'ONLINE' : 'NOT_CONFIGURED'
    };
  }

  public static getFloodgateStatus(): FloodgateStatus {
    const serverDir = this.getServerDir();
    const modsDir = path.join(serverDir, 'mods');

    let installed = false;
    let version: string | undefined;

    if (fs.existsSync(modsDir)) {
      try {
        const files = fs.readdirSync(modsDir);
        const fgJar = files.find((f) => f.toLowerCase().includes('floodgate') && f.endsWith('.jar'));
        if (fgJar) {
          installed = true;
          const match = fgJar.match(/floodgate[^\d]*([\d.]+)/i);
          if (match) version = match[1];
        }
      } catch {
        // ignore error
      }
    }

    if (!installed) {
      return { installed: false, keyPresent: false, status: 'NOT_CONFIGURED' };
    }

    // Inspect config/Floodgate-Fabric or config/floodgate for key.pem
    const potentialKeyPaths = [
      path.join(serverDir, 'config', 'Floodgate-Fabric', 'key.pem'),
      path.join(serverDir, 'config', 'floodgate', 'key.pem'),
      path.join(serverDir, 'plugins', 'floodgate', 'key.pem')
    ];

    let keyPresent = false;
    let configPath: string | undefined;
    const warnings: string[] = [];

    for (const kp of potentialKeyPaths) {
      if (fs.existsSync(kp)) {
        keyPresent = true;
        configPath = path.relative(serverDir, path.dirname(kp)).replace(/\\/g, '/');
        break;
      }
    }

    if (!keyPresent) {
      warnings.push('Floodgate key.pem file was not found. Bedrock players may not be able to connect.');
    }

    return {
      installed: true,
      version,
      configPath,
      keyPresent,
      status: keyPresent ? 'ONLINE' : 'NOT_CONFIGURED',
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }
}
