import { Router, type Request, type Response } from 'express';
import { processManager } from '../services/process.service.js';
import { TunnelService } from '../services/tunnel.service.js';

export const healthRouter = Router();

const sendHealth = (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      agent: 'ONLINE',
      version: '1.0.0',
      serverState: processManager.getState(),
      tunnelUrl: TunnelService.getTunnelUrl(),
      timestamp: new Date().toISOString()
    }
  });
};

healthRouter.get('/health', sendHealth);
healthRouter.get('/status', sendHealth);
healthRouter.get('/ping', sendHealth);
healthRouter.get('/', sendHealth);

