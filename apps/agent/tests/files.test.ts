import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { FileService } from '../src/services/file.service.js';
import { SecurityError } from '../src/services/security.service.js';

describe('FileService - Safe Jailed File Operations', () => {
  const root = FileService.getServerRoot();

  it('lists files inside the server directory', () => {
    const list = FileService.listFiles('');
    expect(Array.isArray(list)).toBe(true);
  });

  it('writes and reads a configuration file', () => {
    const testFile = 'test-config.txt';
    const testContent = 'server-port=25565\nmotd=A Minecraft Server';

    FileService.writeFileContent(testFile, testContent, 'test-runner');
    const read = FileService.readFileContent(testFile);

    expect(read).toBe(testContent);

    // Clean up
    FileService.deleteFile(testFile, 'test-runner');
  });

  it('prohibits reading Floodgate key.pem directly', () => {
    // Create a mock key.pem inside server root
    const keyPath = path.join(root, 'key.pem');
    fs.writeFileSync(keyPath, '---SECRET PRIVATE KEY---', 'utf-8');

    expect(() => {
      FileService.readFileContent('key.pem');
    }).toThrow(SecurityError);

    fs.unlinkSync(keyPath);
  });
});
