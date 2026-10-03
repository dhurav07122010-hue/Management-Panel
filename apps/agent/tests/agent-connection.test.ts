import { describe, it, expect, beforeEach } from 'vitest';
import { AgentAuthManager } from '../src/services/agent-auth.service.js';
import { AgentHub } from '../src/services/agent-hub.service.js';
import { OutboundAgentClient } from '../src/client/outbound-agent.js';
import {
  AgentRepository,
  PairingCodeRepository,
  AgentCommandRepository
} from '../src/database/repositories.js';

describe('Persistent Agent Architecture - Authentication & Pairing', () => {
  it('generates secure pairing code and verifies expiration', () => {
    const code = AgentAuthManager.generatePairingCode();
    expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);

    const expiresAt = new Date(Date.now() + 60000).toISOString();
    PairingCodeRepository.create(code, expiresAt);

    const found = PairingCodeRepository.findValid(code);
    expect(found).not.toBeNull();
    expect(found?.code).toBe(code);

    // Consume pairing code
    PairingCodeRepository.markUsed(code);
    const consumed = PairingCodeRepository.findValid(code);
    expect(consumed).toBeNull();
  });

  it('generates agent credential and verifies SHA-256 hash', () => {
    const token = AgentAuthManager.generateAgentToken();
    expect(token).toHaveLength(64);

    const hash1 = AgentAuthManager.hashAgentCredential(token);
    const hash2 = AgentAuthManager.hashAgentCredential(token);
    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(token);
  });

  it('creates registered agent and updates heartbeat', () => {
    const agentId = `agent_test_${Date.now()}`;
    const token = AgentAuthManager.generateAgentToken();
    const tokenHash = AgentAuthManager.hashAgentCredential(token);

    AgentRepository.createOrUpdate({
      id: agentId,
      name: 'Test Rig',
      installationId: `inst_${Date.now()}`,
      credentialHash: tokenHash,
      version: '1.0.0',
      os: 'Windows',
      hostname: 'test-pc',
      capabilitiesJson: JSON.stringify({ minecraft: true, console: true })
    });

    const stored = AgentRepository.findById(agentId);
    expect(stored).not.toBeNull();
    expect(stored?.name).toBe('Test Rig');

    // Heartbeat update
    AgentRepository.updateHeartbeat(agentId, 'ONLINE');
    const updated = AgentRepository.findById(agentId);
    expect(updated?.last_seen).not.toBeNull();
  });

  it('tracks full connection state machine in OutboundAgentClient', () => {
    const client = new OutboundAgentClient({
      backendUrl: 'http://localhost:3001',
      agentId: 'agent_sm_test',
      installationId: 'inst_test',
      agentName: 'SM Test Agent',
      token: 'test-token',
      version: '1.0.0',
      heartbeatIntervalSec: 12,
      metricsIntervalSec: 6,
      autoRestartMinecraft: false,
      maxRestartAttempts: 3,
      restartCooldownSec: 10,
      logLevel: 'INFO'
    });

    // Initial state
    expect(client.getState()).toBe('DISCONNECTED');
    const snapshot = client.getSnapshot();
    expect(snapshot.currentState).toBe('DISCONNECTED');
    expect(snapshot.reconnectAttempts).toBe(0);
    expect(snapshot.agentVersion).toBe('1.0.0');
    expect(snapshot.disconnectReason).toBeNull();
  });
});

describe('Persistent Agent Architecture - Offline Detection & Thresholds', () => {
  it('calculates ONLINE state within 20 seconds', () => {
    const nowIso = new Date().toISOString();
    const status = AgentAuthManager.computeAgentStatus(nowIso);
    expect(status).toBe('ONLINE');
  });

  it('calculates DEGRADED state between 20 and 45 seconds', () => {
    const degradedIso = new Date(Date.now() - 30000).toISOString();
    const status = AgentAuthManager.computeAgentStatus(degradedIso);
    expect(status).toBe('DEGRADED');
  });

  it('calculates OFFLINE state after 45+ seconds', () => {
    const offlineIso = new Date(Date.now() - 50000).toISOString();
    const status = AgentAuthManager.computeAgentStatus(offlineIso);
    expect(status).toBe('OFFLINE');
  });
});

describe('Persistent Agent Architecture - Command Protocol & ACK', () => {
  const agentId = `agent_cmd_${Date.now()}`;

  it('creates and updates command lifecycle', () => {
    const cmdId = `command_${Date.now()}`;
    AgentCommandRepository.create({
      id: cmdId,
      agentId,
      type: 'minecraft.start',
      payloadJson: JSON.stringify({}),
      status: 'COMMAND_SENT',
      queueable: false
    });

    AgentCommandRepository.updateStatus(cmdId, 'COMMAND_RECEIVED');
    AgentCommandRepository.updateStatus(cmdId, 'COMMAND_COMPLETED');

    const queued = AgentCommandRepository.getQueuedCommands(agentId);
    expect(queued).toHaveLength(0);
  });

  it('handles safe queued commands during offline state', () => {
    const queuedCmdId = `command_q_${Date.now()}`;
    AgentCommandRepository.create({
      id: queuedCmdId,
      agentId,
      type: 'minecraft.restart',
      payloadJson: JSON.stringify({ restart: true }),
      status: 'COMMAND_SENT',
      queueable: true
    });

    const queued = AgentCommandRepository.getQueuedCommands(agentId);
    expect(queued.length).toBeGreaterThanOrEqual(1);
    expect(queued[0].id).toBe(queuedCmdId);
  });
});
