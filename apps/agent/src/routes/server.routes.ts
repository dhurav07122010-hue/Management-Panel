import { Router } from 'express';
import { z } from 'zod';
import { processManager } from '../services/process.service.js';
import { AgentHub } from '../services/agent-hub.service.js';
import { AgentRepository } from '../database/repositories.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.middleware.js';

export const serverRouter = Router();

// Apply authentication to all server routes
serverRouter.use(requireAuth);

const commandSchema = z.object({
  command: z.string().min(1, 'Command cannot be empty')
});

const playerActionSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  reason: z.string().optional()
});

serverRouter.get('/status', async (_req, res, next) => {
  try {
    const hub = AgentHub.getInstance();
    const agents = AgentRepository.list();
    const activeAgent = agents.find((a) => hub.isAgentOnline(a.id));

    if (activeAgent) {
      const session = hub.getConnectedAgent(activeAgent.id);
      const summary = await processManager.getHealthSummary();
      summary.state = session?.minecraftState || summary.state;
      res.json({
        success: true,
        data: summary
      });
      return;
    }

    const summary = await processManager.getHealthSummary();
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    next(error);
  }
});

serverRouter.post('/start', async (req: AuthenticatedRequest, res, next) => {
  try {
    const username = req.user?.username || 'admin';
    const hub = AgentHub.getInstance();
    const agents = AgentRepository.list();
    const activeAgent = agents.find((a) => hub.isAgentOnline(a.id));

    if (activeAgent) {
      const resp = await hub.dispatchCommand(activeAgent.id, 'minecraft.start', { username });
      res.json({
        success: resp.success,
        data: resp.result || { message: 'Server starting...' },
        error: resp.error
      });
      return;
    }

    await processManager.startServer(username);
    res.json({
      success: true,
      data: { message: 'Server starting...' }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: {
        code: 'START_FAILED',
        message: error instanceof Error ? error.message : 'Failed to start server'
      }
    });
  }
});

serverRouter.post('/stop', async (req: AuthenticatedRequest, res, next) => {
  try {
    const username = req.user?.username || 'admin';
    const hub = AgentHub.getInstance();
    const agents = AgentRepository.list();
    const activeAgent = agents.find((a) => hub.isAgentOnline(a.id));

    if (activeAgent) {
      const resp = await hub.dispatchCommand(activeAgent.id, 'minecraft.stop', { username });
      res.json({
        success: resp.success,
        data: resp.result || { message: 'Server stopping...' },
        error: resp.error
      });
      return;
    }

    await processManager.stopServer(username);
    res.json({
      success: true,
      data: { message: 'Server stopping...' }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: {
        code: 'STOP_FAILED',
        message: error instanceof Error ? error.message : 'Failed to stop server'
      }
    });
  }
});

serverRouter.post('/restart', async (req: AuthenticatedRequest, res, next) => {
  try {
    const username = req.user?.username || 'admin';
    const hub = AgentHub.getInstance();
    const agents = AgentRepository.list();
    const activeAgent = agents.find((a) => hub.isAgentOnline(a.id));

    if (activeAgent) {
      const resp = await hub.dispatchCommand(activeAgent.id, 'minecraft.restart', { username });
      res.json({
        success: resp.success,
        data: resp.result || { message: 'Server restarting...' },
        error: resp.error
      });
      return;
    }

    await processManager.restartServer(username);
    res.json({
      success: true,
      data: { message: 'Server restarting...' }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: {
        code: 'RESTART_FAILED',
        message: error instanceof Error ? error.message : 'Failed to restart server'
      }
    });
  }
});

serverRouter.post('/kill', async (req: AuthenticatedRequest, res) => {
  const username = req.user?.username || 'admin';
  const hub = AgentHub.getInstance();
  const agents = AgentRepository.list();
  const activeAgent = agents.find((a) => hub.isAgentOnline(a.id));

  if (activeAgent) {
    await hub.dispatchCommand(activeAgent.id, 'minecraft.kill', { username });
    res.json({
      success: true,
      data: { message: 'Server forcefully terminated.' }
    });
    return;
  }

  processManager.killServer(username);
  res.json({
    success: true,
    data: { message: 'Server forcefully terminated.' }
  });
});

serverRouter.get('/players', (_req, res) => {
  res.json({
    success: true,
    data: {
      players: processManager.getPlayers()
    }
  });
});

serverRouter.post('/command', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { command } = commandSchema.parse(req.body);
    const username = req.user?.username || 'admin';
    const hub = AgentHub.getInstance();
    const agents = AgentRepository.list();
    const activeAgent = agents.find((a) => hub.isAgentOnline(a.id));

    if (activeAgent) {
      const resp = await hub.dispatchCommand(activeAgent.id, 'minecraft.command', { command });
      res.json({
        success: resp.success,
        data: resp.result || { message: 'Command dispatched to server.' },
        error: resp.error
      });
      return;
    }

    const sent = processManager.sendCommand(command, username);
    if (!sent) {
      res.status(400).json({
        success: false,
        error: {
          code: 'COMMAND_NOT_SENT',
          message: 'Server is not running or command could not be dispatched.'
        }
      });
      return;
    }
    res.json({
      success: true,
      data: { message: 'Command dispatched to server.' }
    });
  } catch (error) {
    next(error);
  }
});

// Player management shortcuts that execute standard Minecraft commands
serverRouter.post('/players/op', (req: AuthenticatedRequest, res, next) => {
  try {
    const { username } = playerActionSchema.parse(req.body);
    processManager.sendCommand(`op ${username}`, req.user?.username);
    res.json({ success: true, data: { message: `Operator granted to ${username}` } });
  } catch (error) {
    next(error);
  }
});

serverRouter.post('/players/deop', (req: AuthenticatedRequest, res, next) => {
  try {
    const { username } = playerActionSchema.parse(req.body);
    processManager.sendCommand(`deop ${username}`, req.user?.username);
    res.json({ success: true, data: { message: `Operator removed from ${username}` } });
  } catch (error) {
    next(error);
  }
});

serverRouter.post('/players/kick', (req: AuthenticatedRequest, res, next) => {
  try {
    const { username, reason } = playerActionSchema.parse(req.body);
    const cmd = reason ? `kick ${username} ${reason}` : `kick ${username}`;
    processManager.sendCommand(cmd, req.user?.username);
    res.json({ success: true, data: { message: `Player ${username} kicked.` } });
  } catch (error) {
    next(error);
  }
});

serverRouter.post('/players/ban', (req: AuthenticatedRequest, res, next) => {
  try {
    const { username, reason } = playerActionSchema.parse(req.body);
    const cmd = reason ? `ban ${username} ${reason}` : `ban ${username}`;
    processManager.sendCommand(cmd, req.user?.username);
    res.json({ success: true, data: { message: `Player ${username} banned.` } });
  } catch (error) {
    next(error);
  }
});

serverRouter.post('/players/pardon', (req: AuthenticatedRequest, res, next) => {
  try {
    const { username } = playerActionSchema.parse(req.body);
    processManager.sendCommand(`pardon ${username}`, req.user?.username);
    res.json({ success: true, data: { message: `Player ${username} pardoned.` } });
  } catch (error) {
    next(error);
  }
});

serverRouter.post('/players/whitelist', (req: AuthenticatedRequest, res, next) => {
  try {
    const body = z.object({ username: z.string().min(1), action: z.enum(['add', 'remove']) }).parse(req.body);
    processManager.sendCommand(`whitelist ${body.action} ${body.username}`, req.user?.username);
    res.json({ success: true, data: { message: `Whitelist ${body.action} for ${body.username}` } });
  } catch (error) {
    next(error);
  }
});

serverRouter.get('/console', (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 200;
  res.json({
    success: true,
    data: {
      logs: processManager.getConsoleBuffer(limit)
    }
  });
});

serverRouter.delete('/console', (_req, res) => {
  processManager.clearConsoleBuffer();
  res.json({
    success: true,
    data: { message: 'Console buffer cleared.' }
  });
});
