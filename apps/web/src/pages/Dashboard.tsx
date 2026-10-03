import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { useWebSocket } from '../hooks/useWebSocket.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { ConfirmationDialog } from '../components/ConfirmationDialog.js';
import { AgentCard } from '../components/AgentCard.js';
import type { ServerHealthSummary, ServerState, ConsoleLine } from '@mc-panel/types';
import {
  Play,
  Square,
  RotateCw,
  Skull,
  Users,
  Clock,
  Cpu,
  Database,
  Terminal,
  Radio,
  Key,
  ShieldCheck,
  AlertTriangle,
  Package,
  FolderTree,
  Archive,
  Sliders,
  Activity,
  HardDrive
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const [health, setHealth] = useState<ServerHealthSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    action: () => Promise<void>;
    isDestructive: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    action: async () => {},
    isDestructive: false
  });

  const [miniLogs, setMiniLogs] = useState<ConsoleLine[]>([]);

  // Setup WebSocket live updates
  const { isConnected } = useWebSocket({
    onConsole: (line) => {
      setMiniLogs((prev) => [...prev.slice(-15), line]);
    },
    onStatus: (state, uptime) => {
      setHealth((prev) => (prev ? { ...prev, state, uptimeSeconds: uptime } : null));
    },
    onStats: (stats) => {
      setHealth((prev) => (prev ? { ...prev, stats } : null));
    },
    onPlayers: (players) => {
      setHealth((prev) => (prev ? { ...prev, playerCount: players.length } : null));
    }
  });

  const fetchStatus = async () => {
    try {
      const data = await api.getServerStatus();
      setHealth(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    api.getConsoleLogs(20).then((res) => setMiniLogs(res.logs)).catch(() => {});
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleStart = async () => {
    setActionLoading(true);
    try {
      await api.startServer();
      await fetchStatus();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to start server');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStop = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Stop Minecraft Server',
      message: 'Are you sure you want to gracefully stop the Minecraft server? Players will be safely disconnected and worlds saved.',
      isDestructive: true,
      action: async () => {
        setActionLoading(true);
        try {
          await api.stopServer();
          await fetchStatus();
        } finally {
          setActionLoading(false);
        }
      }
    });
  };

  const handleRestart = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Restart Minecraft Server',
      message: 'This will gracefully stop the server, wait for full shutdown, and start it again.',
      isDestructive: false,
      action: async () => {
        setActionLoading(true);
        try {
          await api.restartServer();
          await fetchStatus();
        } finally {
          setActionLoading(false);
        }
      }
    });
  };

  const handleKill = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Force Kill Minecraft Server',
      message: 'WARNING: Force killing the process may result in unsaved world chunks. Use this only if the server is frozen or unresponsive.',
      isDestructive: true,
      action: async () => {
        setActionLoading(true);
        try {
          await api.killServer();
          await fetchStatus();
        } finally {
          setActionLoading(false);
        }
      }
    });
  };

  const formatUptime = (seconds: number) => {
    if (seconds <= 0) return '0m';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  const state: ServerState = health?.state || 'OFFLINE';
  const isOnline = state === 'ONLINE';
  const isBusy = state === 'STARTING' || state === 'STOPPING' || actionLoading;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Persistent Outbound Agent Connection Card */}
      <AgentCard />

      {/* Top Banner & Quick Server Controls */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl md:text-2xl font-black tracking-tight text-white">MINECRAFT SERVER</h2>
            <StatusBadge state={state} />
            {isOnline && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" />
                {health?.tps ? `${health.tps.toFixed(1)} TPS` : '20.0 TPS'}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            MC {health?.minecraftVersion || '1.21.1'} • Fabric {health?.fabricVersion || '0.16.5'} • Windows Host
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {!isOnline && state !== 'STARTING' && (
            <button
              onClick={handleStart}
              disabled={isBusy}
              className="flex-1 md:flex-initial min-h-[48px] px-6 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-sm tracking-wide shadow-lg shadow-emerald-950/40 transition flex items-center justify-center gap-2.5 disabled:opacity-50"
            >
              <Play className="w-5 h-5 fill-white" />
              ▶ START
            </button>
          )}

          {isOnline && (
            <>
              <button
                onClick={handleRestart}
                disabled={isBusy}
                className="flex-1 md:flex-initial min-h-[48px] px-5 py-3.5 rounded-2xl bg-amber-600 hover:bg-amber-500 active:scale-95 text-white font-bold text-sm shadow-lg shadow-amber-950/40 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <RotateCw className="w-4 h-4" />
                🔄 RESTART
              </button>

              <button
                onClick={handleStop}
                disabled={isBusy}
                className="flex-1 md:flex-initial min-h-[48px] px-5 py-3.5 rounded-2xl bg-red-600 hover:bg-red-500 active:scale-95 text-white font-bold text-sm shadow-lg shadow-red-950/40 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Square className="w-4 h-4 fill-white" />
                ⏹ STOP
              </button>
            </>
          )}

          {(isOnline || state === 'STARTING' || state === 'STOPPING') && (
            <button
              onClick={handleKill}
              className="min-h-[48px] min-w-[48px] p-3.5 rounded-2xl bg-slate-800 hover:bg-red-600/20 text-slate-400 hover:text-red-400 border border-slate-700/60 transition flex items-center justify-center"
              title="Force Kill (Emergency)"
            >
              <Skull className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Metric Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
        {/* Players Card */}
        <div className="p-4 md:p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Players</span>
            <Users className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <span className="text-2xl font-black text-white">
              {health ? health.playerCount : 0}
            </span>
            <span className="text-sm font-semibold text-slate-500"> / {health?.maxPlayers || 20}</span>
          </div>
          <Link to="/players" className="text-[11px] text-emerald-400 hover:underline inline-block">
            Manage players →
          </Link>
        </div>

        {/* Uptime Card */}
        <div className="p-4 md:p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Uptime</span>
            <Clock className="w-4 h-4 text-sky-400" />
          </div>
          <div>
            <span className="text-2xl font-black text-white">
              {health ? formatUptime(health.uptimeSeconds) : '0m'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            PID: {health?.pid ? health.pid : 'Offline'}
          </p>
        </div>

        {/* CPU Card */}
        <div className="p-4 md:p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">CPU</span>
            <Cpu className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <span className="text-2xl font-black text-white">
              {health?.stats?.cpuPercent ?? 0}%
            </span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-amber-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, health?.stats?.cpuPercent || 0)}%` }}
            />
          </div>
        </div>

        {/* RAM Card */}
        <div className="p-4 md:p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">RAM Usage</span>
            <Database className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <span className="text-2xl font-black text-white">
              {health?.stats?.memoryUsedMb ? (health.stats.memoryUsedMb / 1024).toFixed(1) : '0.0'} GB
            </span>
            <span className="text-sm font-semibold text-slate-500">
              {' '}
              / {health?.stats?.memoryTotalMb ? (health.stats.memoryTotalMb / 1024).toFixed(0) : '4'} GB
            </span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-emerald-400 h-full rounded-full transition-all duration-500"
              style={{
                width: `${
                  health?.stats?.memoryUsedMb && health?.stats?.memoryTotalMb
                    ? Math.min(100, (health.stats.memoryUsedMb / health.stats.memoryTotalMb) * 100)
                    : 0
                }%`
              }}
            />
          </div>
        </div>

        {/* Disk Usage Card */}
        <div className="p-4 md:p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-3 col-span-2 md:col-span-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Disk Storage</span>
            <HardDrive className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <span className="text-2xl font-black text-white">
              {health?.stats?.diskFreeGb !== undefined ? `${health.stats.diskFreeGb} GB` : 'Free'}
            </span>
            <span className="text-sm font-semibold text-slate-500">
              {' '}
              / {health?.stats?.diskTotalGb !== undefined ? `${health.stats.diskTotalGb} GB` : 'Disk'}
            </span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-purple-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, health?.stats?.diskUsedPercent || 0)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Integration Badges Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-2xl flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 uppercase font-semibold">Fabric</p>
            <p className="text-xs font-bold text-white">
              {health?.fabricDetected ? 'Detected' : 'Standard'}
            </p>
          </div>
        </div>

        <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-2xl flex items-center gap-3">
          <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 uppercase font-semibold">GeyserMC</p>
            <p className="text-xs font-bold text-white">
              {health?.geyserDetected ? 'Ready (19132)' : 'Not Installed'}
            </p>
          </div>
        </div>

        <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-2xl flex items-center gap-3">
          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
            <Key className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 uppercase font-semibold">Floodgate</p>
            <p className="text-xs font-bold text-white">
              {health?.floodgateDetected ? 'Secured' : 'Not Installed'}
            </p>
          </div>
        </div>

        <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-2xl flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 uppercase font-semibold">Java Process</p>
            <p className="text-xs font-bold text-white">
              {isOnline ? 'Active' : 'Idle'}
            </p>
          </div>
        </div>
      </div>

      {/* Management Quick Cards Section */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
          Server Management
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Link
            to="/mods"
            className="p-4 bg-slate-900 hover:bg-slate-800/80 border border-slate-800 rounded-2xl flex flex-col items-center justify-center text-center gap-2 transition group shadow-md"
          >
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition">
              <Package className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-white">Mods</span>
            <span className="text-[10px] text-slate-400">Install & toggle</span>
          </Link>

          <Link
            to="/files"
            className="p-4 bg-slate-900 hover:bg-slate-800/80 border border-slate-800 rounded-2xl flex flex-col items-center justify-center text-center gap-2 transition group shadow-md"
          >
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 group-hover:scale-110 transition">
              <FolderTree className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-white">Files</span>
            <span className="text-[10px] text-slate-400">Server explorer</span>
          </Link>

          <Link
            to="/files"
            className="p-4 bg-slate-900 hover:bg-slate-800/80 border border-slate-800 rounded-2xl flex flex-col items-center justify-center text-center gap-2 transition group shadow-md"
          >
            <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400 group-hover:scale-110 transition">
              <Sliders className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-white">Config</span>
            <span className="text-[10px] text-slate-400">server.properties</span>
          </Link>

          <Link
            to="/backups"
            className="p-4 bg-slate-900 hover:bg-slate-800/80 border border-slate-800 rounded-2xl flex flex-col items-center justify-center text-center gap-2 transition group shadow-md"
          >
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 group-hover:scale-110 transition">
              <Archive className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-white">Backups</span>
            <span className="text-[10px] text-slate-400">Snapshots & restore</span>
          </Link>

          <Link
            to="/players"
            className="p-4 bg-slate-900 hover:bg-slate-800/80 border border-slate-800 rounded-2xl flex flex-col items-center justify-center text-center gap-2 transition group shadow-md"
          >
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition">
              <Users className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-white">Players</span>
            <span className="text-[10px] text-slate-400">OP, kick, ban</span>
          </Link>

          <Link
            to="/console"
            className="p-4 bg-slate-900 hover:bg-slate-800/80 border border-slate-800 rounded-2xl flex flex-col items-center justify-center text-center gap-2 transition group shadow-md"
          >
            <div className="p-2.5 rounded-xl bg-red-500/10 text-red-400 group-hover:scale-110 transition">
              <Terminal className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-white">Logs</span>
            <span className="text-[10px] text-slate-400">Real-time console</span>
          </Link>
        </div>
      </div>

      {/* Mini Console Preview */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Live Console Stream</h3>
          </div>
          <Link
            to="/console"
            className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition"
          >
            Open Interactive Console →
          </Link>
        </div>

        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800/80 font-mono text-xs space-y-1 h-48 overflow-y-auto">
          {miniLogs.length === 0 ? (
            <p className="text-slate-600 italic">No console logs yet...</p>
          ) : (
            miniLogs.map((log) => (
              <div key={log.id} className="leading-relaxed flex items-start gap-2">
                <span className="text-slate-600 shrink-0">[{log.timestamp}]</span>
                <span
                  className={
                    log.level === 'ERROR'
                      ? 'text-red-400'
                      : log.level === 'WARN'
                      ? 'text-amber-400'
                      : 'text-slate-300'
                  }
                >
                  {log.clean}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        isDestructive={confirmDialog.isDestructive}
        isLoading={actionLoading}
        onConfirm={async () => {
          await confirmDialog.action();
          setConfirmDialog((p) => ({ ...p, isOpen: false }));
        }}
        onCancel={() => setConfirmDialog((p) => ({ ...p, isOpen: false }))}
      />
    </div>
  );
};
