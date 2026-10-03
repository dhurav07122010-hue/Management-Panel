import os from 'node:os';
import fs from 'node:fs';
import pidusage from 'pidusage';
import type { ServerStats } from '@mc-panel/types';
import { ServerConfigService } from './server-config.service.js';

export const StatsService = {
  getDiskMetrics(): { diskTotalGb: number; diskFreeGb: number; diskUsedPercent: number } {
    try {
      const cfg = ServerConfigService.readConfig();
      const dirToCheck = fs.existsSync(cfg.serverDirectory) ? cfg.serverDirectory : process.cwd();
      if (fs.statfsSync) {
        const stats = fs.statfsSync(dirToCheck);
        const totalBytes = stats.bsize * stats.blocks;
        const freeBytes = stats.bsize * stats.bavail;
        const usedBytes = totalBytes - freeBytes;
        const diskTotalGb = parseFloat((totalBytes / (1024 ** 3)).toFixed(1));
        const diskFreeGb = parseFloat((freeBytes / (1024 ** 3)).toFixed(1));
        const diskUsedPercent = totalBytes > 0 ? Math.min(100, Math.max(0, Math.round((usedBytes / totalBytes) * 100))) : 0;
        return { diskTotalGb, diskFreeGb, diskUsedPercent };
      }
    } catch {
      // Fallback
    }
    return { diskTotalGb: 100, diskFreeGb: 50, diskUsedPercent: 50 };
  },

  async getMetrics(pid: number | null, uptimeSeconds: number, isMock = false): Promise<ServerStats> {
    const totalMem = Math.round(os.totalmem() / (1024 * 1024));
    const freeMem = Math.round(os.freemem() / (1024 * 1024));
    const systemUsedMem = totalMem - freeMem;
    const { diskTotalGb, diskFreeGb, diskUsedPercent } = this.getDiskMetrics();

    // Calculate system CPU load approximation
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;
    for (const cpu of cpus) {
      for (const type in cpu.times) {
        totalTick += (cpu.times as Record<string, number>)[type];
      }
      totalIdle += cpu.times.idle;
    }
    const systemCpuPercent = Math.min(100, Math.max(0, Math.round(100 - (totalIdle / (totalTick || 1)) * 100)));

    if (isMock) {
      // Realistic simulated numbers for development mode
      return {
        cpuPercent: Math.floor(15 + Math.random() * 25),
        memoryUsedMb: Math.floor(2200 + Math.random() * 300),
        memoryTotalMb: 4096,
        systemCpuPercent,
        systemMemoryUsedMb: systemUsedMem,
        systemMemoryTotalMb: totalMem,
        diskTotalGb,
        diskFreeGb,
        diskUsedPercent,
        uptimeSeconds,
        tps: 20.0,
        timestamp: Date.now()
      };
    }

    if (!pid) {
      return {
        cpuPercent: 0,
        memoryUsedMb: 0,
        memoryTotalMb: 0,
        systemCpuPercent,
        systemMemoryUsedMb: systemUsedMem,
        systemMemoryTotalMb: totalMem,
        diskTotalGb,
        diskFreeGb,
        diskUsedPercent,
        uptimeSeconds: 0,
        timestamp: Date.now()
      };
    }

    try {
      const stats = await pidusage(pid);
      return {
        cpuPercent: Math.round(stats.cpu),
        memoryUsedMb: Math.round(stats.memory / (1024 * 1024)),
        memoryTotalMb: 4096,
        systemCpuPercent,
        systemMemoryUsedMb: systemUsedMem,
        systemMemoryTotalMb: totalMem,
        diskTotalGb,
        diskFreeGb,
        diskUsedPercent,
        uptimeSeconds,
        tps: 20.0,
        timestamp: Date.now()
      };
    } catch {
      return {
        cpuPercent: 0,
        memoryUsedMb: 0,
        memoryTotalMb: 0,
        systemCpuPercent,
        systemMemoryUsedMb: systemUsedMem,
        systemMemoryTotalMb: totalMem,
        diskTotalGb,
        diskFreeGb,
        diskUsedPercent,
        uptimeSeconds,
        timestamp: Date.now()
      };
    }
  }
};
