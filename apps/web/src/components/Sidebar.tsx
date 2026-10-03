import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Terminal,
  Users,
  Package,
  FolderTree,
  Archive,
  Radio,
  Settings,
  LogOut,
  Server
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth.js';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/console', label: 'Console', icon: Terminal },
  { to: '/players', label: 'Players', icon: Users },
  { to: '/mods', label: 'Mods', icon: Package },
  { to: '/files', label: 'Files', icon: FolderTree },
  { to: '/backups', label: 'Backups', icon: Archive },
  { to: '/geyser', label: 'Network & Geyser', icon: Radio },
  { to: '/settings', label: 'Settings', icon: Settings }
];

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <aside className="hidden md:flex flex-col w-64 bg-slate-900 border-r border-slate-800 h-screen sticky top-0 select-none">
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-6 h-16 border-b border-slate-800">
        <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
          <Server className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-wide text-white">MINECRAFT</h1>
          <p className="text-xs text-slate-400">Server Control</p>
        </div>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* User Footer */}
      <div className="p-4 border-t border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3 truncate">
          <div className="w-8 h-8 rounded-full bg-emerald-700/40 text-emerald-300 flex items-center justify-center font-bold text-xs uppercase">
            {user?.username?.substring(0, 2) || 'AD'}
          </div>
          <div className="truncate">
            <p className="text-xs font-semibold text-white truncate">{user?.username}</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Admin</p>
          </div>
        </div>
        <button
          onClick={logout}
          title="Log out"
          className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};
