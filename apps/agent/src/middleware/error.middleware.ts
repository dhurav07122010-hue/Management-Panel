import type { Request, Response, NextFunction } from 'express';
import { SecurityError } from '../services/security.service.js';
import { ZodError } from 'zod';

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  // Never leak internal stack traces to the client
  console.error('[API Error]:', err);

  if (err instanceof SecurityError) {
    res.status(403).json({
      success: false,
      error: {
        code: err.code,
        message: err.message
      }
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Invalid request data provided.',
        details: err.errors
      }
    });
    return;
  }

  const message = err instanceof Error ? err.message : 'An unexpected internal error occurred.';
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message
    }
  });
}
