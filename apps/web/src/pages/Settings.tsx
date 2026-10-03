import React, { useState, useEffect } from 'react';
import { api, getAgentBaseUrl, setAgentBaseUrl } from '../services/api.js';
import type { ServerConfigSettings, AuditLogEntry } from '@mc-panel/types';
import {
  Settings as SettingsIcon,
  Save,
  Lock,
  Cpu,
  Server,
  Archive,
  RotateCw,
  FileText,
  Shield,
  CheckCircle,
  AlertCircle,
  Globe
} from 'lucide-react';

export const Settings: React.FC = () => {
  const [settings, setSettings] = useState<ServerConfigSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Java detection
  const [detectedJavas, setDetectedJavas] = useState<string[]>([]);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Audit logs state
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  useEffect(() => {
    Promise.all([
      api.getSettings(),
      api.detectJava(),
      api.getAuditLogs(50)
    ]).then(([s, j, a]) => {
      setSettings(s);
      setDetectedJavas(j.javaPaths);
      setAuditLogs(a.logs);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setSaveSuccess(false);

    try {
      await api.updateSettings(settings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error updating settings');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    setChangingPassword(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      alert('Password changed successfully! Please log in again.');
      window.location.href = '/login';
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading || !settings) {
    return <div className="p-8 text-center text-slate-500 text-xs">Loading configuration...</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Top Banner */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <SettingsIcon className="w-6 h-6 text-emerald-400" />
            <h2 className="text-xl font-bold text-white">SETTINGS & CONFIGURATION</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Manage Minecraft runtime parameters, hardware allocation, backups, and credentials.
          </p>
        </div>
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* Java & Process Section */}
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 shadow-xl">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Cpu className="w-4 h-4 text-emerald-400" />
            Java Runtime & Process
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="md:col-span-2 space-y-1">
              <label className="text-slate-400 font-semibold">Java Executable Path</label>
              <input
                type="text"
                value={settings.javaPath}
                onChange={(e) => setSettings({ ...settings, javaPath: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
              />
              {detectedJavas.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-[11px] text-slate-500">Detected:</span>
                  {detectedJavas.map((j) => (
                    <button
                      key={j}
                      type="button"
                      onClick={() => setSettings({ ...settings, javaPath: j })}
                      className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded font-mono truncate max-w-xs"
                    >
                      {j}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-slate-400 font-semibold">Server Directory</label>
              <input
                type="text"
                value={settings.serverDirectory}
                onChange={(e) => setSettings({ ...settings, serverDirectory: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-400 font-semibold">Server JAR</label>
              <input
                type="text"
                value={settings.serverJar}
                onChange={(e) => setSettings({ ...settings, serverJar: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-400 font-semibold">Min Memory (-Xms)</label>
              <input
                type="text"
                value={settings.minRam}
                onChange={(e) => setSettings({ ...settings, minRam: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-400 font-semibold">Max Memory (-Xmx)</label>
              <input
                type="text"
                value={settings.maxRam}
                onChange={(e) => setSettings({ ...settings, maxRam: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
              />
            </div>

            <div className="md:col-span-2 space-y-1">
              <label className="text-slate-400 font-semibold">Start Command (server-config.json)</label>
              <input
                type="text"
                value={settings.startCommand || `java -Xms${settings.minRam} -Xmx${settings.maxRam} -jar ${settings.serverJar} nogui`}
                onChange={(e) => setSettings({ ...settings, startCommand: e.target.value })}
                placeholder="java -Xms2G -Xmx6G -jar fabric-server-launch.jar nogui"
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
              />
              <span className="text-[11px] text-slate-500">
                Direct command executed in the server directory. Saved to <code className="text-emerald-400">server-config.json</code>.
              </span>
            </div>

            <div className="md:col-span-2 pt-2">
              <label className="flex items-center gap-3 p-3 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoStart ?? false}
                  onChange={(e) => setSettings({ ...settings, autoStart: e.target.checked })}
                  className="accent-emerald-500 w-4 h-4"
                />
                <span className="text-slate-200">Auto-start Minecraft server automatically when Agent boots</span>
              </label>
            </div>
          </div>
        </div>

        {/* Crash Protection & Auto-Restart & Scheduled Restarts */}
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 shadow-xl">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <RotateCw className="w-4 h-4 text-amber-400" />
            Crash Detection & Scheduled Restarts
          </h3>

          <div className="space-y-3 text-xs">
            <label className="flex items-center gap-3 p-3 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.autoRestartOnCrash}
                onChange={(e) => setSettings({ ...settings, autoRestartOnCrash: e.target.checked })}
                className="accent-emerald-500 w-4 h-4"
              />
              <span className="text-slate-200">Automatically restart server on unexpected exit / crash</span>
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              <div className="space-y-1">
                <label className="text-slate-400">Crash Restart Delay (seconds)</label>
                <input
                  type="number"
                  value={settings.restartDelaySeconds}
                  onChange={(e) => setSettings({ ...settings, restartDelaySeconds: parseInt(e.target.value, 10) })}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400">Max Restart Attempts (loop prevention)</label>
                <input
                  type="number"
                  value={settings.maxRestartAttempts}
                  onChange={(e) => setSettings({ ...settings, maxRestartAttempts: parseInt(e.target.value, 10) })}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 space-y-3">
              <label className="flex items-center gap-3 p-3 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.scheduledRestartEnabled ?? false}
                  onChange={(e) => setSettings({ ...settings, scheduledRestartEnabled: e.target.checked })}
                  className="accent-emerald-500 w-4 h-4"
                />
                <span className="text-slate-200">Enable automated scheduled daily restarts (broadcasts 60s warning in console)</span>
              </label>

              {settings.scheduledRestartEnabled && (
                <div className="space-y-1 pl-1">
                  <label className="text-slate-400">Restart Cron Expression (e.g. 0 4 * * * for 4:00 AM)</label>
                  <input
                    type="text"
                    value={settings.scheduledRestartCron || '0 4 * * *'}
                    onChange={(e) => setSettings({ ...settings, scheduledRestartCron: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono text-xs"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Backups Configuration */}
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 shadow-xl">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Archive className="w-4 h-4 text-emerald-400" />
            Automated Backup Policy
          </h3>

          <div className="space-y-3 text-xs">
            <label className="flex items-center gap-3 p-3 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.autoBackupEnabled}
                onChange={(e) => setSettings({ ...settings, autoBackupEnabled: e.target.checked })}
                className="accent-emerald-500 w-4 h-4"
              />
              <span className="text-slate-200">Enable automatic background backup scheduler</span>
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              <div className="space-y-1">
                <label className="text-slate-400">Cron Schedule Expression</label>
                <input
                  type="text"
                  value={settings.autoBackupCron}
                  onChange={(e) => setSettings({ ...settings, autoBackupCron: e.target.value })}
                  placeholder="0 */6 * * *"
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                />
                <span className="text-[10px] text-slate-500">Default: every 6 hours (0 */6 * * *)</span>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400">Retention Count (keep last N backups)</label>
                <input
                  type="number"
                  value={settings.backupRetentionCount}
                  onChange={(e) => setSettings({ ...settings, backupRetentionCount: parseInt(e.target.value, 10) })}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Remote Agent Connection (For Vercel Deployment) */}
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 shadow-xl">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Globe className="w-4 h-4 text-sky-400" />
            Cloud & Remote Agent Connection (Vercel)
          </h3>
          <p className="text-xs text-slate-400">
            If hosting the web panel on Vercel or accessing from outside your local network, specify your public Server Agent URL (e.g. Cloudflare Tunnel, Tailscale, or public domain with HTTPS).
          </p>
          <div className="space-y-1">
            <label className="text-xs text-slate-400">Custom Agent Endpoint URL</label>
            <input
              type="text"
              defaultValue={getAgentBaseUrl()}
              onChange={(e) => setAgentBaseUrl(e.target.value)}
              placeholder="e.g. https://mc-agent.yourdomain.com or http://192.168.1.38:3001"
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono text-xs placeholder-slate-600 focus:outline-none focus:border-emerald-500"
            />
            <span className="text-[10px] text-slate-500">
              Saved locally to your browser storage. Leave empty to automatically use the current web host.
            </span>
          </div>
        </div>

        {/* Save Settings Button */}
        <div className="flex items-center justify-end gap-3">
          {saveSuccess && (
            <span className="text-xs text-emerald-400 flex items-center gap-1 font-semibold">
              <CheckCircle className="w-4 h-4" />
              Settings saved successfully!
            </span>
          )}
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition flex items-center gap-2 disabled:opacity-50"
          >
            {saving && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            <Save className="w-4 h-4" />
            Save Configuration
          </button>
        </div>
      </form>

      {/* Security: Change Admin Password */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 shadow-xl">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Shield className="w-4 h-4 text-purple-400" />
          Change Administrator Password
        </h3>

        {passwordError && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{passwordError}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-3 text-xs max-w-md">
          <div className="space-y-1">
            <label className="text-slate-400">Current Password</label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-slate-400">New Password (min 8 chars)</label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-slate-400">Confirm New Password</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
            />
          </div>

          <button
            type="submit"
            disabled={changingPassword}
            className="mt-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 rounded-xl text-white font-semibold text-xs transition"
          >
            Update Admin Password
          </button>
        </form>
      </div>

      {/* Audit Logs Table */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 shadow-xl">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <FileText className="w-4 h-4 text-sky-400" />
          Security Audit Logs (Last 50 Events)
        </h3>

        <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-x-auto max-h-80 overflow-y-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] sticky top-0">
              <tr>
                <th className="p-3">Timestamp</th>
                <th className="p-3">User</th>
                <th className="p-3">Action</th>
                <th className="p-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-900/40">
                  <td className="p-3 text-slate-500 shrink-0">{new Date(log.timestamp).toLocaleString()}</td>
                  <td className="p-3 font-bold text-white">{log.username}</td>
                  <td className="p-3 font-semibold text-emerald-400">{log.action}</td>
                  <td className="p-3 text-slate-400 truncate max-w-xs">{log.details || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
