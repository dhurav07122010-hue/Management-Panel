import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Terminal,
  Users,
  Package,
  FolderTree,
  Archive,
  Settings
} from 'lucide-react';

const mobileNavItems = [
  { to: '/', label: 'Home', icon: LayoutDashboard },
  { to: '/console', label: 'Console', icon: Terminal },
  { to: '/players', label: 'Players', icon: Users },
  { to: '/mods', label: 'Mods', icon: Package },
  { to: '/files', label: 'Files', icon: FolderTree },
  { to: '/backups', label: 'Backups', icon: Archive },
  { to: '/settings', label: 'Settings', icon: Settings }
];

export const BottomNav: React.FC = () => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 pb-safe">
      <div className="flex items-center justify-around px-1 py-1.5">
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition min-w-[48px] text-[11px] font-medium ${
                  isActive
                    ? 'text-emerald-400 font-semibold scale-105'
                    : 'text-slate-400 hover:text-slate-200'
                }`
              }
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};
