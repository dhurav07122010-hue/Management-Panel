import fs from 'node:fs';
import path from 'node:path';
import { SecurityService, SecurityError } from './security.service.js';
import { SettingsRepository, AuditLogRepository } from '../database/repositories.js';
import { ServerConfigService } from './server-config.service.js';
import { config } from '../config/environment.js';
import type { FileEntry } from '@mc-panel/types';

export const FileService = {
  getServerRoot(): string {
    return ServerConfigService.readConfig().serverDirectory || SettingsRepository.get('serverDirectory') || config.serverDir;
  },

  /**
   * Lists files and folders in a given relative path inside the server root directory.
   */
  listFiles(relativeSubPath = ''): FileEntry[] {
    const root = this.getServerRoot();
    const safeTarget = SecurityService.resolveSafePath(root, relativeSubPath);

    if (!fs.existsSync(safeTarget)) {
      throw new Error(`Directory does not exist: ${relativeSubPath}`);
    }

    const stat = fs.statSync(safeTarget);
    if (!stat.isDirectory()) {
      throw new Error(`Path is not a directory: ${relativeSubPath}`);
    }

    const entries = fs.readdirSync(safeTarget, { withFileTypes: true });
    const results: FileEntry[] = [];

    for (const entry of entries) {
      const fullEntryPath = path.join(safeTarget, entry.name);
      let entryStat: fs.Stats;
      try {
        entryStat = fs.statSync(fullEntryPath);
      } catch {
        continue;
      }

      const relativeEntryPath = path.relative(root, fullEntryPath).replace(/\\/g, '/');
      const ext = path.extname(entry.name).toLowerCase();
      const isEditable = ['.txt', '.properties', '.yml', '.yaml', '.json', '.toml', '.log', '.cfg', '.conf', '.env'].includes(ext);
      const isProtected = ['key.pem', 'credentials.json', 'id_rsa'].includes(entry.name.toLowerCase());

      results.push({
        name: entry.name,
        path: relativeEntryPath,
        isDirectory: entry.isDirectory(),
        sizeBytes: entry.isDirectory() ? 0 : entryStat.size,
        modifiedAt: entryStat.mtime.toISOString(),
        isProtected,
        isEditable,
        extension: ext
      });
    }

    // Sort: directories first, then alphabetical
    return results.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
  },

  /**
   * Reads file content as UTF-8 string with protection against reading private keys.
   */
  readFileContent(relativeFilePath: string): string {
    const root = this.getServerRoot();
    const safeTarget = SecurityService.resolveSafePath(root, relativeFilePath);

    // Explicit security protection for sensitive keys (Floodgate / SSH)
    const filename = path.basename(safeTarget).toLowerCase();
    if (filename === 'key.pem' || filename.includes('private') || filename.endsWith('.key')) {
      throw new SecurityError('Access to private key material is strictly prohibited.', 'PRIVATE_KEY_PROTECTION');
    }

    if (!fs.existsSync(safeTarget)) {
      throw new Error(`File not found: ${relativeFilePath}`);
    }

    const stat = fs.statSync(safeTarget);
    if (stat.isDirectory()) {
      throw new Error('Cannot read directory as text file.');
    }

    // Protect against accidentally reading giant binary files into memory
    if (stat.size > 10 * 1024 * 1024) {
      throw new Error('File exceeds maximum readable text size of 10MB.');
    }

    return fs.readFileSync(safeTarget, 'utf-8');
  },

  /**
   * Writes text content to file, creating timestamped backups for important configuration files.
   */
  writeFileContent(relativeFilePath: string, content: string, username = 'admin'): void {
    const root = this.getServerRoot();
    const safeTarget = SecurityService.resolveSafePath(root, relativeFilePath);

    const filename = path.basename(safeTarget).toLowerCase();
    if (filename === 'key.pem' || filename.includes('private')) {
      throw new SecurityError('Modifying private key material is forbidden.', 'PRIVATE_KEY_PROTECTION');
    }

    // If writing to a critical config file, create a safety backup copy first
    if (fs.existsSync(safeTarget)) {
      const isCriticalConfig = ['server.properties', 'config.yml', 'fabric_server.json', 'floodgate-config.yml'].some(
        c => filename.includes(c)
      );

      if (isCriticalConfig) {
        const backupCopyPath = safeTarget + `.${Date.now()}.bak`;
        try {
          fs.copyFileSync(safeTarget, backupCopyPath);
        } catch {
          // ignore backup copy failure
        }
      }
    }

    const dir = path.dirname(safeTarget);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(safeTarget, content, 'utf-8');
    AuditLogRepository.create(username, 'FILE_EDIT', `Edited file: ${relativeFilePath}`);
  },

  createDirectory(relativeDirPath: string, username = 'admin'): void {
    const root = this.getServerRoot();
    const safeTarget = SecurityService.resolveSafePath(root, relativeDirPath);
    if (fs.existsSync(safeTarget)) {
      throw new Error('Directory already exists.');
    }
    fs.mkdirSync(safeTarget, { recursive: true });
    AuditLogRepository.create(username, 'DIRECTORY_CREATE', `Created directory: ${relativeDirPath}`);
  },

  deleteFile(relativeFilePath: string, username = 'admin'): void {
    const root = this.getServerRoot();
    const safeTarget = SecurityService.resolveSafePath(root, relativeFilePath);

    if (safeTarget.toLowerCase() === root.toLowerCase()) {
      throw new SecurityError('Cannot delete server root directory.', 'DANGEROUS_OPERATION');
    }

    if (!fs.existsSync(safeTarget)) {
      throw new Error('Target file or directory not found.');
    }

    const stat = fs.statSync(safeTarget);
    if (stat.isDirectory()) {
      fs.rmSync(safeTarget, { recursive: true, force: true });
    } else {
      fs.unlinkSync(safeTarget);
    }
    AuditLogRepository.create(username, 'FILE_DELETE', `Deleted: ${relativeFilePath}`);
  },

  renameFile(oldRelativePath: string, newRelativePath: string, username = 'admin'): void {
    const root = this.getServerRoot();
    const oldTarget = SecurityService.resolveSafePath(root, oldRelativePath);
    const newTarget = SecurityService.resolveSafePath(root, newRelativePath);

    if (!fs.existsSync(oldTarget)) {
      throw new Error('Source file not found.');
    }
    if (fs.existsSync(newTarget)) {
      throw new Error('Destination file already exists.');
    }

    fs.renameSync(oldTarget, newTarget);
    AuditLogRepository.create(username, 'FILE_RENAME', `Renamed from ${oldRelativePath} to ${newRelativePath}`);
  }
};
