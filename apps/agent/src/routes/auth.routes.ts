import { Router } from 'express';
import { z } from 'zod';
import { UserRepository, SessionRepository, AuditLogRepository } from '../database/repositories.js';
import { SecurityService } from '../services/security.service.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { loginRateLimiter, recordFailedLogin, resetLoginAttempts } from '../middleware/rate-limit.middleware.js';

export const authRouter = Router();

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required')
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters long')
});

authRouter.post('/login', loginRateLimiter(), async (req, res, next) => {
  try {
    const { username, password } = loginSchema.parse(req.body);

    const user = UserRepository.findByUsername(username);
    if (!user) {
      recordFailedLogin(req);
      AuditLogRepository.create(username, 'LOGIN_FAILED', 'User not found', undefined, req.ip);
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid username or password.'
        }
      });
      return;
    }

    const isValid = await SecurityService.verifyPassword(password, user.password_hash);
    if (!isValid) {
      recordFailedLogin(req);
      AuditLogRepository.create(username, 'LOGIN_FAILED', 'Incorrect password', user.id, req.ip);
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid username or password.'
        }
      });
      return;
    }

    resetLoginAttempts(req);

    // Create session token valid for 7 days
    const token = SecurityService.generateSessionToken();
    const tokenHash = SecurityService.hashToken(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'] as string | undefined;

    SessionRepository.create(user.id, tokenHash, expiresAt, ipAddress, userAgent);
    AuditLogRepository.create(user.username, 'LOGIN_SUCCESS', 'User logged in', user.id, ipAddress);

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          createdAt: user.created_at
        },
        expiresAt
      }
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/logout', requireAuth, (req: AuthenticatedRequest, res) => {
  if (req.sessionToken) {
    const tokenHash = SecurityService.hashToken(req.sessionToken);
    SessionRepository.deleteByTokenHash(tokenHash);
  }
  if (req.user) {
    AuditLogRepository.create(req.user.username, 'LOGOUT', 'User logged out', req.user.id, req.ip);
  }
  res.json({
    success: true,
    data: { message: 'Logged out successfully.' }
  });
});

authRouter.get('/me', requireAuth, (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
    return;
  }
  const user = UserRepository.findById(req.user.id);
  if (!user) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    return;
  }
  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        username: user.username,
        createdAt: user.created_at
      }
    }
  });
});

authRouter.post('/logout-all', requireAuth, (req: AuthenticatedRequest, res) => {
  if (req.user) {
    SessionRepository.deleteAllForUser(req.user.id);
    AuditLogRepository.create(req.user.username, 'LOGOUT_ALL', 'All sessions invalidated', req.user.id, req.ip);
  }
  res.json({
    success: true,
    data: { message: 'All active sessions have been invalidated.' }
  });
});

authRouter.post('/change-password', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    if (!req.user) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
      return;
    }

    const user = UserRepository.findById(req.user.id);
    if (!user) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
      return;
    }

    const isValid = await SecurityService.verifyPassword(currentPassword, user.password_hash);
    if (!isValid) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PASSWORD',
          message: 'Current password does not match.'
        }
      });
      return;
    }

    const newHash = await SecurityService.hashPassword(newPassword);
    UserRepository.updatePassword(user.id, newHash);

    // Invalidate all sessions except possibly current or all as per Section 55
    SessionRepository.deleteAllForUser(user.id);

    AuditLogRepository.create(user.username, 'PASSWORD_CHANGE', 'Password updated successfully', user.id, req.ip);

    res.json({
      success: true,
      data: { message: 'Password changed successfully. Please log in with your new password.' }
    });
  } catch (error) {
    next(error);
  }
});
