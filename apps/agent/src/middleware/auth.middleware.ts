import type { Request, Response, NextFunction } from 'express';
import { SessionRepository } from '../database/repositories.js';
import { SecurityService } from '../services/security.service.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
  };
  sessionToken?: string;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  let token: string | null = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.query.token && typeof req.query.token === 'string') {
    // For WS handshakes or direct downloads
    token = req.query.token;
  }

  if (!token) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication token required.'
      }
    });
    return;
  }

  try {
    const tokenHash = SecurityService.hashToken(token);
    const session = SessionRepository.findByTokenHash(tokenHash);

    if (!session) {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_SESSION',
          message: 'Session has expired or is invalid.'
        }
      });
      return;
    }

    req.user = {
      id: session.user_id,
      username: session.username
    };
    req.sessionToken = token;

    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error verifying session'
      }
    });
  }
}
