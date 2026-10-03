import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import AdmZip from 'adm-zip';
import { SecurityService } from './security.service.js';
import { SettingsRepository, AuditLogRepository } from '../database/repositories.js';
import { ServerConfigService } from './server-config.service.js';
import { config } from '../config/environment.js';
import type { ModInfo, ModrinthSearchResult, ModrinthVersionInfo } from '@mc-panel/types';

interface FabricModJson {
  id?: string;
  name?: string;
  version?: string;
  description?: string;
  icon?: string;
  authors?: Array<string | { name: string }>;
  depends?: Record<string, string>;
}

export class ModService {
  private static searchCache = new Map<string, { timestamp: number; data: ModrinthSearchResult[] }>();

  public static getModsDirectory(): string {
    const serverDir = ServerConfigService.readConfig().serverDirectory || SettingsRepository.get('serverDirectory') || config.serverDir;
    const modsDir = path.resolve(serverDir, 'mods');
    if (!fs.existsSync(modsDir)) {
      fs.mkdirSync(modsDir, { recursive: true });
    }
    return modsDir;
  }

  public static getDisabledModsDirectory(): string {
    const serverDir = ServerConfigService.readConfig().serverDirectory || SettingsRepository.get('serverDirectory') || config.serverDir;
    const disabledDir = path.resolve(serverDir, 'mods-disabled');
    if (!fs.existsSync(disabledDir)) {
      fs.mkdirSync(disabledDir, { recursive: true });
    }
    return disabledDir;
  }

  /**
   * Scans both mods/ and mods-disabled/ directories, parses Fabric metadata from JARs.
   */
  public static listInstalledMods(): ModInfo[] {
    const modsDir = this.getModsDirectory();
    const disabledDir = this.getDisabledModsDirectory();
    const mods: ModInfo[] = [];

    // 1. Scan active mods
    if (fs.existsSync(modsDir)) {
      const files = fs.readdirSync(modsDir);
      for (const file of files) {
        if (file.endsWith('.jar')) {
          const fullPath = path.join(modsDir, file);
          const info = this.parseJarMetadata(fullPath, file, true);
          mods.push(info);
        }
      }
    }

    // 2. Scan disabled mods
    if (fs.existsSync(disabledDir)) {
      const files = fs.readdirSync(disabledDir);
      for (const file of files) {
        if (file.endsWith('.jar') || file.endsWith('.jar.disabled')) {
          const fullPath = path.join(disabledDir, file);
          const originalName = file.replace(/\.disabled$/, '');
          const info = this.parseJarMetadata(fullPath, originalName, false);
          mods.push(info);
        }
      }
    }

    return mods.sort((a, b) => a.name.localeCompare(b.name));
  }

  private static parseJarMetadata(fullPath: string, filename: string, enabled: boolean): ModInfo {
    const stat = fs.statSync(fullPath);
    let id = filename.replace(/\.jar(\.disabled)?$/, '');
    let name = id;
    let version = 'unknown';
    let description = '';
    let minecraftVersion: string | undefined;
    let fabricLoader = false;
    const authors: string[] = [];
    const warnings: string[] = [];

    try {
      const zip = new AdmZip(fullPath);
      const zipEntries = zip.getEntries();
      const fabricEntry = zipEntries.find((e) => e.entryName === 'fabric.mod.json');

      if (fabricEntry) {
        fabricLoader = true;
        const text = fabricEntry.getData().toString('utf-8');
        const parsed = JSON.parse(text) as FabricModJson;

        if (parsed.id) id = parsed.id;
        if (parsed.name) name = parsed.name;
        if (parsed.version) version = parsed.version;
        if (parsed.description) description = parsed.description;

        if (parsed.authors) {
          for (const a of parsed.authors) {
            authors.push(typeof a === 'string' ? a : a.name);
          }
        }

        if (parsed.depends) {
          if (parsed.depends.minecraft) {
            minecraftVersion = parsed.depends.minecraft;
          }
        }
      } else {
        // Could be a paper/forge jar or library
        warnings.push('fabric.mod.json not found in archive');
      }
    } catch (e) {
      warnings.push('Could not parse JAR metadata: ' + (e instanceof Error ? e.message : 'Unknown error'));
    }

    return {
      id,
      filename,
      name,
      version,
      description,
      minecraftVersion,
      fabricLoader,
      enabled,
      sizeBytes: stat.size,
      authors: authors.length > 0 ? authors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Toggles a mod between enabled and disabled by moving between mods/ and mods-disabled/.
   */
  public static toggleMod(filename: string, enable: boolean, username = 'admin'): void {
    const modsDir = this.getModsDirectory();
    const disabledDir = this.getDisabledModsDirectory();

    const cleanFilename = SecurityService.sanitizeFilename(filename);

    if (enable) {
      // Look in disabledDir
      let sourcePath = path.join(disabledDir, cleanFilename);
      if (!fs.existsSync(sourcePath) && !sourcePath.endsWith('.disabled')) {
        sourcePath = path.join(disabledDir, cleanFilename + '.disabled');
      }

      if (!fs.existsSync(sourcePath)) {
        throw new Error(`Disabled mod file not found: ${cleanFilename}`);
      }

      const destFilename = cleanFilename.replace(/\.disabled$/, '');
      const destPath = path.join(modsDir, destFilename);

      fs.renameSync(sourcePath, destPath);
      AuditLogRepository.create(username, 'MOD_ENABLE', `Enabled mod: ${destFilename}`);
    } else {
      // Look in modsDir
      const sourcePath = path.join(modsDir, cleanFilename);
      if (!fs.existsSync(sourcePath)) {
        throw new Error(`Active mod file not found: ${cleanFilename}`);
      }

      const destFilename = cleanFilename.endsWith('.disabled') ? cleanFilename : cleanFilename + '.disabled';
      const destPath = path.join(disabledDir, destFilename);

      fs.renameSync(sourcePath, destPath);
      AuditLogRepository.create(username, 'MOD_DISABLE', `Disabled mod: ${cleanFilename}`);
    }
  }

  /**
   * Deletes a mod permanently from disk.
   */
  public static deleteMod(filename: string, username = 'admin'): void {
    const modsDir = this.getModsDirectory();
    const disabledDir = this.getDisabledModsDirectory();
    const cleanFilename = SecurityService.sanitizeFilename(filename);

    const activePath = path.join(modsDir, cleanFilename);
    const disabledPath = path.join(disabledDir, cleanFilename);
    const disabledSuffixPath = path.join(disabledDir, cleanFilename + '.disabled');

    let deleted = false;
    if (fs.existsSync(activePath)) {
      fs.unlinkSync(activePath);
      deleted = true;
    }
    if (fs.existsSync(disabledPath)) {
      fs.unlinkSync(disabledPath);
      deleted = true;
    }
    if (fs.existsSync(disabledSuffixPath)) {
      fs.unlinkSync(disabledSuffixPath);
      deleted = true;
    }

    if (!deleted) {
      throw new Error(`Mod file not found: ${cleanFilename}`);
    }

    AuditLogRepository.create(username, 'MOD_DELETE', `Deleted mod: ${cleanFilename}`);
  }

  /**
   * Searches Modrinth for mods compatible with Fabric.
   */
  public static async searchModrinth(query: string, mcVersion = '1.21.1', limit = 20): Promise<ModrinthSearchResult[]> {
    const cacheKey = `${query}_${mcVersion}_${limit}`;
    const cached = this.searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 3 * 60 * 1000) {
      return cached.data;
    }

    const facets: string[][] = [
      ['project_type:mod'],
      ['categories:fabric']
    ];
    if (mcVersion) {
      facets.push([`versions:${mcVersion}`]);
    }

    const url = new URL('https://api.modrinth.com/v2/search');
    url.searchParams.set('query', query);
    url.searchParams.set('facets', JSON.stringify(facets));
    url.searchParams.set('limit', limit.toString());

    try {
      const response = await fetch(url.toString(), {
        headers: {
          'User-Agent': 'MinecraftServerManagementPanel/1.0.0 (contact@internal-panel.local)'
        }
      });

      if (!response.ok) {
        throw new Error(`Modrinth API responded with status ${response.status}`);
      }

      const data = (await response.json()) as {
        hits: Array<{
          project_id: string;
          slug: string;
          title: string;
          description: string;
          categories: string[];
          client_side: string;
          server_side: string;
          icon_url?: string;
          downloads: number;
        }>;
      };

      const results: ModrinthSearchResult[] = data.hits.map((h) => ({
        id: h.project_id,
        slug: h.slug,
        title: h.title,
        description: h.description,
        categories: h.categories,
        clientSide: h.client_side,
        serverSide: h.server_side,
        iconUrl: h.icon_url,
        downloads: h.downloads
      }));

      this.searchCache.set(cacheKey, { timestamp: Date.now(), data: results });
      return results;
    } catch (error) {
      console.error('Error fetching from Modrinth:', error);
      return [];
    }
  }

  /**
   * Fetches versions for a given Modrinth project.
   */
  public static async getModrinthProjectVersions(projectIdOrSlug: string, mcVersion = '1.21.1'): Promise<ModrinthVersionInfo[]> {
    const url = new URL(`https://api.modrinth.com/v2/project/${projectIdOrSlug}/version`);
    url.searchParams.set('loaders', JSON.stringify(['fabric']));
    if (mcVersion) {
      url.searchParams.set('game_versions', JSON.stringify([mcVersion]));
    }

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'MinecraftServerManagementPanel/1.0.0 (contact@internal-panel.local)'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch versions for mod ${projectIdOrSlug}`);
    }

    const versions = (await response.json()) as Array<{
      id: string;
      version_number: string;
      game_versions: string[];
      loaders: string[];
      date_published: string;
      files: Array<{
        url: string;
        filename: string;
        size: number;
        primary: boolean;
        hashes: { sha1?: string; sha512?: string };
      }>;
    }>;

    return versions.map((v) => {
      const primaryFile = v.files.find((f) => f.primary) || v.files[0];
      return {
        id: v.id,
        versionNumber: v.version_number,
        gameVersions: v.game_versions,
        loaders: v.loaders,
        datePublished: v.date_published,
        downloadUrl: primaryFile?.url || '',
        filename: primaryFile?.filename || `${projectIdOrSlug}-${v.version_number}.jar`,
        fileSize: primaryFile?.size || 0,
        hashes: primaryFile?.hashes || {}
      };
    });
  }

  /**
   * Downloads and validates a mod JAR directly into the mods directory with checksum verification.
   */
  public static async installModFromModrinth(
    projectId: string,
    versionId?: string,
    mcVersion = '1.21.1',
    username = 'admin'
  ): Promise<{ filename: string; sizeBytes: number }> {
    const versions = await this.getModrinthProjectVersions(projectId, mcVersion);
    if (versions.length === 0) {
      throw new Error(`No compatible Fabric versions found for Minecraft ${mcVersion}`);
    }

    const targetVersion = versionId ? versions.find((v) => v.id === versionId) || versions[0] : versions[0];
    if (!targetVersion || !targetVersion.downloadUrl) {
      throw new Error('Version has no valid download URL');
    }

    const modsDir = this.getModsDirectory();
    const sanitizedFilename = SecurityService.sanitizeFilename(targetVersion.filename);
    const destPath = path.join(modsDir, sanitizedFilename);
    const tempPath = destPath + '.tmp';

    // Download stream to temp file
    const response = await fetch(targetVersion.downloadUrl, {
      headers: {
        'User-Agent': 'MinecraftServerManagementPanel/1.0.0 (contact@internal-panel.local)'
      }
    });

    if (!response.ok) {
      throw new Error(`Download failed with status ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Verify SHA-512 or SHA-1 hash if provided by Modrinth
    if (targetVersion.hashes.sha512) {
      const computed = crypto.createHash('sha512').update(buffer).digest('hex');
      if (computed.toLowerCase() !== targetVersion.hashes.sha512.toLowerCase()) {
        throw new Error('Downloaded file failed SHA-512 checksum validation');
      }
    } else if (targetVersion.hashes.sha1) {
      const computed = crypto.createHash('sha1').update(buffer).digest('hex');
      if (computed.toLowerCase() !== targetVersion.hashes.sha1.toLowerCase()) {
        throw new Error('Downloaded file failed SHA-1 checksum validation');
      }
    }

    // Write temp and rename
    fs.writeFileSync(tempPath, buffer);
    if (fs.existsSync(destPath)) {
      fs.unlinkSync(destPath);
    }
    fs.renameSync(tempPath, destPath);

    AuditLogRepository.create(
      username,
      'MOD_INSTALL',
      `Installed mod ${sanitizedFilename} (${targetVersion.versionNumber}) from Modrinth`
    );

    return {
      filename: sanitizedFilename,
      sizeBytes: buffer.length
    };
  }
}
