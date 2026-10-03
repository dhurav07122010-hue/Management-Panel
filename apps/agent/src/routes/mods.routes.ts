import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { z } from 'zod';
import { ModService } from '../services/mod.service.js';
import { BackupService } from '../services/backup.service.js';
import { SecurityService } from '../services/security.service.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.middleware.js';

export const modsRouter = Router();
modsRouter.use(requireAuth);

// Multer storage for uploaded JARs
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const modsDir = ModService.getModsDirectory();
      cb(null, modsDir);
    },
    filename: (_req, file, cb) => {
      const sanitized = SecurityService.sanitizeFilename(file.originalname);
      cb(null, sanitized);
    }
  }),
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  },
  fileFilter: (_req, file, cb) => {
    if (!file.originalname.toLowerCase().endsWith('.jar')) {
      cb(new Error('Only .jar files are allowed.'));
    } else {
      cb(null, true);
    }
  }
});

modsRouter.get('/', (_req, res, next) => {
  try {
    const mods = ModService.listInstalledMods();
    res.json({
      success: true,
      data: { mods }
    });
  } catch (error) {
    next(error);
  }
});

modsRouter.post('/upload', upload.single('modFile'), async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        error: { code: 'NO_FILE', message: 'No mod JAR file uploaded.' }
      });
      return;
    }

    // Safety: create backup before adding mod
    try {
      await BackupService.createBackup('PRE_MOD_CHANGE', `Backup before uploading ${req.file.filename}`, req.user?.username);
    } catch {
      // non-blocking backup notice
    }

    res.json({
      success: true,
      data: {
        message: `Mod ${req.file.filename} uploaded successfully.`,
        filename: req.file.filename,
        sizeBytes: req.file.size
      }
    });
  } catch (error) {
    next(error);
  }
});

const toggleSchema = z.object({
  filename: z.string().min(1),
  enabled: z.boolean()
});

modsRouter.post('/toggle', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { filename, enabled } = toggleSchema.parse(req.body);

    // Create safety backup
    try {
      await BackupService.createBackup(
        'PRE_MOD_CHANGE',
        `Backup before ${enabled ? 'enabling' : 'disabling'} ${filename}`,
        req.user?.username
      );
    } catch {
      // ignore
    }

    ModService.toggleMod(filename, enabled, req.user?.username);
    res.json({
      success: true,
      data: { message: `Mod ${filename} is now ${enabled ? 'enabled' : 'disabled'}.` }
    });
  } catch (error) {
    next(error);
  }
});

modsRouter.delete('/:filename', async (req: AuthenticatedRequest, res, next) => {
  try {
    const filename = req.params.filename;

    try {
      await BackupService.createBackup('PRE_MOD_CHANGE', `Backup before deleting ${filename}`, req.user?.username);
    } catch {
      // ignore
    }

    ModService.deleteMod(filename, req.user?.username);
    res.json({
      success: true,
      data: { message: `Mod ${filename} deleted successfully.` }
    });
  } catch (error) {
    next(error);
  }
});

modsRouter.get('/search', async (req, res, next) => {
  try {
    const q = (req.query.q as string) || '';
    const mcVersion = (req.query.mcVersion as string) || '1.21.1';
    const results = await ModService.searchModrinth(q, mcVersion);
    res.json({
      success: true,
      data: { results }
    });
  } catch (error) {
    next(error);
  }
});

modsRouter.get('/versions/:projectId', async (req, res, next) => {
  try {
    const projectId = req.params.projectId;
    const mcVersion = (req.query.mcVersion as string) || '1.21.1';
    const versions = await ModService.getModrinthProjectVersions(projectId, mcVersion);
    res.json({
      success: true,
      data: { versions }
    });
  } catch (error) {
    next(error);
  }
});

const installSchema = z.object({
  projectId: z.string().min(1),
  versionId: z.string().optional(),
  mcVersion: z.string().default('1.21.1')
});

modsRouter.post('/install', async (req: AuthenticatedRequest, res, next) => {
  try {
    const body = installSchema.parse(req.body);

    // Pre-install backup
    try {
      await BackupService.createBackup('PRE_MOD_CHANGE', `Backup before installing mod ${body.projectId}`, req.user?.username);
    } catch {
      // ignore
    }

    const result = await ModService.installModFromModrinth(
      body.projectId,
      body.versionId,
      body.mcVersion,
      req.user?.username
    );

    res.json({
      success: true,
      data: {
        message: `Mod ${result.filename} downloaded and installed successfully.`,
        ...result
      }
    });
  } catch (error) {
    next(error);
  }
});
