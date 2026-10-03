// Server execution state
export type ServerState = 'OFFLINE' | 'STARTING' | 'ONLINE' | 'STOPPING' | 'CRASHED';

// Process and hardware metrics
export interface ServerStats {
  cpuPercent: number;
  memoryUsedMb: number;
  memoryTotalMb: number;
  systemCpuPercent: number;
  systemMemoryUsedMb: number;
  systemMemoryTotalMb: number;
  diskTotalGb?: number;
  diskFreeGb?: number;
  diskUsedPercent?: number;
  uptimeSeconds: number;
  tps?: number;
  timestamp: number;
}

// Player information
export interface PlayerInfo {
  username: string;
  uuid?: string;
  isOnline: boolean;
  isOp: boolean;
  isWhitelisted: boolean;
  lastSeen?: string;
  ping?: number;
}

// Log line streaming
export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

export interface ConsoleLine {
  id: string;
  timestamp: string;
  level: LogLevel;
  raw: string;
  clean: string;
}

// Mod management
export interface ModInfo {
  id: string;
  filename: string;
  name: string;
  version: string;
  description?: string;
  minecraftVersion?: string;
  fabricLoader?: boolean;
  enabled: boolean;
  sizeBytes: number;
  modrinthId?: string;
  latestVersion?: string;
  updateAvailable?: boolean;
  iconUrl?: string;
  authors?: string[];
  warnings?: string[];
}

export interface ModrinthSearchResult {
  id: string;
  slug: string;
  title: string;
  description: string;
  categories: string[];
  clientSide: string;
  serverSide: string;
  iconUrl?: string;
  downloads: number;
  latestVersion?: string;
  versions?: ModrinthVersionInfo[];
}

export interface ModrinthVersionInfo {
  id: string;
  versionNumber: string;
  gameVersions: string[];
  loaders: string[];
  datePublished: string;
  downloadUrl: string;
  filename: string;
  fileSize: number;
  hashes: {
    sha1?: string;
    sha512?: string;
  };
}

// File system items
export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  sizeBytes: number;
  modifiedAt: string;
  isProtected?: boolean;
  isEditable?: boolean;
  extension?: string;
}

// Backup records
export interface BackupRecord {
  id: string;
  filename: string;
  sizeBytes: number;
  createdAt: string;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'FAILED';
  type: 'MANUAL' | 'AUTO' | 'PRE_MOD_CHANGE' | 'PRE_CONFIG_CHANGE';
  notes?: string;
}

// GeyserMC & Floodgate status
export interface GeyserStatus {
  installed: boolean;
  version?: string;
  configPath?: string;
  bedrockAddress?: string;
  bedrockPort?: number;
  javaAddress?: string;
  javaPort?: number;
  authType?: string;
  status: 'ONLINE' | 'OFFLINE' | 'NOT_CONFIGURED';
}

export interface FloodgateStatus {
  installed: boolean;
  version?: string;
  configPath?: string;
  keyPresent: boolean;
  status: 'ONLINE' | 'OFFLINE' | 'NOT_CONFIGURED';
  warnings?: string[];
}

// Audit log entry
export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId?: string;
  username: string;
  action: string;
  details?: string;
  ipAddress?: string;
}

// General Server Configuration & Settings
export interface ServerConfigSettings {
  serverDirectory: string;
  startCommand?: string;
  autoStart?: boolean;
  scheduledRestartEnabled?: boolean;
  scheduledRestartCron?: string;
  minecraftVersion?: string;
  fabricVersion?: string;
  javaPath: string;
  serverJar: string;
  minRam: string;
  maxRam: string;
  javaArgs: string;
  autoRestartOnCrash: boolean;
  maxRestartAttempts: number;
  restartDelaySeconds: number;
  backupDirectory: string;
  autoBackupEnabled: boolean;
  autoBackupCron: string;
  backupRetentionCount: number;
  mockMode: boolean;
  publicHost?: string;
  publicPort?: number;
  publicBedrockPort?: number;
}

// System Health Overview
export interface ServerHealthSummary {
  state: ServerState;
  pid: number | null;
  uptimeSeconds: number;
  playerCount: number;
  maxPlayers: number;
  fabricDetected: boolean;
  geyserDetected: boolean;
  floodgateDetected: boolean;
  minecraftVersion?: string;
  fabricVersion?: string;
  tps?: number;
  startCommand?: string;
  stats: ServerStats;
  lastCrash?: {
    timestamp: string;
    exitCode: number | null;
    reason?: string;
  };
}

// Setup Wizard DTO
export interface SetupWizardState {
  isSetupComplete: boolean;
  detectedJavaPaths: string[];
  suggestedServerDir: string;
  suggestedBackupDir?: string;
  currentSettings?: Partial<ServerConfigSettings>;
}

// API standard response format
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// User & Auth
export interface UserProfile {
  id: string;
  username: string;
  createdAt: string;
}

export interface AuthSession {
  token: string;
  user: UserProfile;
  expiresAt: string;
}

// WebSocket Message Types
export type WebSocketEventType =
  | 'server.status'
  | 'server.stats'
  | 'server.console'
  | 'server.players'
  | 'server.crashed'
  | 'backup.progress'
  | 'mod.progress'
  | 'agent.connected'
  | 'agent.pong';

export interface WebSocketMessage<T = unknown> {
  type: WebSocketEventType;
  payload: T;
  timestamp: string;
}
