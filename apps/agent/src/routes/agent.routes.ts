import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import {
  AgentRepository,
  PairingCodeRepository,
  AuditLogRepository
} from '../database/repositories.js';
import { AgentAuthManager } from '../services/agent-auth.service.js';
import { AgentHub } from '../services/agent-hub.service.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.middleware.js';

export const agentRouter = Router();

const pairingSchema = z.object({
  code: z.string().min(4),
  name: z.string().optional().default('Gaming PC'),
  installationId: z.string().min(1),
  version: z.string().optional().default('1.0.0'),
  os: z.string().optional().default('Windows'),
  hostname: z.string().optional().default('localhost'),
  capabilities: z.object({
    minecraft: z.boolean().default(true),
    files: z.boolean().default(true),
    mods: z.boolean().default(true),
    console: z.boolean().default(true),
    systemStats: z.boolean().default(true),
    serverControl: z.boolean().default(true)
  }).optional()
});

/**
 * Public agent pairing endpoint: Local agent calls this with pairing code.
 * POST /api/agents/pair
 */
agentRouter.post('/pair', async (req: Request, res: Response) => {
  try {
    const body = pairingSchema.parse(req.body);
    const pairing = PairingCodeRepository.findValid(body.code.trim().toUpperCase());

    if (!pairing) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PAIRING_CODE',
          message: 'Pairing code is invalid, expired, or has already been used.'
        }
      });
      return;
    }

    // Single-use code consumed
    PairingCodeRepository.markUsed(pairing.code);

    const agentId = pairing.agent_id || `agent_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
    const secretToken = AgentAuthManager.generateAgentToken();
    const tokenHash = AgentAuthManager.hashAgentCredential(secretToken);

    const capabilities = body.capabilities || {
      minecraft: true,
      files: true,
      mods: true,
      console: true,
      systemStats: true,
      serverControl: true
    };

    AgentRepository.createOrUpdate({
      id: agentId,
      name: body.name || 'Windows Host Agent',
      installationId: body.installationId,
      credentialHash: tokenHash,
      version: body.version || '1.0.0',
      os: body.os || 'Windows',
      hostname: body.hostname || 'localhost',
      capabilitiesJson: JSON.stringify(capabilities)
    });

    AuditLogRepository.create(
      'system',
      'AGENT_PAIRED',
      `Paired agent ${agentId} (${body.name})`,
      agentId,
      req.ip
    );

    res.json({
      success: true,
      data: {
        agentId,
        token: secretToken,
        name: body.name,
        capabilities
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: {
        code: 'PAIRING_FAILED',
        message: error instanceof Error ? error.message : 'Agent pairing failed'
      }
    });
  }
});

/**
 * Web user generates single-use pairing code:
 * POST /api/agents/generate-pairing-code
 */
agentRouter.post('/generate-pairing-code', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  try {
    PairingCodeRepository.cleanExpired();
    const code = AgentAuthManager.generatePairingCode();
    // Valid for 10 minutes
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    PairingCodeRepository.create(code, expiresAt);

    res.json({
      success: true,
      data: {
        code,
        expiresAt,
        expiresInSeconds: 600
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'CODE_GEN_ERROR',
        message: error instanceof Error ? error.message : 'Could not generate pairing code'
      }
    });
  }
});

/**
 * List all registered agents with real-time computed status:
 * GET /api/agents
 */
agentRouter.get('/', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  try {
    const agents = AgentRepository.list();
    const result = agents.map((a) => {
      const computedStatus = AgentAuthManager.computeAgentStatus(a.last_seen);
      const secondsAgo = AgentAuthManager.getSecondsAgo(a.last_seen);
      let capabilities = {};
      try {
        capabilities = JSON.parse(a.capabilities_json);
      } catch {}

      return {
        id: a.id,
        name: a.name,
        installationId: a.installation_id,
        version: a.version,
        os: a.os,
        hostname: a.hostname,
        status: computedStatus,
        lastSeen: a.last_seen,
        lastSeenSecondsAgo: secondsAgo,
        lastConnected: a.last_connected,
        capabilities,
        createdAt: a.created_at
      };
    });

    res.json({
      success: true,
      data: { agents: result }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'AGENT_LIST_ERROR',
        message: error instanceof Error ? error.message : 'Could not list agents'
      }
    });
  }
});

/**
 * Get diagnostics for a specific agent:
 * GET /api/agents/:id/diagnostics
 */
agentRouter.get('/:id/diagnostics', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const hub = AgentHub.getInstance();
    const diagnostics = hub.getDiagnostics(req.params.id);
    res.json({
      success: true,
      data: diagnostics
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'DIAGNOSTICS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to retrieve diagnostics'
      }
    });
  }
});

/**
 * Dispatch a command to an agent from Web UI:
 * POST /api/agents/:id/command
 */
agentRouter.post('/:id/command', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { type, payload, timeoutMs, queueable } = req.body;
    if (!type) {
      res.status(400).json({ success: false, error: { code: 'INVALID_COMMAND', message: 'Command type is required' } });
      return;
    }

    const hub = AgentHub.getInstance();
    const response = await hub.dispatchCommand(req.params.id, type, payload, { timeoutMs, queueable });

    res.json({
      success: response.success,
      data: response.result || response,
      error: response.error
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'DISPATCH_ERROR',
        message: error instanceof Error ? error.message : 'Failed to dispatch command'
      }
    });
  }
});

/**
 * Unpair an agent:
 * DELETE /api/agents/:id
 */
agentRouter.delete('/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    AgentRepository.delete(req.params.id);
    AuditLogRepository.create(
      req.user?.username || 'admin',
      'AGENT_UNPAIRED',
      `Unpaired agent ${req.params.id}`,
      req.params.id,
      req.ip
    );
    res.json({
      success: true,
      data: { message: 'Agent unpaired successfully' }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'UNPAIR_ERROR',
        message: error instanceof Error ? error.message : 'Could not unpair agent'
      }
    });
  }
});
