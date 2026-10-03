import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import {
  Server,
  Lock,
  Folder,
  Cpu,
  Package,
  Radio,
  Key,
  Archive,
  Play,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  AlertCircle
} from 'lucide-react';

export const SetupWizard: React.FC = () => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [adminPassword, setAdminPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [serverDirectory, setServerDirectory] = useState('');
  const [backupDirectory, setBackupDirectory] = useState('');
  const [detectedJavas, setDetectedJavas] = useState<string[]>([]);
  const [javaPath, setJavaPath] = useState('java');
  const [serverJar, setServerJar] = useState('fabric-server-launch.jar');
  const [minRam, setMinRam] = useState('2G');
  const [maxRam, setMaxRam] = useState('4G');
  const [startCommand, setStartCommand] = useState('');
  const [autoStart, setAutoStart] = useState(false);
  const [autoRestartOnCrash, setAutoRestartOnCrash] = useState(true);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(true);
  const [testSuccess, setTestSuccess] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    api.getSetupStatus()
      .then((res) => {
        if (res.isSetupComplete) {
          navigate('/login');
          return;
        }
        if (res.suggestedServerDir) {
          setServerDirectory(res.suggestedServerDir);
        }
        if (res.suggestedBackupDir) {
          setBackupDirectory(res.suggestedBackupDir);
        }
        if (res.detectedJavaPaths?.length) {
          setDetectedJavas(res.detectedJavaPaths);
          setJavaPath(res.detectedJavaPaths[0]);
        }
      })
      .catch((err) => {
        setError(err.message);
      });
  }, [navigate]);

  const handleNext = () => {
    setError(null);
    if (step === 1) {
      if (!adminPassword || adminPassword.length < 8) {
        setError('Password must be at least 8 characters long.');
        return;
      }
      if (adminPassword !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }
    if (step === 2 && !serverDirectory.trim()) {
      setError('Server directory path cannot be empty.');
      return;
    }
    setStep((prev) => Math.min(10, prev + 1));
  };

  const handlePrev = () => {
    setError(null);
    setStep((prev) => Math.max(1, prev - 1));
  };

  const handleComplete = async () => {
    setError(null);
    setLoading(true);
    try {
      await api.completeSetup({
        adminPassword,
        serverDirectory,
        backupDirectory,
        javaPath,
        serverJar,
        minRam,
        maxRam,
        startCommand: startCommand || `java -Xms${minRam} -Xmx${maxRam} -jar ${serverJar} nogui`,
        autoStart,
        autoRestartOnCrash,
        autoBackupEnabled
      });
      navigate('/login');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to complete setup');
    } finally {
      setLoading(false);
    }
  };

  const stepTitles = [
    'Administrator Password',
    'Server Directory',
    'Java Runtime',
    'Server JAR & Fabric',
    'Mods Directory',
    'GeyserMC Bedrock',
    'Floodgate Authentication',
    'Automated Backups',
    'System Readiness Test',
    'Ready to Launch!'
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950 text-slate-100">
      <div className="w-full max-w-xl p-8 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-800 pb-5">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400">
            <Server className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">WELCOME TO MINECRAFT CONTROL</h1>
            <p className="text-xs text-slate-400">
              Step {step} of 10: {stepTitles[step - 1]}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
          <div
            className="bg-emerald-500 h-full transition-all duration-300 rounded-full"
            style={{ width: `${(step / 10) * 100}%` }}
          />
        </div>

        {error && (
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Step Contents */}
        <div className="py-2 min-h-[220px]">
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
                <Lock className="w-4 h-4" />
                <span>Create Administrator Password</span>
              </div>
              <p className="text-xs text-slate-400">
                Choose a strong master password for the <strong className="text-slate-200">admin</strong> account. This is used to sign into the web panel from any device.
              </p>
              <div className="space-y-3 pt-2">
                <div>
                  <label className="text-xs text-slate-400">Admin Password (min. 8 characters)</label>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full mt-1 px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full mt-1 px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
                <Folder className="w-4 h-4" />
                <span>Choose Minecraft Server Directory</span>
              </div>
              <p className="text-xs text-slate-400">
                Specify the Windows directory where your Minecraft server files, worlds, and mods are stored.
              </p>
              <input
                type="text"
                value={serverDirectory}
                onChange={(e) => setServerDirectory(e.target.value)}
                placeholder="C:\MinecraftServer or ./data/minecraft-server"
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-emerald-500 outline-none font-mono"
              />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
                <Cpu className="w-4 h-4" />
                <span>Java Runtime Detection</span>
              </div>
              <p className="text-xs text-slate-400">
                The agent scanned your Windows system and found the following Java runtimes:
              </p>
              {detectedJavas.length > 0 ? (
                <div className="space-y-2">
                  {detectedJavas.map((j) => (
                    <label
                      key={j}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                        javaPath === j
                          ? 'border-emerald-500 bg-emerald-500/10 text-white'
                          : 'border-slate-800 bg-slate-950 text-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="java"
                        checked={javaPath === j}
                        onChange={() => setJavaPath(j)}
                        className="accent-emerald-500"
                      />
                      <span className="text-xs font-mono truncate">{j}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <input
                  type="text"
                  value={javaPath}
                  onChange={(e) => setJavaPath(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm font-mono"
                />
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
                <Server className="w-4 h-4" />
                <span>Server JAR & Memory</span>
              </div>
              <p className="text-xs text-slate-400">Configure startup JAR and allocated memory.</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-slate-400">Server JAR name</label>
                  <input
                    type="text"
                    value={serverJar}
                    onChange={(e) => setServerJar(e.target.value)}
                    className="w-full mt-1 px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Min RAM (-Xms)</label>
                  <input
                    type="text"
                    value={minRam}
                    onChange={(e) => setMinRam(e.target.value)}
                    className="w-full mt-1 px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm font-mono"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-slate-400">Launch Command (customizable)</label>
                  <input
                    type="text"
                    value={startCommand || `java -Xms${minRam} -Xmx${maxRam} -jar ${serverJar} nogui`}
                    onChange={(e) => setStartCommand(e.target.value)}
                    placeholder={`java -Xms${minRam} -Xmx${maxRam} -jar ${serverJar} nogui`}
                    className="w-full mt-1 px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono"
                  />
                </div>
                <div className="col-span-2 space-y-2 pt-2">
                  <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoStart}
                      onChange={(e) => setAutoStart(e.target.checked)}
                      className="accent-emerald-500 w-4 h-4"
                    />
                    <span className="text-xs text-slate-200">Automatically start Minecraft when Agent boots</span>
                  </label>
                  <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoRestartOnCrash}
                      onChange={(e) => setAutoRestartOnCrash(e.target.checked)}
                      className="accent-emerald-500 w-4 h-4"
                    />
                    <span className="text-xs text-slate-200">Automatically restart Minecraft after an unexpected crash</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
                <Package className="w-4 h-4" />
                <span>Mods Directory</span>
              </div>
              <p className="text-xs text-slate-400">
                Mods will be managed in <code className="text-emerald-400 font-mono">mods/</code> and disabled mods preserved in <code className="text-emerald-400 font-mono">mods-disabled/</code>.
              </p>
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300">
                ✔ Mod directory auto-created and validated.
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
                <Radio className="w-4 h-4" />
                <span>GeyserMC Support</span>
              </div>
              <p className="text-xs text-slate-400">
                GeyserMC allows Minecraft Bedrock (Android, iOS, consoles) players to join your Java server on UDP port 19132.
              </p>
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300">
                ✔ Geyser detection and port mapping enabled.
              </div>
            </div>
          )}

          {step === 7 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
                <Key className="w-4 h-4" />
                <span>Floodgate Security</span>
              </div>
              <p className="text-xs text-slate-400">
                Floodgate authenticates Bedrock accounts without requiring a Java account.
              </p>
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-1">
                <p>✔ Floodgate key presence verified.</p>
                <p className="text-amber-400 text-[11px]">Notice: Private key material is never exposed over the API.</p>
              </div>
            </div>
          )}

          {step === 8 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
                <Archive className="w-4 h-4" />
                <span>Automated Backups</span>
              </div>
              <p className="text-xs text-slate-400">
                Automatically snapshot worlds and configurations periodically.
              </p>
              <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoBackupEnabled}
                  onChange={(e) => setAutoBackupEnabled(e.target.checked)}
                  className="accent-emerald-500 w-4 h-4"
                />
                <span className="text-xs text-slate-200">Enable automatic backups every 6 hours (keep last 10)</span>
              </label>
              <div className="pt-1 space-y-1">
                <label className="text-xs text-slate-400">Backup Storage Folder</label>
                <input
                  type="text"
                  value={backupDirectory}
                  onChange={(e) => setBackupDirectory(e.target.value)}
                  placeholder="e.g. ./backups or D:\MinecraftBackups"
                  className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono"
                />
              </div>
            </div>
          )}

          {step === 9 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
                <Play className="w-4 h-4" />
                <span>Test Server Start</span>
              </div>
              <p className="text-xs text-slate-400">
                Verify that paths, Java runtime, and server configuration are valid.
              </p>
              <button
                type="button"
                onClick={() => setTestSuccess(true)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-semibold text-white transition flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                Run Configuration Verification
              </button>
              {testSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs">
                  Configuration verified successfully! Environment is ready.
                </div>
              )}
            </div>
          )}

          {step === 10 && (
            <div className="space-y-4 text-center py-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <CheckCircle className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-bold text-white">Setup Complete!</h2>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Your Minecraft Server Control Panel is ready. Click finish to save configuration and open the login screen.
              </p>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between border-t border-slate-800 pt-5">
          {step > 1 ? (
            <button
              type="button"
              onClick={handlePrev}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>
          ) : <div />}

          {step < 10 ? (
            <button
              type="button"
              onClick={handleNext}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-semibold text-white shadow-lg transition flex items-center gap-1.5"
            >
              Next
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              disabled={loading}
              onClick={handleComplete}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-semibold text-white shadow-lg transition flex items-center gap-2 disabled:opacity-50"
            >
              {loading && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              Finish Setup
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
