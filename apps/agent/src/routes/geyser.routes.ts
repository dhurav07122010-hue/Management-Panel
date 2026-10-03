import { Router } from 'express';
import { GeyserService } from '../services/geyser.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export const geyserRouter = Router();
geyserRouter.use(requireAuth);

geyserRouter.get('/geyser/status', (_req, res) => {
  const status = GeyserService.getGeyserStatus();
  res.json({
    success: true,
    data: status
  });
});

geyserRouter.get('/floodgate/status', (_req, res) => {
  const status = GeyserService.getFloodgateStatus();
  res.json({
    success: true,
    data: status
  });
});
