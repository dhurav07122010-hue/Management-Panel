import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { SecurityService, SecurityError } from '../src/services/security.service.js';

describe('SecurityService - Path Traversal Protection', () => {
  const baseDir = path.resolve(process.cwd(), 'test-jail');

  it('allows paths strictly inside the base directory', () => {
    const validSubPath = 'config/server.properties';
    const resolved = SecurityService.resolveSafePath(baseDir, validSubPath);
    expect(resolved).toBe(path.join(baseDir, 'config', 'server.properties'));
  });

  it('allows the base directory itself', () => {
    const resolved = SecurityService.resolveSafePath(baseDir, '');
    expect(resolved).toBe(baseDir);
  });

  it('blocks classic ../ traversal attacks', () => {
    expect(() => {
      SecurityService.resolveSafePath(baseDir, '../../Windows/System32/cmd.exe');
    }).toThrow(SecurityError);
  });

  it('blocks Windows backslash ..\\ traversal attacks', () => {
    expect(() => {
      SecurityService.resolveSafePath(baseDir, '..\\..\\Windows');
    }).toThrow(SecurityError);
  });

  it('blocks absolute paths escaping the jail', () => {
    expect(() => {
      SecurityService.resolveSafePath(baseDir, 'C:\\Windows\\System32');
    }).toThrow(SecurityError);
  });

  it('blocks null byte poisoning', () => {
    expect(() => {
      SecurityService.resolveSafePath(baseDir, 'config/server.properties\0.evil');
    }).toThrow(SecurityError);
  });

  it('blocks URL-encoded traversal sequences (%2e%2e)', () => {
    expect(() => {
      SecurityService.resolveSafePath(baseDir, '%2e%2e%2f%2e%2e%2fWindows');
    }).toThrow(SecurityError);
  });
});

describe('SecurityService - Password & Token Hashing', () => {
  it('hashes and validates passwords securely', async () => {
    const password = 'SuperSecretPassword123!';
    const hash = await SecurityService.hashPassword(password);

    expect(hash).not.toBe(password);
    expect(hash.startsWith('$2')).toBe(true);

    const valid = await SecurityService.verifyPassword(password, hash);
    expect(valid).toBe(true);

    const invalid = await SecurityService.verifyPassword('WrongPassword', hash);
    expect(invalid).toBe(false);
  });

  it('generates secure random session tokens and produces consistent hashes', () => {
    const token = SecurityService.generateSessionToken();
    expect(token).toHaveLength(64);

    const hash1 = SecurityService.hashToken(token);
    const hash2 = SecurityService.hashToken(token);
    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(token);
  });
});
