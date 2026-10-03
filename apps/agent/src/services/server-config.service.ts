import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config/environment.js';
import { SettingsRepository } from '../database/repositories.js';

export interface ServerConfigFile {
  serverDirectory: string;
  startCommand: string;
  autoStart?: boolean;
  scheduledRestartEnabled?: boolean;
  scheduledRestartCron?: string;
  minecraftVersion?: string;
  fabricVersion?: string;
}

export class ServerConfigService {
  private static configFilePath = path.resolve(process.cwd(), process.cwd().includes('apps') ? '../../server-config.json' : './server-config.json');

  public static getConfigFilePath(): string {
    return this.configFilePath;
  }

  /**
   * Reads server-config.json, initializing with sensible defaults if it doesn't exist.
   */
  public static readConfig(): ServerConfigFile {
    if (!fs.existsSync(this.configFilePath)) {
      const initial: ServerConfigFile = {
        serverDirectory: SettingsRepository.get('serverDirectory') || config.serverDir,
        startCommand: SettingsRepository.get('startCommand') || `java -Xms${config.minRam} -Xmx${config.maxRam} -jar ${config.serverJar} nogui`,
        autoStart: SettingsRepository.get('autoStart') === 'true',
        scheduledRestartEnabled: SettingsRepository.get('scheduledRestartEnabled') === 'true',
        scheduledRestartCron: SettingsRepository.get('scheduledRestartCron') || '0 4 * * *',
        minecraftVersion: SettingsRepository.get('minecraftVersion') || '1.21.1',
        fabricVersion: SettingsRepository.get('fabricVersion') || '0.16.5'
      };
      try {
        fs.writeFileSync(this.configFilePath, JSON.stringify(initial, null, 2), 'utf-8');
      } catch (err) {
        console.error('[ServerConfigService] Could not write initial server-config.json:', err);
      }
      return initial;
    }

    try {
      const raw = fs.readFileSync(this.configFilePath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<ServerConfigFile>;
      return {
        serverDirectory: parsed.serverDirectory || config.serverDir,
        startCommand: parsed.startCommand || `java -Xms${config.minRam} -Xmx${config.maxRam} -jar ${config.serverJar} nogui`,
        autoStart: parsed.autoStart ?? false,
        scheduledRestartEnabled: parsed.scheduledRestartEnabled ?? false,
        scheduledRestartCron: parsed.scheduledRestartCron || '0 4 * * *',
        minecraftVersion: parsed.minecraftVersion || '1.21.1',
        fabricVersion: parsed.fabricVersion || '0.16.5'
      };
    } catch (e) {
      console.error('[ServerConfigService] Error reading server-config.json, returning defaults:', e);
      return {
        serverDirectory: config.serverDir,
        startCommand: `java -Xms${config.minRam} -Xmx${config.maxRam} -jar ${config.serverJar} nogui`,
        autoStart: false,
        scheduledRestartEnabled: false,
        scheduledRestartCron: '0 4 * * *',
        minecraftVersion: '1.21.1',
        fabricVersion: '0.16.5'
      };
    }
  }

  /**
   * Writes the config object to server-config.json and syncs SQLite settings.
   */
  public static writeConfig(newConfig: Partial<ServerConfigFile>): ServerConfigFile {
    let current: ServerConfigFile;
    if (fs.existsSync(this.configFilePath)) {
      try {
        const raw = fs.readFileSync(this.configFilePath, 'utf-8');
        current = JSON.parse(raw);
      } catch {
        current = this.readConfig();
      }
    } else {
      current = {
        serverDirectory: SettingsRepository.get('serverDirectory') || config.serverDir,
        startCommand: SettingsRepository.get('startCommand') || `java -Xms${config.minRam} -Xmx${config.maxRam} -jar ${config.serverJar} nogui`,
        autoStart: SettingsRepository.get('autoStart') === 'true',
        scheduledRestartEnabled: SettingsRepository.get('scheduledRestartEnabled') === 'true',
        scheduledRestartCron: SettingsRepository.get('scheduledRestartCron') || '0 4 * * *',
        minecraftVersion: SettingsRepository.get('minecraftVersion') || '1.21.1',
        fabricVersion: SettingsRepository.get('fabricVersion') || '0.16.5'
      };
    }
    const updated: ServerConfigFile = {
      ...current,
      ...newConfig
    };

    // Ensure serverDirectory is normalized
    if (updated.serverDirectory) {
      updated.serverDirectory = path.resolve(updated.serverDirectory);
      if (!fs.existsSync(updated.serverDirectory)) {
        try {
          fs.mkdirSync(updated.serverDirectory, { recursive: true });
        } catch {
          // ignore
        }
      }
    }

    fs.writeFileSync(this.configFilePath, JSON.stringify(updated, null, 2), 'utf-8');

    // Sync to SQLite settings
    SettingsRepository.setMultiple({
      serverDirectory: updated.serverDirectory,
      startCommand: updated.startCommand,
      autoStart: String(updated.autoStart ?? false),
      scheduledRestartEnabled: String(updated.scheduledRestartEnabled ?? false),
      scheduledRestartCron: updated.scheduledRestartCron || '0 4 * * *',
      minecraftVersion: updated.minecraftVersion || '1.21.1',
      fabricVersion: updated.fabricVersion || '0.16.5'
    });

    return updated;
  }

  /**
   * Parses a full Windows startCommand line into executable + string array arguments,
   * respecting quotes (e.g. `"C:\Program Files\Java\bin\java.exe" -Xms2G -jar fabric.jar nogui`).
   * Automatically resolves and parses start.bat scripts if specified.
   */
  public static parseStartCommand(cmdLine: string, serverDir?: string): { executable: string; args: string[] } {
    const trimmed = cmdLine.trim();
    if (!trimmed) {
      return { executable: 'java', args: ['-jar', 'fabric-server-launch.jar', 'nogui'] };
    }

    // If cmdLine specifies a .bat / .cmd file (e.g. "start.bat")
    const isBatFile = trimmed.toLowerCase().endsWith('.bat') || trimmed.toLowerCase().endsWith('.cmd') || trimmed.toLowerCase() === 'start.bat';
    if (isBatFile && serverDir) {
      const batPath = path.isAbsolute(trimmed) ? trimmed : path.resolve(serverDir, trimmed);
      if (fs.existsSync(batPath)) {
        try {
          const content = fs.readFileSync(batPath, 'utf-8');
          const lines = content.split(/\r?\n/);
          for (const rawLine of lines) {
            const line = rawLine.trim();
            // Skip comments and non-execution lines
            if (!line || line.startsWith('@') || line.toLowerCase().startsWith('rem') || line.startsWith('::') || line.toLowerCase() === 'pause') {
              continue;
            }
            if (line.includes('java') || line.includes('-jar')) {
              // Recursively parse the Java command inside start.bat without the blocking pause
              return this.parseStartCommand(line, serverDir);
            }
          }
        } catch {
          // fallback to standard token parsing
        }
      }
    }

    // Regex to split command string preserving double quotes
    const matches: string[] = [];
    const regex = /[^\s"']+|"([^"]*)"|'([^']*)'/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(trimmed)) !== null) {
      if (match[1] !== undefined) {
        matches.push(match[1]); // Double-quoted content
      } else if (match[2] !== undefined) {
        matches.push(match[2]); // Single-quoted content
      } else {
        matches.push(match[0]); // Unquoted token
      }
    }

    if (matches.length === 0) {
      return { executable: 'java', args: ['-jar', 'fabric-server-launch.jar', 'nogui'] };
    }

    const executable = matches[0];
    const args = matches.slice(1);

    return { executable, args };
  }
}
