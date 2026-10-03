import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api.js';
import { useWebSocket } from '../hooks/useWebSocket.js';
import type { ConsoleLine, LogLevel } from '@mc-panel/types';
import {
  Terminal,
  Send,
  Trash2,
  Search,
  Filter,
  ArrowDown,
  Pause,
  Play
} from 'lucide-react';

export const Console: React.FC = () => {
  const [logs, setLogs] = useState<ConsoleLine[]>([]);
  const [command, setCommand] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<LogLevel | 'ALL'>('ALL');
  const [autoScroll, setAutoScroll] = useState(true);

  const consoleEndRef = useRef<HTMLDivElement>(null);

  const { sendCommand } = useWebSocket({
    onConsole: (line) => {
      setLogs((prev) => [...prev, line]);
    }
  });

  useEffect(() => {
    api.getConsoleLogs(300).then((res) => {
      setLogs(res.logs);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (autoScroll) {
      consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const handleSendCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim()) return;

    sendCommand(command.trim());
    setCommandHistory((prev) => [...prev, command.trim()]);
    setHistoryIndex(-1);
    setCommand('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (commandHistory.length === 0) return;

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const nextIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIndex);
      setCommand(commandHistory[nextIndex]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex >= 0 && historyIndex < commandHistory.length - 1) {
        const nextIndex = historyIndex + 1;
        setHistoryIndex(nextIndex);
        setCommand(commandHistory[nextIndex]);
      } else {
        setHistoryIndex(-1);
        setCommand('');
      }
    }
  };

  const handleClear = async () => {
    await api.clearConsoleLogs();
    setLogs([]);
  };

  const filteredLogs = logs.filter((log) => {
    if (selectedLevel !== 'ALL' && log.level !== selectedLevel) return false;
    if (searchQuery && !log.clean.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] md:h-[calc(100vh-7rem)] bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl animate-fade-in">
      {/* Console Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-950/80 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5 text-emerald-400" />
          <h2 className="text-sm font-bold text-white tracking-wide">LIVE CONSOLE</h2>
          <span className="text-xs text-slate-500 font-mono">({filteredLogs.length} lines)</span>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search logs..."
              className="pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-xl p-0.5 text-xs">
            {(['ALL', 'INFO', 'WARN', 'ERROR'] as const).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setSelectedLevel(lvl)}
                className={`px-2.5 py-1 rounded-lg font-medium transition ${
                  selectedLevel === lvl
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>

          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`p-2 rounded-xl text-xs font-semibold border transition flex items-center gap-1 ${
              autoScroll
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
            }`}
            title={autoScroll ? 'Auto-scroll is ON' : 'Auto-scroll is PAUSED'}
          >
            {autoScroll ? <ArrowDown className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </button>

          <button
            onClick={handleClear}
            className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-slate-800 transition"
            title="Clear display"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Terminal View */}
      <div className="flex-1 bg-slate-950 p-4 overflow-y-auto font-mono text-xs space-y-1 selection:bg-emerald-500 selection:text-white">
        {filteredLogs.length === 0 ? (
          <p className="text-slate-600 italic">No console logs match your filters...</p>
        ) : (
          filteredLogs.map((log) => (
            <div key={log.id} className="leading-relaxed flex items-start gap-2 break-all hover:bg-slate-900/40 rounded px-1 -mx-1">
              <span className="text-slate-600 shrink-0 select-none">[{log.timestamp}]</span>
              <span
                className={
                  log.level === 'ERROR'
                    ? 'text-red-400 font-semibold'
                    : log.level === 'WARN'
                    ? 'text-amber-400 font-medium'
                    : 'text-slate-300'
                }
              >
                {log.clean}
              </span>
            </div>
          ))
        )}
        <div ref={consoleEndRef} />
      </div>

      {/* Command Prompt Box */}
      <form onSubmit={handleSendCommand} className="p-3 bg-slate-950/90 border-t border-slate-800 flex items-center gap-2">
        <span className="text-emerald-400 font-mono font-bold pl-2 text-sm">&gt;</span>
        <input
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Send Minecraft command (e.g. /say Hello, /time set day)..."
          className="flex-1 bg-transparent text-sm text-white placeholder-slate-600 outline-none font-mono"
        />
        <button
          type="submit"
          disabled={!command.trim()}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-xl text-xs font-semibold shadow-lg transition flex items-center gap-1.5 disabled:opacity-50"
        >
          <Send className="w-3.5 h-3.5" />
          Send
        </button>
      </form>
    </div>
  );
};
