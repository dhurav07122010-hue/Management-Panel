import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { getAgentBaseUrl, setAgentBaseUrl } from '../services/api.js';
import { Server, Lock, User, AlertCircle, Eye, EyeOff, Globe, ChevronDown, ChevronUp } from 'lucide-react';

export const Login: React.FC = () => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const isVercelHost = typeof window !== 'undefined' && window.location.hostname.includes('vercel.app');
  const initialAgentUrl = getAgentBaseUrl();
  const [agentUrl, setAgentAgentUrl] = useState(initialAgentUrl);
  const [showAdvanced, setShowAdvanced] = useState(isVercelHost && !initialAgentUrl);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      setAgentBaseUrl(agentUrl);
      await login(username, password);
      navigate('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950 text-slate-100">
      <div className="w-full max-w-md p-8 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl space-y-6 animate-fade-in">
        {/* Brand Icon */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400">
            <Server className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">MINECRAFT CONTROL</h1>
          <p className="text-sm text-slate-400">Sign in to manage your server</p>
        </div>

        {error && (
          <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Username</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Advanced Agent Host Configuration (Vercel deployment) */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition font-medium"
            >
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              <span>Server Agent Connection Settings</span>
              {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {showAdvanced && (
              <div className="mt-2.5 p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5 animate-fade-in">
                <label className="text-[11px] text-slate-400 block">Agent Endpoint URL (optional)</label>
                <input
                  type="text"
                  value={agentUrl}
                  onChange={(e) => setAgentAgentUrl(e.target.value)}
                  placeholder="e.g. https://agent.yourdomain.com or http://192.168.1.38:3001"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[10px] text-slate-500 leading-tight">
                  Leave empty when running locally or on the same host. Set your public/tunnel address when accessing from a Vercel deployment.
                </p>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[48px] py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] rounded-xl text-white font-semibold text-sm shadow-lg shadow-emerald-950/50 transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            Sign In
          </button>
        </form>

        <div className="text-center pt-2">
          <Link to="/setup" className="text-xs text-slate-500 hover:text-emerald-400 transition">
            First time launching? Open First-Run Setup Wizard →
          </Link>
        </div>
      </div>
    </div>
  );
};
