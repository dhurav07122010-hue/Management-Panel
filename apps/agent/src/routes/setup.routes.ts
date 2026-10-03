import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { UserRepository, SettingsRepository, AuditLogRepository } from '../database/repositories.js';
import { SecurityService } from '../services/security.service.js';
import { ProcessService } from '../services/process.service.js';
import { ServerConfigService } from '../services/server-config.service.js';
import { config } from '../config/environment.js';

export const setupRouter = Router();

const completeSetupSchema = z.object({
  adminPassword: z.string().min(8, 'Password must be at least 8 characters long'),
  serverDirectory: z.string().min(1, 'Server directory is required'),
  javaPath: z.string().default('java'),
  serverJar: z.string().default('fabric-server-launch.jar'),
  minRam: z.string().default('2G'),
  maxRam: z.string().default('4G'),
  startCommand: z.string().optional(),
  autoStart: z.boolean().default(false),
  autoRestartOnCrash: z.boolean().default(true),
  restartDelaySeconds: z.number().default(10),
  backupDirectory: z.string().optional(),
  autoBackupEnabled: z.boolean().default(true),
  autoBackupCron: z.string().default('0 */6 * * *'),
  backupRetentionCount: z.number().default(10)
});

setupRouter.get('/status', (_req, res) => {
  const userCount = UserRepository.count();
  const isSetupComplete = userCount > 0;
  const detectedJavaPaths = ProcessService.detectJavaInstallations();

  res.json({
    success: true,
    data: {
      isSetupComplete,
      detectedJavaPaths,
      suggestedServerDir: config.serverDir,
      suggestedBackupDir: config.backupDir
    }
  });
});

setupRouter.post('/complete', async (req, res, next) => {
  try {
    const userCount = UserRepository.count();
    if (userCount > 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'SETUP_ALREADY_COMPLETED',
          message: 'First-run setup has already been completed.'
        }
      });
      return;
    }

    const body = completeSetupSchema.parse(req.body);

    // Create admin user
    const passwordHash = await SecurityService.hashPassword(body.adminPassword);
    const adminUser = UserRepository.create('admin', passwordHash);

    // Normalize and ensure server dir
    const resolvedServerDir = path.resolve(body.serverDirectory);
    if (!fs.existsSync(resolvedServerDir)) {
      fs.mkdirSync(resolvedServerDir, { recursive: true });
    }

    // Save initial configuration
    const resolvedBackupDir = body.backupDirectory ? path.resolve(body.backupDirectory) : config.backupDir;
    if (!fs.existsSync(resolvedBackupDir)) {
      try {
        fs.mkdirSync(resolvedBackupDir, { recursive: true });
      } catch {
        // ignore
      }
    }

    SettingsRepository.setMultiple({
      serverDirectory: resolvedServerDir,
      backupDirectory: resolvedBackupDir,
      javaPath: body.javaPath,
      serverJar: body.serverJar,
      minRam: body.minRam,
      maxRam: body.maxRam,
      autoStart: String(body.autoStart ?? false),
      autoRestartOnCrash: String(body.autoRestartOnCrash ?? true),
      restartDelaySeconds: String(body.restartDelaySeconds ?? 10),
      autoBackupEnabled: body.autoBackupEnabled.toString(),
      autoBackupCron: body.autoBackupCron,
      backupRetentionCount: body.backupRetentionCount.toString()
    });

    const startCmd = body.startCommand || `java -Xms${body.minRam} -Xmx${body.maxRam} -jar ${body.serverJar} nogui`;
    ServerConfigService.writeConfig({
      serverDirectory: resolvedServerDir,
      startCommand: startCmd,
      autoStart: body.autoStart ?? false
    });

    AuditLogRepository.create('admin', 'SETUP_COMPLETED', 'First-run setup wizard completed successfully');

    res.json({
      success: true,
      data: {
        message: 'Setup completed successfully. You may now log in.',
        user: {
          id: adminUser.id,
          username: adminUser.username
        }
      }
    });
  } catch (error) {
    next(error);
  }
});
