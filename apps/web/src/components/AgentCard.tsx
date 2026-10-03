import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import {
  Laptop,
  Wifi,
  WifiOff,
  Activity,
  Plus,
  Copy,
  Check,
  RefreshCw,
  Trash2,
  Cpu,
  Clock,
  ShieldAlert,
  Server
} from 'lucide-react';

interface AgentItem {
  id: string;
  name: string;
  installationId: string;
  version: string;
  os: string;
  hostname: string;
  status: 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'UNKNOWN';
  lastSeen: string | null;
  lastSeenSecondsAgo: number | null;
  lastConnected: string | null;
  capabilities: Record<string, boolean>;
  createdAt: string;
}

interface DiagnosticsData {
  backend: 'CONNECTED' | 'DISCONNECTED';
  websocket: 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING' | 'RECONNECTING';
  authentication: 'VALID' | 'INVALID' | 'UNPAIRED';
  lastHeartbeatSecondsAgo: number | null;
  latencyMs: number | null;
  reconnectAttempts: number;
  agentVersion: string;
  minecraftState: string;
  watchdogActive: boolean;
  status: 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'UNKNOWN';
}

export const AgentCard: React.FC = () => {
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pairingModalOpen, setPairingModalOpen] = useState(false);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pairingExpiresIn, setPairingExpiresIn] = useState<number>(600);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedAgentDiag, setSelectedAgentDiag] = useState<{ id: string; diag: DiagnosticsData } | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);

  const fetchAgents = async () => {
    try {
      const res = await api.getAgents();
      setAgents(res.agents);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
    const interval = setInterval(fetchAgents, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleGeneratePairingCode = async () => {
    setGeneratingCode(true);
    try {
      const res = await api.generatePairingCode();
      setPairingCode(res.code);
      setPairingExpiresIn(res.expiresInSeconds);
      setPairingModalOpen(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not generate pairing code');
    } finally {
      setGeneratingCode(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenDiagnostics = async (agentId: string) => {
    setDiagLoading(true);
    try {
      const diag = await api.getAgentDiagnostics(agentId);
      setSelectedAgentDiag({ id: agentId, diag });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to retrieve diagnostics');
    } finally {
      setDiagLoading(false);
    }
  };

  const handleUnpair = async (agentId: string) => {
    if (!confirm('Are you sure you want to unpair this agent? You will need to pair it again to manage Minecraft.')) return;
    try {
      await api.unpairAgent(agentId);
      await fetchAgents();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to unpair agent');
    }
  };

  const primaryAgent = agents[0];

  return (
    <div className="space-y-4">
      {/* Agent Card Header / Status Container */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-slate-800 border border-slate-700/60 rounded-2xl text-emerald-400">
            <Laptop className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-base font-bold text-white">
                AGENT: {primaryAgent ? primaryAgent.name : 'No Agent Connected'}
              </h3>

              {primaryAgent ? (
                primaryAgent.status === 'ONLINE' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    🟢 ONLINE
                  </span>
                ) : primaryAgent.status === 'DEGRADED' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-bounce" />
                    🟡 RECONNECTING
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    🔴 OFFLINE
                  </span>
                )
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                  🔴 UNPAIRED
                </span>
              )}
            </div>

            <p className="text-xs text-slate-400 mt-1 flex items-center gap-3 flex-wrap">
              {primaryAgent ? (
                <>
                  <span>Version: v{primaryAgent.version}</span>
                  <span>•</span>
                  <span>OS: {primaryAgent.os}</span>
                  <span>•</span>
                  <span>
                    Last heartbeat:{' '}
                    {primaryAgent.lastSeenSecondsAgo !== null
                      ? `${primaryAgent.lastSeenSecondsAgo} sec ago`
                      : 'Never'}
                  </span>
                </>
              ) : (
                <span>Pair an agent on your Windows PC to manage your server without open ports or tunnels.</span>
              )}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
          {primaryAgent && (
            <>
              <button
                onClick={() => handleOpenDiagnostics(primaryAgent.id)}
                disabled={diagLoading}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition flex items-center gap-1.5"
              >
                <Activity className="w-3.5 h-3.5 text-sky-400" />
                Diagnostics
              </button>
              <button
                onClick={() => handleUnpair(primaryAgent.id)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition"
                title="Unpair Agent"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          <button
            onClick={handleGeneratePairingCode}
            disabled={generatingCode}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            Add / Pair Agent
          </button>
        </div>
      </div>

      {/* Pairing Modal */}
      {pairingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Laptop className="w-5 h-5 text-emerald-400" />
                Pair Windows Server Agent
              </h3>
              <button
                onClick={() => setPairingModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Open PowerShell or Command Prompt on your Windows PC in the server directory and run:
            </p>

            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-emerald-400 flex items-center justify-between">
              <span>agent.exe pair</span>
              <button
                onClick={() => copyToClipboard('agent.exe pair')}
                className="p-1 hover:text-white transition"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <p className="text-xs text-slate-400">
              When prompted by the CLI, enter this temporary, single-use pairing code:
            </p>

            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-center space-y-1">
              <span className="text-2xl font-black tracking-widest text-emerald-400 font-mono">
                {pairingCode}
              </span>
              <p className="text-[11px] text-slate-400">
                Single-use • Expires in {Math.floor(pairingExpiresIn / 60)} minutes
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setPairingModalOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Diagnostics Modal */}
      {selectedAgentDiag && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-sky-400" />
                Connection Diagnostics
              </h3>
              <button
                onClick={() => setSelectedAgentDiag(null)}
                className="text-slate-400 hover:text-white text-sm p-1"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                <span className="text-slate-400 text-[10px] uppercase font-semibold">Backend Control</span>
                <p className="font-bold text-emerald-400">{selectedAgentDiag.diag.backend}</p>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                <span className="text-slate-400 text-[10px] uppercase font-semibold">WebSocket Transport</span>
                <p className={`font-bold ${selectedAgentDiag.diag.websocket === 'CONNECTED' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {selectedAgentDiag.diag.websocket}
                </p>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                <span className="text-slate-400 text-[10px] uppercase font-semibold">Authentication</span>
                <p className="font-bold text-emerald-400">{selectedAgentDiag.diag.authentication}</p>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                <span className="text-slate-400 text-[10px] uppercase font-semibold">Latency</span>
                <p className="font-bold text-white">
                  {selectedAgentDiag.diag.latencyMs !== null ? `${selectedAgentDiag.diag.latencyMs} ms` : 'N/A'}
                </p>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                <span className="text-slate-400 text-[10px] uppercase font-semibold">Last Heartbeat</span>
                <p className="font-bold text-white">
                  {selectedAgentDiag.diag.lastHeartbeatSecondsAgo !== null
                    ? `${selectedAgentDiag.diag.lastHeartbeatSecondsAgo} sec ago`
                    : 'N/A'}
                </p>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                <span className="text-slate-400 text-[10px] uppercase font-semibold">Windows Watchdog</span>
                <p className="font-bold text-emerald-400">
                  {selectedAgentDiag.diag.watchdogActive ? 'ACTIVE' : 'INACTIVE'}
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs space-y-1 text-slate-300">
              <span className="text-slate-400 text-[10px] uppercase font-semibold block">Architecture Mode</span>
              <p>
                Persistent Outbound WSS: Agent initiates and holds outbound socket directly to Cloud Backend. No local-tunnel or router port-forwarding needed.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setSelectedAgentDiag(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
