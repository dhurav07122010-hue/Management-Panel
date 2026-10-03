import React from 'react';
import type { ServerState } from '@mc-panel/types';

interface StatusBadgeProps {
  state: ServerState;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ state, className = '' }) => {
  switch (state) {
    case 'ONLINE':
      return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 ${className}`}>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          ONLINE
        </span>
      );
    case 'STARTING':
      return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 ${className}`}>
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
          STARTING
        </span>
      );
    case 'STOPPING':
      return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 ${className}`}>
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          STOPPING
        </span>
      );
    case 'CRASHED':
      return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20 ${className}`}>
          <span className="w-2 h-2 rounded-full bg-red-500" />
          CRASHED
        </span>
      );
    case 'OFFLINE':
    default:
      return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20 ${className}`}>
          <span className="w-2 h-2 rounded-full bg-slate-500" />
          OFFLINE
        </span>
      );
  }
};
