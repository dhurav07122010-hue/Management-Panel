import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { useWebSocket } from '../hooks/useWebSocket.js';
import { ConfirmationDialog } from '../components/ConfirmationDialog.js';
import type { PlayerInfo } from '@mc-panel/types';
import {
  Users,
  Shield,
  ShieldOff,
  UserX,
  Ban,
  CheckCircle,
  Clock,
  Search,
  Plus
} from 'lucide-react';

export const Players: React.FC = () => {
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [whitelistInput, setWhitelistInput] = useState('');

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

  useWebSocket({
    onPlayers: (newPlayers) => {
      setPlayers(newPlayers);
    }
  });

  const fetchPlayers = async () => {
    try {
      const res = await api.getPlayers();
      setPlayers(res.players);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlayers();
  }, []);

  const handleOp = (username: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Grant Operator (OP)',
      message: `Are you sure you want to make ${username} a server operator with full administrative commands?`,
      isDestructive: false,
      action: async () => {
        setActionLoading(true);
        try {
          await api.opPlayer(username);
          await fetchPlayers();
        } finally {
          setActionLoading(false);
        }
      }
    });
  };

  const handleDeop = (username: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Remove Operator (DEOP)',
      message: `Revoke server operator status from ${username}?`,
      isDestructive: true,
      action: async () => {
        setActionLoading(true);
        try {
          await api.deopPlayer(username);
          await fetchPlayers();
        } finally {
          setActionLoading(false);
        }
      }
    });
  };

  const handleKick = (username: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Kick Player',
      message: `Are you sure you want to disconnect ${username} from the server?`,
      isDestructive: true,
      action: async () => {
        setActionLoading(true);
        try {
          await api.kickPlayer(username, 'Kicked by administrator');
          await fetchPlayers();
        } finally {
          setActionLoading(false);
        }
      }
    });
  };

  const handleBan = (username: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Ban Player',
      message: `Are you sure you want to permanently ban ${username} from joining the server?`,
      isDestructive: true,
      action: async () => {
        setActionLoading(true);
        try {
          await api.banPlayer(username, 'Banned by administrator');
          await fetchPlayers();
        } finally {
          setActionLoading(false);
        }
      }
    });
  };

  const handleAddWhitelist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!whitelistInput.trim()) return;
    try {
      await api.whitelistPlayer(whitelistInput.trim(), 'add');
      setWhitelistInput('');
      await fetchPlayers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error adding to whitelist');
    }
  };

  const filteredPlayers = players.filter((p) =>
    p.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl">
        <div>
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-emerald-400" />
            <h2 className="text-xl font-bold text-white">PLAYER MANAGEMENT</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            View active players, assign operator permissions, and manage access.
          </p>
        </div>

        {/* Add to Whitelist Form */}
        <form onSubmit={handleAddWhitelist} className="flex items-center gap-2 w-full md:w-auto">
          <input
            type="text"
            value={whitelistInput}
            onChange={(e) => setWhitelistInput(e.target.value)}
            placeholder="Username to whitelist..."
            className="px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500 flex-1 md:w-48"
          />
          <button
            type="submit"
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-semibold text-white transition flex items-center gap-1 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Whitelist
          </button>
        </form>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter players by username..."
          className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-2xl text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500"
        />
      </div>

      {/* Player List */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Active Players ({filteredPlayers.length})</span>
        </div>

        {filteredPlayers.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            {loading ? 'Loading player roster...' : 'No players currently online.'}
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {filteredPlayers.map((player) => (
              <div
                key={player.username}
                className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-slate-800/40 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700/60 flex items-center justify-center font-bold text-sm text-emerald-400">
                    {player.username.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{player.username}</span>
                      {player.isOp && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          OP
                        </span>
                      )}
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    </div>
                    <p className="text-[11px] text-slate-500 font-mono truncate max-w-xs">
                      {player.uuid || 'Offline/Bedrock UUID'}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-end">
                  {player.isOp ? (
                    <button
                      onClick={() => handleDeop(player.username)}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-medium transition flex items-center gap-1.5"
                      title="Revoke OP"
                    >
                      <ShieldOff className="w-3.5 h-3.5" />
                      Deop
                    </button>
                  ) : (
                    <button
                      onClick={() => handleOp(player.username)}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition flex items-center gap-1.5"
                      title="Grant OP"
                    >
                      <Shield className="w-3.5 h-3.5" />
                      Make OP
                    </button>
                  )}

                  <button
                    onClick={() => handleKick(player.username)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-red-500/10 hover:text-red-400 text-slate-300 text-xs font-medium transition flex items-center gap-1.5"
                  >
                    <UserX className="w-3.5 h-3.5" />
                    Kick
                  </button>

                  <button
                    onClick={() => handleBan(player.username)}
                    className="px-3 py-1.5 rounded-xl bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white text-xs font-medium transition flex items-center gap-1.5 border border-red-500/20"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    Ban
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
