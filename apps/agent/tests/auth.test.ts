import { describe, it, expect, beforeEach } from 'vitest';
import { UserRepository, SessionRepository } from '../src/database/repositories.js';
import { SecurityService } from '../src/services/security.service.js';

describe('Authentication & Database Repositories', () => {
  const testUsername = `admin_${Date.now()}`;
  let userId: string;

  it('creates and finds an admin user', async () => {
    const passwordHash = await SecurityService.hashPassword('adminPassword123');
    const user = UserRepository.create(testUsername, passwordHash);

    expect(user.id).toBeDefined();
    expect(user.username).toBe(testUsername);
    userId = user.id;

    const found = UserRepository.findByUsername(testUsername);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(user.id);
  });

  it('creates a session and finds by token hash', () => {
    const token = SecurityService.generateSessionToken();
    const tokenHash = SecurityService.hashToken(token);
    const expiresAt = new Date(Date.now() + 60000).toISOString();

    const session = SessionRepository.create(userId, tokenHash, expiresAt);
    expect(session.token_hash).toBe(tokenHash);

    const activeSession = SessionRepository.findByTokenHash(tokenHash);
    expect(activeSession).not.toBeNull();
    expect(activeSession?.user_id).toBe(userId);
    expect(activeSession?.username).toBe(testUsername);
  });

  it('rejects expired sessions', () => {
    const token = SecurityService.generateSessionToken();
    const tokenHash = SecurityService.hashToken(token);
    const expiredAt = new Date(Date.now() - 1000).toISOString(); // 1 second in the past

    SessionRepository.create(userId, tokenHash, expiredAt);
    const result = SessionRepository.findByTokenHash(tokenHash);
    expect(result).toBeNull();
  });

  it('deletes session on logout', () => {
    const token = SecurityService.generateSessionToken();
    const tokenHash = SecurityService.hashToken(token);
    const expiresAt = new Date(Date.now() + 60000).toISOString();

    SessionRepository.create(userId, tokenHash, expiresAt);
    SessionRepository.deleteByTokenHash(tokenHash);

    const lookup = SessionRepository.findByTokenHash(tokenHash);
    expect(lookup).toBeNull();
  });
});
