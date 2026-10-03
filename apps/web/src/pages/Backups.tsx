import React, { useState, useEffect } from 'react';
import { api, getAuthToken, getAgentBaseUrl } from '../services/api.js';
import { ConfirmationDialog } from '../components/ConfirmationDialog.js';
import type { BackupRecord } from '@mc-panel/types';
import {
  Archive,
  Download,
  RotateCcw,
  Trash2,
  Plus,
  Clock,
  HardDrive,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  FileCheck
} from 'lucide-react';

export const Backups: React.FC = () => {
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [backupNote, setBackupNote] = useState('');

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

  const fetchBackups = async () => {
    try {
      const res = await api.getBackups();
      setBackups(res.backups);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, []);

  const handleCreateBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await api.createBackup('MANUAL', backupNote.trim() || undefined);
      setBackupNote('');
      await fetchBackups();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Backup failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestore = (backup: BackupRecord) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Restore Server Backup',
      message: `CRITICAL WARNING: Restoring "${backup.filename}" will overwrite current world, mods, and configuration files with this snapshot. The Minecraft server must be offline. Proceed?`,
      isDestructive: true,
      action: async () => {
        setActionLoading(true);
        try {
          await api.restoreBackup(backup.id);
          alert('Backup restored successfully!');
        } catch (err) {
          alert(err instanceof Error ? err.message : 'Restore failed');
        } finally {
          setActionLoading(false);
        }
      }
    });
  };

  const handleDelete = (backup: BackupRecord) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Backup Archive',
      message: `Permanently delete "${backup.filename}" from disk?`,
      isDestructive: true,
      action: async () => {
        setActionLoading(true);
        try {
          await api.deleteBackup(backup.id);
          await fetchBackups();
        } finally {
          setActionLoading(false);
        }
      }
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl">
        <div>
          <div className="flex items-center gap-3">
            <Archive className="w-6 h-6 text-emerald-400" />
            <h2 className="text-xl font-bold text-white">BACKUP MANAGER</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Complete zip snapshots of worlds, config, and mods with graceful chunk flushing.
          </p>
        </div>

        {/* Create Manual Backup Form */}
        <form onSubmit={handleCreateBackup} className="flex items-center gap-2 w-full md:w-auto">
          <input
            type="text"
            value={backupNote}
            onChange={(e) => setBackupNote(e.target.value)}
            placeholder="Backup notes (optional)..."
            className="px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500 flex-1 md:w-48"
          />
          <button
            type="submit"
            disabled={actionLoading}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-semibold text-white shadow-lg transition flex items-center gap-1.5 shrink-0 disabled:opacity-50"
          >
            {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Take Snapshot
          </button>
        </form>
      </div>

      {/* Backups List */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Server Snapshots ({backups.length})</span>
          <button onClick={fetchBackups} className="hover:text-white transition flex items-center gap-1">
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>

        {backups.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            {loading ? 'Checking backup archives...' : 'No backups created yet. Take a snapshot to protect your server!'}
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {backups.map((b) => (
              <div
                key={b.id}
                className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-slate-800/40 transition"
              >
                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    <FileCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-white font-mono">{b.filename}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold uppercase">
                        {b.type.replace('_', ' ')}
                      </span>
                      {b.status === 'COMPLETED' ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-medium">
                          Completed
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-medium">
                          {b.status}
                        </span>
                      )}
                    </div>
                    {b.notes && <p className="text-xs text-slate-400 mt-1 italic">{b.notes}</p>}
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center gap-3">
                      <span>{(b.sizeBytes / (1024 * 1024)).toFixed(2)} MB</span>
                      <span>•</span>
                      <span>{new Date(b.createdAt).toLocaleString()}</span>
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                  <a
                    href={`${getAgentBaseUrl()}/api/backups/${b.id}/download?token=${encodeURIComponent(getAuthToken() || '')}`}
                    download={b.filename}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                    title="Download archive"
                  >
                    <Download className="w-4 h-4" />
                  </a>

                  <button
                    onClick={() => handleRestore(b)}
                    className="px-3 py-1.5 rounded-xl bg-amber-600/10 hover:bg-amber-600 text-amber-400 hover:text-white text-xs font-semibold border border-amber-500/20 transition flex items-center gap-1.5"
                    title="Restore snapshot"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Restore
                  </button>

                  <button
                    onClick={() => handleDelete(b)}
                    className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition"
                    title="Delete backup"
                  >
                    <Trash2 className="w-4 h-4" />
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
