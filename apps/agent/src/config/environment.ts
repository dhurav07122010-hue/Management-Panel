import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';

// Load .env from root or local dir
const envPath = path.resolve(process.cwd(), '../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

export interface Config {
  port: number;
  host: string;
  sessionSecret: string;
  dataDir: string;
  dbPath: string;
  serverDir: string;
  backupDir: string;
  javaPath: string;
  serverJar: string;
  minRam: string;
  maxRam: string;
  javaArgs: string;
  mockMode: boolean;
  autoBackupEnabled: boolean;
  autoBackupCron: string;
  backupRetentionCount: number;
  autoRestartOnCrash: boolean;
  maxRestartAttempts: number;
  restartDelaySeconds: number;
}

const rootDir = path.resolve(process.cwd(), process.cwd().includes('apps') ? '../..' : '.');
const defaultDataDir = path.resolve(rootDir, 'data');
const defaultBackupDir = path.resolve(rootDir, 'backups');
const defaultServerDir = path.resolve(defaultDataDir, 'minecraft-server');

if (!fs.existsSync(defaultDataDir)) {
  fs.mkdirSync(defaultDataDir, { recursive: true });
}
if (!fs.existsSync(defaultBackupDir)) {
  fs.mkdirSync(defaultBackupDir, { recursive: true });
}
if (!fs.existsSync(defaultServerDir)) {
  fs.mkdirSync(defaultServerDir, { recursive: true });
}

export const config: Config = {
  port: parseInt(process.env.AGENT_PORT || process.env.PORT || '3001', 10),
  host: process.env.HOST || '0.0.0.0',
  sessionSecret: process.env.SESSION_SECRET || 'mc-panel-super-secret-key-change-in-production',
  dataDir: defaultDataDir,
  dbPath: process.env.DATABASE_PATH ? path.resolve(rootDir, process.env.DATABASE_PATH) : path.resolve(defaultDataDir, 'panel.sqlite'),
  serverDir: process.env.SERVER_DIRECTORY ? path.resolve(rootDir, process.env.SERVER_DIRECTORY) : defaultServerDir,
  backupDir: process.env.BACKUP_DIRECTORY ? path.resolve(rootDir, process.env.BACKUP_DIRECTORY) : defaultBackupDir,
  javaPath: process.env.JAVA_PATH || 'java',
  serverJar: process.env.SERVER_JAR || 'fabric-server-launch.jar',
  minRam: process.env.MIN_RAM || '2G',
  maxRam: process.env.MAX_RAM || '4G',
  javaArgs: process.env.JAVA_ARGS || '-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200',
  mockMode: process.env.MOCK_MODE === 'true',
  autoBackupEnabled: process.env.AUTO_BACKUP_ENABLED === 'true',
  autoBackupCron: process.env.AUTO_BACKUP_CRON || '0 */6 * * *',
  backupRetentionCount: parseInt(process.env.BACKUP_RETENTION_COUNT || '10', 10),
  autoRestartOnCrash: process.env.AUTO_RESTART_ON_CRASH === 'true',
  maxRestartAttempts: parseInt(process.env.MAX_RESTART_ATTEMPTS || '3', 10),
  restartDelaySeconds: parseInt(process.env.RESTART_DELAY_SECONDS || '10', 10),
};
