import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import type { GeyserStatus, FloodgateStatus } from '@mc-panel/types';
import {
  Radio,
  Key,
  ShieldCheck,
  Smartphone,
  Laptop,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  ExternalLink
} from 'lucide-react';

export const Geyser: React.FC = () => {
  const [geyser, setGeyser] = useState<GeyserStatus | null>(null);
  const [floodgate, setFloodgate] = useState<FloodgateStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const [g, f] = await Promise.all([
        api.getGeyserStatus(),
        api.getFloodgateStatus()
      ]);
      setGeyser(g);
      setFloodgate(f);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Radio className="w-6 h-6 text-sky-400" />
            <h2 className="text-xl font-bold text-white">NETWORK & BEDROCK BRIDGING</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Status of GeyserMC and Floodgate allowing Bedrock players (Android, iOS, Xbox, Switch) to join Java.
          </p>
        </div>
        <button onClick={fetchStatus} className="text-slate-400 hover:text-white p-2">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Status Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Geyser Card */}
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                <Radio className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">GeyserMC Translator</h3>
            </div>
            {geyser?.installed ? (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Installed
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400">
                Not Installed
              </span>
            )}
          </div>

          <div className="space-y-2 text-xs divide-y divide-slate-800/80 pt-2">
            <div className="flex justify-between py-2 text-slate-300">
              <span className="text-slate-400">Bedrock UDP Port:</span>
              <span className="font-mono font-bold text-sky-400">{geyser?.bedrockPort || 19132}</span>
            </div>
            <div className="flex justify-between py-2 text-slate-300">
              <span className="text-slate-400">Bedrock Listen Address:</span>
              <span className="font-mono">{geyser?.bedrockAddress || '0.0.0.0'}</span>
            </div>
            <div className="flex justify-between py-2 text-slate-300">
              <span className="text-slate-400">Auth Mode:</span>
              <span className="font-mono">{geyser?.authType || 'online'}</span>
            </div>
            <div className="flex justify-between py-2 text-slate-300">
              <span className="text-slate-400">Configuration Location:</span>
              <span className="font-mono text-[11px] text-slate-400 truncate max-w-[200px]">
                {geyser?.configPath || 'config/Geyser-Fabric/config.yml'}
              </span>
            </div>
          </div>
        </div>

        {/* Floodgate Card */}
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <Key className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Floodgate Authentication</h3>
            </div>
            {floodgate?.installed ? (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Installed
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400">
                Not Installed
              </span>
            )}
          </div>

          <div className="space-y-2 text-xs divide-y divide-slate-800/80 pt-2">
            <div className="flex justify-between py-2 text-slate-300">
              <span className="text-slate-400">Floodgate Key Status:</span>
              <span className={`font-semibold flex items-center gap-1 ${floodgate?.keyPresent ? 'text-emerald-400' : 'text-amber-400'}`}>
                {floodgate?.keyPresent ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                {floodgate?.keyPresent ? 'Verified Present' : 'key.pem Missing'}
              </span>
            </div>
            <div className="flex justify-between py-2 text-slate-300">
              <span className="text-slate-400">Security Guard:</span>
              <span className="text-emerald-400 font-medium">Private key strictly hidden</span>
            </div>
            <div className="flex justify-between py-2 text-slate-300">
              <span className="text-slate-400">Config Path:</span>
              <span className="font-mono text-[11px] text-slate-400 truncate max-w-[200px]">
                {floodgate?.configPath || 'config/Floodgate-Fabric/'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Player Connection Instructions Card */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 shadow-xl">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-emerald-400" />
          How Players Connect
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300">
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
            <h4 className="font-bold text-emerald-400 flex items-center gap-2">
              <Laptop className="w-4 h-4" /> Java Edition (PC / Mac / Linux)
            </h4>
            <p className="text-slate-400">
              In Minecraft Multiplayer &gt; Direct Connect / Add Server:
            </p>
            <p className="font-mono bg-slate-900 p-2 rounded-xl border border-slate-800 text-white">
              &lt;Your PC LAN IP&gt;:25565
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
            <h4 className="font-bold text-sky-400 flex items-center gap-2">
              <Smartphone className="w-4 h-4" /> Bedrock Edition (Android / iOS / Console)
            </h4>
            <p className="text-slate-400">
              In Minecraft Bedrock &gt; Servers &gt; Add Server:
            </p>
            <div className="space-y-1 font-mono bg-slate-900 p-2 rounded-xl border border-slate-800 text-white">
              <p>Server Address: &lt;Your PC LAN IP&gt;</p>
              <p>Port: 19132 (UDP)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
