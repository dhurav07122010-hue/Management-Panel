import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { z } from 'zod';
import { FileService } from '../services/file.service.js';
import { SecurityService } from '../services/security.service.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.middleware.js';

export const filesRouter = Router();
filesRouter.use(requireAuth);

const fileUpload = multer({
  dest: path.join(process.cwd(), 'temp-uploads'),
  limits: { fileSize: 250 * 1024 * 1024 } // 250MB
});

filesRouter.get('/', (req, res, next) => {
  try {
    const subPath = (req.query.path as string) || '';
    const files = FileService.listFiles(subPath);
    res.json({
      success: true,
      data: {
        currentPath: subPath,
        files
      }
    });
  } catch (error) {
    next(error);
  }
});

filesRouter.get('/content', (req, res, next) => {
  try {
    const filePath = req.query.path as string;
    if (!filePath) {
      res.status(400).json({ success: false, error: { code: 'MISSING_PATH', message: 'File path is required.' } });
      return;
    }
    const content = FileService.readFileContent(filePath);
    res.json({
      success: true,
      data: {
        path: filePath,
        content
      }
    });
  } catch (error) {
    next(error);
  }
});

const putContentSchema = z.object({
  path: z.string().min(1),
  content: z.string()
});

filesRouter.put('/content', (req: AuthenticatedRequest, res, next) => {
  try {
    const { path: filePath, content } = putContentSchema.parse(req.body);
    FileService.writeFileContent(filePath, content, req.user?.username);
    res.json({
      success: true,
      data: { message: 'File saved successfully.' }
    });
  } catch (error) {
    next(error);
  }
});

filesRouter.post('/directory', (req: AuthenticatedRequest, res, next) => {
  try {
    const { path: dirPath } = z.object({ path: z.string().min(1) }).parse(req.body);
    FileService.createDirectory(dirPath, req.user?.username);
    res.json({
      success: true,
      data: { message: 'Directory created successfully.' }
    });
  } catch (error) {
    next(error);
  }
});

filesRouter.post('/rename', (req: AuthenticatedRequest, res, next) => {
  try {
    const { oldPath, newPath } = z.object({ oldPath: z.string().min(1), newPath: z.string().min(1) }).parse(req.body);
    FileService.renameFile(oldPath, newPath, req.user?.username);
    res.json({
      success: true,
      data: { message: 'Renamed successfully.' }
    });
  } catch (error) {
    next(error);
  }
});

filesRouter.delete('/', (req: AuthenticatedRequest, res, next) => {
  try {
    const targetPath = (req.query.path as string) || (req.body.path as string);
    if (!targetPath) {
      res.status(400).json({ success: false, error: { code: 'MISSING_PATH', message: 'Path is required.' } });
      return;
    }
    FileService.deleteFile(targetPath, req.user?.username);
    res.json({
      success: true,
      data: { message: 'Deleted successfully.' }
    });
  } catch (error) {
    next(error);
  }
});

filesRouter.get('/download', (req, res, next) => {
  try {
    const targetPath = req.query.path as string;
    if (!targetPath) {
      res.status(400).json({ success: false, error: { code: 'MISSING_PATH', message: 'Path is required.' } });
      return;
    }
    const safeTarget = SecurityService.resolveServerPath(targetPath);
    if (!fs.existsSync(safeTarget) || fs.statSync(safeTarget).isDirectory()) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'File not found.' } });
      return;
    }
    res.download(safeTarget);
  } catch (error) {
    next(error);
  }
});

filesRouter.post('/upload', fileUpload.single('file'), (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: { code: 'NO_FILE', message: 'No file provided.' } });
      return;
    }
    const targetDir = (req.body.destinationPath as string) || '';
    const safeTargetDir = SecurityService.resolveServerPath(targetDir);
    const sanitizedName = SecurityService.sanitizeFilename(req.file.originalname);
    const destPath = path.join(safeTargetDir, sanitizedName);

    fs.copyFileSync(req.file.path, destPath);
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      data: {
        message: 'File uploaded successfully.',
        filename: sanitizedName
      }
    });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(error);
  }
});
