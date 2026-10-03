import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { z } from 'zod';
import { BackupService } from '../services/backup.service.js';
import { BackupRepository } from '../database/repositories.js';
import { SecurityService } from '../services/security.service.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.middleware.js';

export const backupsRouter = Router();
backupsRouter.use(requireAuth);

backupsRouter.get('/', (_req, res, next) => {
  try {
    const backups = BackupService.listBackups();
    res.json({
      success: true,
      data: { backups }
    });
  } catch (error) {
    next(error);
  }
});

const createBackupSchema = z.object({
  type: z.enum(['MANUAL', 'AUTO', 'PRE_MOD_CHANGE', 'PRE_CONFIG_CHANGE']).default('MANUAL'),
  notes: z.string().optional()
});

backupsRouter.post('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { type, notes } = createBackupSchema.parse(req.body);
    const backup = await BackupService.createBackup(type, notes, req.user?.username);
    res.json({
      success: true,
      data: { backup }
    });
  } catch (error) {
    next(error);
  }
});

backupsRouter.post('/:id/restore', async (req: AuthenticatedRequest, res, next) => {
  try {
    const backupId = req.params.id;
    await BackupService.restoreBackup(backupId, req.user?.username);
    res.json({
      success: true,
      data: { message: 'Backup restored successfully.' }
    });
  } catch (error) {
    next(error);
  }
});

backupsRouter.delete('/:id', (req: AuthenticatedRequest, res, next) => {
  try {
    const backupId = req.params.id;
    BackupService.deleteBackup(backupId, req.user?.username);
    res.json({
      success: true,
      data: { message: 'Backup deleted successfully.' }
    });
  } catch (error) {
    next(error);
  }
});

backupsRouter.get('/:id/download', (req, res, next) => {
  try {
    const backupId = req.params.id;
    const record = BackupRepository.findById(backupId);
    if (!record) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Backup record not found.' } });
      return;
    }
    const backupDir = BackupService.getBackupDirectory();
    const filePath = SecurityService.resolveSafePath(backupDir, record.filename);

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ success: false, error: { code: 'FILE_NOT_FOUND', message: 'Backup file missing on disk.' } });
      return;
    }
    res.download(filePath, record.filename);
  } catch (error) {
    next(error);
  }
});
