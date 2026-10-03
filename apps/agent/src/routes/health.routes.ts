import { Router, type Request, type Response } from 'express';
import { processManager } from '../services/process.service.js';
import { AgentHub } from '../services/agent-hub.service.js';
import { AgentRepository } from '../database/repositories.js';
import { AgentAuthManager } from '../services/agent-auth.service.js';

export const healthRouter = Router();

const sendHealth = (_req: Request, res: Response) => {
  const hub = AgentHub.getInstance();
  const agents = AgentRepository.list();
  const activeAgent = agents.find((a) => hub.isAgentOnline(a.id));

  let agentStatus = 'ONLINE';
  let lastSeenSecondsAgo: number | null = 0;

  if (activeAgent) {
    agentStatus = AgentAuthManager.computeAgentStatus(activeAgent.last_seen);
    lastSeenSecondsAgo = AgentAuthManager.getSecondsAgo(activeAgent.last_seen);
  } else if (agents.length > 0) {
    agentStatus = AgentAuthManager.computeAgentStatus(agents[0].last_seen);
    lastSeenSecondsAgo = AgentAuthManager.getSecondsAgo(agents[0].last_seen);
  }

  res.json({
    status: 'ok',
    success: true,
    data: {
      backend: 'ONLINE',
      agent: agentStatus,
      lastSeenSecondsAgo,
      registeredAgentsCount: agents.length,
      version: '1.0.0',
      serverState: processManager.getState(),
      timestamp: new Date().toISOString()
    }
  });
};

healthRouter.get('/health', sendHealth);
healthRouter.get('/status', sendHealth);
healthRouter.get('/ping', sendHealth);
healthRouter.get('/ready', sendHealth);
healthRouter.get('/', sendHealth);
