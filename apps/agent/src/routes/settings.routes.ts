import { Router } from 'express';
import { z } from 'zod';
import { SettingsRepository, AuditLogRepository } from '../database/repositories.js';
import { ProcessService, processManager } from '../services/process.service.js';
import { BackupService } from '../services/backup.service.js';
import { ServerConfigService } from '../services/server-config.service.js';
import { config } from '../config/environment.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.middleware.js';

export const settingsRouter = Router();
settingsRouter.use(requireAuth);

settingsRouter.get('/', (_req, res) => {
  const allSettings = SettingsRepository.getAll();
  const fileConfig = ServerConfigService.readConfig();
  res.json({
    success: true,
    data: {
      serverDirectory: fileConfig.serverDirectory || allSettings.serverDirectory || config.serverDir,
      startCommand: fileConfig.startCommand || `java -Xms${config.minRam} -Xmx${config.maxRam} -jar ${config.serverJar} nogui`,
      autoStart: fileConfig.autoStart ?? (allSettings.autoStart === 'true'),
      scheduledRestartEnabled: fileConfig.scheduledRestartEnabled ?? (allSettings.scheduledRestartEnabled === 'true'),
      scheduledRestartCron: fileConfig.scheduledRestartCron || allSettings.scheduledRestartCron || '0 4 * * *',
      minecraftVersion: fileConfig.minecraftVersion || allSettings.minecraftVersion || '1.21.1',
      fabricVersion: fileConfig.fabricVersion || allSettings.fabricVersion || '0.16.5',
      javaPath: allSettings.javaPath || config.javaPath,
      serverJar: allSettings.serverJar || config.serverJar,
      minRam: allSettings.minRam || config.minRam,
      maxRam: allSettings.maxRam || config.maxRam,
      javaArgs: allSettings.javaArgs || config.javaArgs,
      autoRestartOnCrash: allSettings.autoRestartOnCrash === 'true' || config.autoRestartOnCrash,
      maxRestartAttempts: parseInt(allSettings.maxRestartAttempts || String(config.maxRestartAttempts), 10),
      restartDelaySeconds: parseInt(allSettings.restartDelaySeconds || String(config.restartDelaySeconds), 10),
      backupDirectory: allSettings.backupDirectory || config.backupDir,
      autoBackupEnabled: allSettings.autoBackupEnabled === 'true' || config.autoBackupEnabled,
      autoBackupCron: allSettings.autoBackupCron || config.autoBackupCron,
      backupRetentionCount: parseInt(allSettings.backupRetentionCount || String(config.backupRetentionCount), 10),
      mockMode: config.mockMode,
      publicHost: allSettings.publicHost || '',
      publicPort: parseInt(allSettings.publicPort || '25565', 10),
      publicBedrockPort: parseInt(allSettings.publicBedrockPort || '19132', 10)
    }
  });
});

const updateSettingsSchema = z.object({
  serverDirectory: z.string().optional(),
  startCommand: z.string().optional(),
  autoStart: z.boolean().optional(),
  scheduledRestartEnabled: z.boolean().optional(),
  scheduledRestartCron: z.string().optional(),
  minecraftVersion: z.string().optional(),
  fabricVersion: z.string().optional(),
  javaPath: z.string().optional(),
  serverJar: z.string().optional(),
  minRam: z.string().optional(),
  maxRam: z.string().optional(),
  javaArgs: z.string().optional(),
  autoRestartOnCrash: z.boolean().optional(),
  maxRestartAttempts: z.number().optional(),
  restartDelaySeconds: z.number().optional(),
  backupDirectory: z.string().optional(),
  autoBackupEnabled: z.boolean().optional(),
  autoBackupCron: z.string().optional(),
  backupRetentionCount: z.number().optional(),
  publicHost: z.string().optional(),
  publicPort: z.number().optional(),
  publicBedrockPort: z.number().optional()
});

settingsRouter.put('/', (req: AuthenticatedRequest, res, next) => {
  try {
    const body = updateSettingsSchema.parse(req.body);
    const updates: Record<string, string> = {};

    for (const [k, v] of Object.entries(body)) {
      if (v !== undefined) {
        updates[k] = typeof v === 'boolean' || typeof v === 'number' ? v.toString() : v;
      }
    }

    SettingsRepository.setMultiple(updates);

    // Sync to server-config.json
    ServerConfigService.writeConfig({
      serverDirectory: body.serverDirectory,
      startCommand: body.startCommand,
      autoStart: body.autoStart,
      scheduledRestartEnabled: body.scheduledRestartEnabled,
      scheduledRestartCron: body.scheduledRestartCron,
      minecraftVersion: body.minecraftVersion,
      fabricVersion: body.fabricVersion
    });

    // Re-initialize backup cron scheduler if backup settings changed
    if (body.autoBackupEnabled !== undefined || body.autoBackupCron !== undefined) {
      BackupService.initScheduler();
    }

    // Re-initialize scheduled restart if restart settings changed
    if (body.scheduledRestartEnabled !== undefined || body.scheduledRestartCron !== undefined) {
      processManager.initScheduledRestart();
    }

    AuditLogRepository.create(req.user?.username || 'admin', 'SETTINGS_UPDATE', 'Updated server settings');

    res.json({
      success: true,
      data: { message: 'Settings saved successfully.' }
    });
  } catch (error) {
    next(error);
  }
});

settingsRouter.get('/audit-logs', (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
  const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
  const logs = AuditLogRepository.list(limit, offset);
  res.json({
    success: true,
    data: { logs }
  });
});

settingsRouter.get('/detect-java', (_req, res) => {
  const paths = ProcessService.detectJavaInstallations();
  res.json({
    success: true,
    data: { javaPaths: paths }
  });
});
