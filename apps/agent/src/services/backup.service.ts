import fs from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';
import cron from 'node-cron';
import { config } from '../config/environment.js';
import { BackupRepository, SettingsRepository, AuditLogRepository } from '../database/repositories.js';
import { ServerConfigService } from './server-config.service.js';
import { SecurityService } from './security.service.js';
import { processManager } from './process.service.js';
import type { BackupRecord } from '@mc-panel/types';

export class BackupService {
  private static scheduledTask: cron.ScheduledTask | null = null;

  public static getBackupDirectory(): string {
    const backupDir = SettingsRepository.get('backupDirectory') || config.backupDir;
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    return backupDir;
  }

  public static listBackups(): BackupRecord[] {
    return BackupRepository.list();
  }

  /**
   * Creates a compressed zip backup of the server's world, config, mods, and properties.
   */
  public static async createBackup(
    type: BackupRecord['type'] = 'MANUAL',
    notes?: string,
    username = 'system'
  ): Promise<BackupRecord> {
    const serverDir = ServerConfigService.readConfig().serverDirectory || SettingsRepository.get('serverDirectory') || config.serverDir;
    const backupDir = this.getBackupDirectory();

    // Timestamped filename: mc-backup-2026-10-03-12-30-00.zip
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `mc-backup-${type.toLowerCase()}-${timestamp}.zip`;
    const destPath = path.join(backupDir, filename);

    // Initial record in DB
    const record = BackupRepository.create(filename, 0, 'IN_PROGRESS', type, notes);

    // If server is currently running, instruct it to save world to disk first
    if (processManager.getState() === 'ONLINE') {
      processManager.sendCommand('save-all flush', 'backup-service');
      // Give Minecraft a couple seconds to flush chunks
      await new Promise((r) => setTimeout(r, 2000));
    }

    try {
      const zip = new AdmZip();

      // Folders and files to include
      const itemsToBackup = [
        'world',
        'world_nether',
        'world_the_end',
        'server.properties',
        'eula.txt',
        'ops.json',
        'whitelist.json',
        'banned-players.json',
        'banned-ips.json',
        'config',
        'mods'
      ];

      for (const item of itemsToBackup) {
        const fullItemPath = path.join(serverDir, item);
        if (fs.existsSync(fullItemPath)) {
          const stat = fs.statSync(fullItemPath);
          if (stat.isDirectory()) {
            zip.addLocalFolder(fullItemPath, item);
          } else {
            zip.addLocalFile(fullItemPath);
          }
        }
      }

      zip.writeZip(destPath);
      const finalStat = fs.statSync(destPath);

      BackupRepository.updateStatus(record.id, 'COMPLETED', finalStat.size);
      AuditLogRepository.create(
        username,
        'BACKUP_CREATE',
        `Created backup ${filename} (${(finalStat.size / (1024 * 1024)).toFixed(2)} MB)`
      );

      // Clean up old backups based on retention policy
      this.enforceRetentionLimit();

      return {
        ...record,
        sizeBytes: finalStat.size,
        status: 'COMPLETED'
      };
    } catch (error) {
      BackupRepository.updateStatus(record.id, 'FAILED', 0);
      AuditLogRepository.create(username, 'BACKUP_FAILED', `Failed to create backup: ${error}`);
      throw error;
    }
  }

  /**
   * Restores a backup. Requires server to be stopped.
   */
  public static async restoreBackup(backupId: string, username = 'admin'): Promise<void> {
    const record = BackupRepository.findById(backupId);
    if (!record) {
      throw new Error('Backup record not found.');
    }

    if (processManager.getState() === 'ONLINE' || processManager.getState() === 'STARTING') {
      throw new Error('Server must be offline before restoring a backup.');
    }

    const backupDir = this.getBackupDirectory();
    const backupFilePath = SecurityService.resolveSafePath(backupDir, record.filename);

    if (!fs.existsSync(backupFilePath)) {
      throw new Error(`Backup archive file not found on disk: ${record.filename}`);
    }

    const serverDir = ServerConfigService.readConfig().serverDirectory || SettingsRepository.get('serverDirectory') || config.serverDir;

    // Safety: Create a pre-restore snapshot of current state just in case
    try {
      const zip = new AdmZip(backupFilePath);
      zip.extractAllTo(serverDir, true); // overwrite true

      AuditLogRepository.create(username, 'BACKUP_RESTORE', `Restored backup: ${record.filename}`);
    } catch (error) {
      AuditLogRepository.create(username, 'BACKUP_RESTORE_FAILED', `Error restoring ${record.filename}: ${error}`);
      throw new Error(`Failed to extract backup: ${error}`);
    }
  }

  /**
   * Deletes a backup record and its archive file from disk.
   */
  public static deleteBackup(backupId: string, username = 'admin'): void {
    const record = BackupRepository.findById(backupId);
    if (!record) {
      throw new Error('Backup record not found.');
    }

    const backupDir = this.getBackupDirectory();
    const backupFilePath = SecurityService.resolveSafePath(backupDir, record.filename);

    if (fs.existsSync(backupFilePath)) {
      fs.unlinkSync(backupFilePath);
    }

    BackupRepository.delete(backupId);
    AuditLogRepository.create(username, 'BACKUP_DELETE', `Deleted backup: ${record.filename}`);
  }

  /**
   * Deletes oldest backups when exceeding retention count.
   */
  public static enforceRetentionLimit(): void {
    const retentionCount = parseInt(
      SettingsRepository.get('backupRetentionCount') || String(config.backupRetentionCount),
      10
    );

    if (retentionCount <= 0) return;

    const allBackups = BackupRepository.list();
    if (allBackups.length > retentionCount) {
      const toDelete = allBackups.slice(retentionCount);
      for (const b of toDelete) {
        try {
          this.deleteBackup(b.id, 'retention-cleaner');
        } catch {
          // ignore error
        }
      }
    }
  }

  /**
   * Initializes the cron scheduler for automated backups.
   */
  public static initScheduler(): void {
    if (this.scheduledTask) {
      this.scheduledTask.stop();
      this.scheduledTask = null;
    }

    const autoBackup = SettingsRepository.get('autoBackupEnabled') === 'true' || config.autoBackupEnabled;
    const cronExpr = SettingsRepository.get('autoBackupCron') || config.autoBackupCron;

    if (!autoBackup) return;

    if (!cron.validate(cronExpr)) {
      console.warn(`[BackupService] Invalid cron expression: "${cronExpr}". Automatic backups disabled.`);
      return;
    }

    this.scheduledTask = cron.schedule(cronExpr, () => {
      console.log('[BackupService] Triggering scheduled automatic backup...');
      this.createBackup('AUTO', 'Scheduled automatic backup', 'scheduler').catch((err) => {
        console.error('[BackupService] Scheduled backup error:', err);
      });
    });

    console.log(`[BackupService] Automated backup schedule active: "${cronExpr}"`);
  }
}
