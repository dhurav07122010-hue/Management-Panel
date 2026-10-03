import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api.js';
import { ConfirmationDialog } from '../components/ConfirmationDialog.js';
import type { ModInfo, ModrinthSearchResult } from '@mc-panel/types';
import {
  Package,
  Upload,
  Search,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Download,
  AlertCircle,
  CheckCircle,
  ExternalLink,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';

export const Mods: React.FC = () => {
  const [mods, setMods] = useState<ModInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Modrinth Search Modal state
  const [showModrinthModal, setShowModrinthModal] = useState(false);
  const [modrinthQuery, setModrinthQuery] = useState('');
  const [modrinthResults, setModrinthResults] = useState<ModrinthSearchResult[]>([]);
  const [searchingModrinth, setSearchingModrinth] = useState(false);
  const [installingId, setInstallingId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    action: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    action: async () => {}
  });

  const fetchMods = async () => {
    try {
      const res = await api.getMods();
      setMods(res.mods);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMods();
  }, []);

  const handleToggle = async (mod: ModInfo) => {
    setActionLoading(true);
    try {
      await api.toggleMod(mod.filename, !mod.enabled);
      await fetchMods();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to toggle mod');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = (mod: ModInfo) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Mod JAR',
      message: `Permanently delete ${mod.filename} (${mod.name}) from disk? A safety backup will be created automatically.`,
      action: async () => {
        setActionLoading(true);
        try {
          await api.deleteMod(mod.filename);
          await fetchMods();
        } finally {
          setActionLoading(false);
        }
      }
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file.name.endsWith('.jar')) {
      alert('Only .jar files are allowed.');
      return;
    }

    setActionLoading(true);
    try {
      await api.uploadMod(file);
      await fetchMods();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error uploading mod');
    } finally {
      setActionLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleModrinthSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modrinthQuery.trim()) return;

    setSearchingModrinth(true);
    try {
      const res = await api.searchModrinth(modrinthQuery.trim(), '1.21.1');
      setModrinthResults(res.results);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearchingModrinth(false);
    }
  };

  const handleInstallFromModrinth = async (mod: ModrinthSearchResult) => {
    setInstallingId(mod.id);
    try {
      await api.installModrinthMod(mod.id, undefined, '1.21.1');
      await fetchMods();
      alert(`Mod "${mod.title}" installed successfully!`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to install mod');
    } finally {
      setInstallingId(null);
    }
  };

  const filteredMods = mods.filter(
    (m) =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl">
        <div>
          <div className="flex items-center gap-3">
            <Package className="w-6 h-6 text-emerald-400" />
            <h2 className="text-xl font-bold text-white">MOD MANAGER</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Install, enable, and manage Fabric mods safely with automated pre-modification backups.
          </p>
        </div>

        {/* Upload & Modrinth Buttons */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".jar"
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={actionLoading}
            className="flex-1 md:flex-initial px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition flex items-center justify-center gap-2"
          >
            <Upload className="w-4 h-4 text-emerald-400" />
            Upload .JAR
          </button>

          <button
            onClick={() => setShowModrinthModal(true)}
            className="flex-1 md:flex-initial px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-950/50 transition flex items-center justify-center gap-2"
          >
            <Search className="w-4 h-4" />
            Install from Modrinth
          </button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter installed mods..."
          className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-2xl text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500"
        />
      </div>

      {/* Installed Mods List */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Installed Mods ({filteredMods.length})</span>
          <button onClick={fetchMods} className="hover:text-white transition flex items-center gap-1">
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>

        {filteredMods.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            {loading ? 'Scanning mods directory...' : 'No mods found in server directory.'}
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {filteredMods.map((mod) => (
              <div
                key={mod.filename}
                className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-slate-800/40 transition"
              >
                <div className="flex items-start gap-3.5">
                  <div className={`p-2.5 rounded-2xl border ${mod.enabled ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-slate-800/80 border-slate-700 text-slate-500'}`}>
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-white">{mod.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                        v{mod.version}
                      </span>
                      {mod.fabricLoader && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                          Fabric
                        </span>
                      )}
                      {!mod.enabled && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                          Disabled
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                      {mod.description || mod.filename}
                    </p>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                      {(mod.sizeBytes / (1024 * 1024)).toFixed(2)} MB • {mod.filename}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                  <button
                    onClick={() => handleToggle(mod)}
                    disabled={actionLoading}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                      mod.enabled
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                        : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                    }`}
                  >
                    {mod.enabled ? <ToggleRight className="w-4 h-4 text-emerald-400" /> : <ToggleLeft className="w-4 h-4" />}
                    {mod.enabled ? 'Enabled' : 'Disabled'}
                  </button>

                  <button
                    onClick={() => handleDelete(mod)}
                    className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition"
                    title="Delete mod"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modrinth Search & Install Modal */}
      {showModrinthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Package className="w-5 h-5 text-emerald-400" />
                  Install from Modrinth
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Search community Fabric mods verified for Minecraft 1.21.1
                </p>
              </div>
              <button
                onClick={() => setShowModrinthModal(false)}
                className="text-slate-400 hover:text-white text-lg p-1"
              >
                ✕
              </button>
            </div>

            {/* Search Input */}
            <form onSubmit={handleModrinthSearch} className="p-4 border-b border-slate-800 flex items-center gap-2 bg-slate-950">
              <input
                type="text"
                value={modrinthQuery}
                onChange={(e) => setModrinthQuery(e.target.value)}
                placeholder="Search mods (e.g. Sodium, Lithium, FerriteCore, Geyser)..."
                className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                disabled={searchingModrinth}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-semibold text-white transition flex items-center gap-1.5"
              >
                {searchingModrinth ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                Search
              </button>
            </form>

            {/* Results List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {modrinthResults.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-xs">
                  {searchingModrinth ? 'Searching Modrinth API...' : 'Enter a query and press search.'}
                </div>
              ) : (
                modrinthResults.map((result) => (
                  <div
                    key={result.id}
                    className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-4 hover:border-slate-700 transition"
                  >
                    <div className="flex items-start gap-3">
                      {result.iconUrl ? (
                        <img
                          src={result.iconUrl}
                          alt={result.title}
                          className="w-10 h-10 rounded-xl object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center shrink-0 text-emerald-400">
                          <Package className="w-5 h-5" />
                        </div>
                      )}
                      <div>
                        <h4 className="text-sm font-bold text-white flex items-center gap-2">
                          {result.title}
                          <span className="text-[10px] text-slate-400 font-normal">
                            ({result.downloads.toLocaleString()} downloads)
                          </span>
                        </h4>
                        <p className="text-xs text-slate-400 line-clamp-2 mt-0.5">
                          {result.description}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleInstallFromModrinth(result)}
                      disabled={installingId === result.id}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow transition shrink-0 flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {installingId === result.id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                      Install
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        isDestructive={true}
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
