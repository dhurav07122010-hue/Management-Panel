import { Router } from 'express';
import { processManager } from '../services/process.service.js';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      agent: 'ONLINE',
      version: '1.0.0',
      serverState: processManager.getState(),
      timestamp: new Date().toISOString()
    }
  });
});
