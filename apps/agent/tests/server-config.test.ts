import { describe, it, expect } from 'vitest';
import { ServerConfigService } from '../src/services/server-config.service.js';

describe('ServerConfigService - Start Command Parser & Configuration', () => {
  it('parses standard unquoted java start command', () => {
    const cmd = 'java -Xms2G -Xmx6G -jar fabric-server-launch.jar nogui';
    const parsed = ServerConfigService.parseStartCommand(cmd);

    expect(parsed.executable).toBe('java');
    expect(parsed.args).toEqual([
      '-Xms2G',
      '-Xmx6G',
      '-jar',
      'fabric-server-launch.jar',
      'nogui'
    ]);
  });

  it('parses paths with spaces and quotes in executable path', () => {
    const cmd = '"C:\\Program Files\\Java\\jdk-25\\bin\\java.exe" -Xms2G -Xmx6G -jar fabric-server-launch.jar nogui';
    const parsed = ServerConfigService.parseStartCommand(cmd);

    expect(parsed.executable).toBe('C:\\Program Files\\Java\\jdk-25\\bin\\java.exe');
    expect(parsed.args).toEqual([
      '-Xms2G',
      '-Xmx6G',
      '-jar',
      'fabric-server-launch.jar',
      'nogui'
    ]);
  });

  it('reads and writes server-config.json accurately', () => {
    const updated = ServerConfigService.writeConfig({
      startCommand: 'java -Xms4G -Xmx8G -jar fabric.jar nogui',
      autoStart: true,
      scheduledRestartEnabled: true,
      scheduledRestartCron: '0 5 * * *'
    });

    expect(updated.startCommand).toBe('java -Xms4G -Xmx8G -jar fabric.jar nogui');
    expect(updated.autoStart).toBe(true);
    expect(updated.scheduledRestartEnabled).toBe(true);
    expect(updated.scheduledRestartCron).toBe('0 5 * * *');

    const read = ServerConfigService.readConfig();
    expect(read.startCommand).toBe(updated.startCommand);
    expect(read.autoStart).toBe(true);
  });
});
