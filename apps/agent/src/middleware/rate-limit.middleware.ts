import type { Request, Response, NextFunction } from 'express';

interface AttemptRecord {
  attempts: number;
  lastAttempt: number;
  blockedUntil?: number;
}

const attemptsByIp = new Map<string, AttemptRecord>();

// Cleanup stale records periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of attemptsByIp.entries()) {
    if (now - record.lastAttempt > 15 * 60 * 1000) {
      attemptsByIp.delete(ip);
    }
  }
}, 5 * 60 * 1000);

export function loginRateLimiter(maxAttempts = 5, blockDurationMs = 5 * 60 * 1000) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown-ip';
    const now = Date.now();
    const record = attemptsByIp.get(ip);

    if (record && record.blockedUntil && now < record.blockedUntil) {
      const remainingSeconds = Math.ceil((record.blockedUntil - now) / 1000);
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Too many failed login attempts. Please wait ${remainingSeconds} seconds before trying again.`
        }
      });
      return;
    }

    next();
  };
}

export function recordFailedLogin(req: Request, maxAttempts = 5, blockDurationMs = 5 * 60 * 1000): void {
  const ip = req.ip || req.socket.remoteAddress || 'unknown-ip';
  const now = Date.now();
  const record = attemptsByIp.get(ip) || { attempts: 0, lastAttempt: now };

  record.attempts += 1;
  record.lastAttempt = now;

  if (record.attempts >= maxAttempts) {
    record.blockedUntil = now + blockDurationMs;
  }

  attemptsByIp.set(ip, record);
}

export function resetLoginAttempts(req: Request): void {
  const ip = req.ip || req.socket.remoteAddress || 'unknown-ip';
  attemptsByIp.delete(ip);
}
