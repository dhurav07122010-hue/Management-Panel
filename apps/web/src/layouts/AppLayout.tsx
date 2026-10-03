import React, { useState, useEffect } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar.js';
import { BottomNav } from '../components/BottomNav.js';
import { useWebSocket } from '../hooks/useWebSocket.js';
import { Server, Wifi, WifiOff, Sun, Moon, LogOut } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.js';

export const AppLayout: React.FC = () => {
  const { isConnected, isReconnecting } = useWebSocket();
  const { logout } = useAuth();
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('mc_theme');
    if (saved === 'light') {
      setIsDark(false);
      document.documentElement.classList.remove('dark');
    } else {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('mc_theme', 'light');
      setIsDark(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('mc_theme', 'dark');
      setIsDark(true);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-950 text-slate-100">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-0">
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 md:px-8 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2 md:hidden">
              <div className="p-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400">
                <Server className="w-5 h-5" />
              </div>
              <span className="font-bold text-sm tracking-wide">MINECRAFT</span>
            </Link>

            {/* Connection Status Indicator (Section 28) */}
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full text-xs bg-slate-800/80 border border-slate-700/60">
              {isConnected ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                  <span className="text-emerald-400 font-medium">Agent Online</span>
                </>
              ) : isReconnecting ? (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
                  <span className="text-amber-400 font-medium">Reconnecting...</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-red-400" />
                  <span className="text-red-400 font-medium">Agent Offline</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              title="Toggle theme"
              className="p-2 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-xl transition"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={logout}
              title="Sign out"
              className="md:hidden p-2 text-slate-400 hover:text-red-400 bg-slate-800/60 hover:bg-red-500/10 rounded-xl transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Dynamic Page Outlet */}
        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <BottomNav />
    </div>
  );
};
