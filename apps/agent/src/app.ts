import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'node:path';
import fs from 'node:fs';
import { healthRouter } from './routes/health.routes.js';
import { setupRouter } from './routes/setup.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { serverRouter } from './routes/server.routes.js';
import { modsRouter } from './routes/mods.routes.js';
import { filesRouter } from './routes/files.routes.js';
import { backupsRouter } from './routes/backups.routes.js';
import { geyserRouter } from './routes/geyser.routes.js';
import { agentRouter } from './routes/agent.routes.js';
import { settingsRouter } from './routes/settings.routes.js';
import { errorHandler } from './middleware/error.middleware.js';

export function createApp(): express.Application {
  const app = express();

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: false, // allow local assets and websocket connections smoothly
      crossOriginEmbedderPolicy: false
    })
  );

  // CORS for dev frontend access
  app.use(
    cors({
      origin: true,
      credentials: true
    })
  );

  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  // Mount API endpoints
  app.use('/health', healthRouter);
  app.use('/status', healthRouter);
  app.use('/ping', healthRouter);
  app.use('/agent', healthRouter);
  app.use('/api/agent', healthRouter);
  app.use('/api', healthRouter);
  app.use('/api/setup', setupRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/agents', agentRouter);
  app.use('/api/server', serverRouter);
  app.use('/api/mods', modsRouter);
  app.use('/api/files', filesRouter);
  app.use('/api/backups', backupsRouter);
  app.use('/api', geyserRouter);
  app.use('/api/settings', settingsRouter);

  // 404 handler for API routes (always return JSON, never HTML)
  app.all('/api/*', (_req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Endpoint not found on Server Agent'
      }
    });
  });

  // Serve production build of web frontend if it exists
  const candidateWebPaths = [
    path.resolve(process.cwd(), 'apps/web/dist'),
    path.resolve(process.cwd(), '../web/dist'),
    path.resolve(process.cwd(), 'web/dist')
  ];
  const webDistPath = candidateWebPaths.find((p) => fs.existsSync(p));
  if (webDistPath) {
    app.use(express.static(webDistPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
        return next();
      }
      res.sendFile(path.join(webDistPath, 'index.html'));
    });
  }

  // Central error handling
  app.use(errorHandler);

  return app;
}
