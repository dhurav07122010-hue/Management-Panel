import type {
  ApiResponse,
  ServerHealthSummary,
  PlayerInfo,
  ConsoleLine,
  ModInfo,
  ModrinthSearchResult,
  ModrinthVersionInfo,
  FileEntry,
  BackupRecord,
  GeyserStatus,
  FloodgateStatus,
  ServerConfigSettings,
  AuditLogEntry,
  UserProfile,
  SetupWizardState
} from '@mc-panel/types';

const TOKEN_KEY = 'mc_panel_token';
const AGENT_URL_KEY = 'mc_panel_agent_url';

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

const GITHUB_TUNNEL_URL = 'https://raw.githubusercontent.com/dhurav07122010-hue/Management-Panel/main/apps/web/public/tunnel.json';
let cachedAutoTunnelUrl: string | null = null;
let tunnelFetchPromise: Promise<string | null> | null = null;

const isBrowser = typeof window !== 'undefined';
const isVercelHost = isBrowser && window.location.hostname.includes('vercel.app');
const isLocalHost = isBrowser && (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  /^192\.168\./.test(window.location.hostname) ||
  /^10\./.test(window.location.hostname)
);

// If local user has a stale auto-populated trycloudflare URL in localStorage, clear it
if (isLocalHost) {
  const currentSaved = localStorage.getItem(AGENT_URL_KEY);
  if (currentSaved && currentSaved.includes('.trycloudflare.com')) {
    localStorage.removeItem(AGENT_URL_KEY);
  }
}

export async function refreshTunnelUrl(): Promise<string | null> {
  if (!isBrowser) return null;
  if (tunnelFetchPromise) return tunnelFetchPromise;

  tunnelFetchPromise = (async () => {
    try {
      const res = await fetch(`${GITHUB_TUNNEL_URL}?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = (await res.json()) as { url?: string };
        if (data && typeof data.url === 'string' && data.url.startsWith('http')) {
          const liveUrl = data.url.trim().replace(/\/$/, '');
          cachedAutoTunnelUrl = liveUrl;
          return liveUrl;
        }
      }
    } catch (e) {
      console.warn('[API] Could not fetch live tunnel from GitHub:', e);
    } finally {
      tunnelFetchPromise = null;
    }
    return null;
  })();

  return tunnelFetchPromise;
}

// Background auto-fetch of live tunnel config for remote deployments
if (isBrowser && (!isLocalHost || isVercelHost)) {
  refreshTunnelUrl().catch(() => {});
}

export function getAgentBaseUrl(): string {
  // 1. User manual override in localStorage (e.g. from Settings or Login "Server Agent Connection Settings")
  const savedUrl = isBrowser ? localStorage.getItem(AGENT_URL_KEY) : null;
  if (savedUrl && savedUrl.trim()) {
    const cleanSaved = savedUrl.trim().replace(/\/$/, '');
    // If local user had an old stale trycloudflare URL, clean it up
    if (isLocalHost && cleanSaved.includes('.trycloudflare.com')) {
      localStorage.removeItem(AGENT_URL_KEY);
    } else {
      return cleanSaved;
    }
  }

  // 2. Direct same-host connection for local/LAN hosts
  if (isLocalHost) {
    return '';
  }

  // 3. Dynamic live tunnel from memory cache (fetched from GitHub tunnel.json)
  if (cachedAutoTunnelUrl) {
    return cachedAutoTunnelUrl.trim().replace(/\/$/, '');
  }

  // 4. Vite environment variable configured at build/deployment time
  const envUrl = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_AGENT_URL;
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/$/, '');
  }

  // 5. Fallback to same host
  return '';
}

export function setAgentBaseUrl(url: string): void {
  if (!url || !url.trim()) {
    localStorage.removeItem(AGENT_URL_KEY);
  } else {
    localStorage.setItem(AGENT_URL_KEY, url.trim().replace(/\/$/, ''));
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const baseUrl = getAgentBaseUrl();
  const fullUrl = endpoint.startsWith('http://') || endpoint.startsWith('https://')
    ? endpoint
    : `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers: Record<string, string> = {
    'Bypass-Tunnel-Reminder': 'true',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  let response: Response;
  try {
    response = await fetch(fullUrl, {
      ...options,
      headers,
      signal: options.signal || controller.signal,
    });
  } catch (netErr) {
    clearTimeout(timeoutId);

    // Auto-retry once if using tunnel URL and network failed (tunnel might have rotated)
    const isRetry = Boolean(headers['x-retry-attempt']);
    if (!isRetry && (!isLocalHost || baseUrl.includes('.trycloudflare.com'))) {
      const freshUrl = await refreshTunnelUrl();
      if (freshUrl && freshUrl !== baseUrl) {
        return request<T>(endpoint, {
          ...options,
          headers: { ...headers, 'x-retry-attempt': '1' }
        });
      }
    }

    const isVercel = window.location.hostname.includes('vercel.app');
    const msg = isVercel && !baseUrl
      ? 'Cannot connect to Server Agent. Please enter your Server Agent URL on the Login page.'
      : `Cannot reach Server Agent at ${fullUrl}. Please check your connection.`;
    const err = new Error(msg);
    (err as unknown as { code?: string }).code = 'NETWORK_ERROR';
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  const contentType = response.headers.get('content-type') || '';
  let data: ApiResponse<T>;

  if (contentType.includes('application/json')) {
    data = await response.json().catch(() => ({
      success: false,
      error: { code: 'NETWORK_ERROR', message: 'Malformed JSON received from server' }
    }));
  } else {
    // If receiving HTML (e.g. Cloudflare error 502/530 or Vercel 404), attempt tunnel refresh
    const isRetry = Boolean(headers['x-retry-attempt']);
    if (!isRetry && (!isLocalHost || baseUrl.includes('.trycloudflare.com'))) {
      const freshUrl = await refreshTunnelUrl();
      if (freshUrl && freshUrl !== baseUrl) {
        return request<T>(endpoint, {
          ...options,
          headers: { ...headers, 'x-retry-attempt': '1' }
        });
      }
    }

    const isVercel = window.location.hostname.includes('vercel.app');
    const helpfulMsg = isVercel && !baseUrl
      ? 'Server Agent not connected. Please enter your Windows Agent URL under "Server Agent Connection Settings".'
      : `Server returned non-JSON response (${response.status}). Please check Agent endpoint.`;
    data = {
      success: false,
      error: { code: 'INVALID_RESPONSE', message: helpfulMsg }
    };
  }

  if (!response.ok || !data.success) {
    if (response.status === 401) {
      removeAuthToken();
      if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/setup')) {
        window.location.href = '/login';
      }
    }
    const message = data.error?.message || `Request failed with status ${response.status}`;
    const err = new Error(message);
    (err as unknown as { code?: string }).code = data.error?.code || 'UNKNOWN_ERROR';
    throw err;
  }

  return data.data as T;
}

export const api = {
  // Setup
  async getSetupStatus(): Promise<SetupWizardState> {
    return request<SetupWizardState>('/api/setup/status');
  },
  async completeSetup(payload: {
    adminPassword: string;
    serverDirectory: string;
    javaPath?: string;
    serverJar?: string;
    minRam?: string;
    maxRam?: string;
    startCommand?: string;
    autoStart?: boolean;
    autoRestartOnCrash?: boolean;
    restartDelaySeconds?: number;
    backupDirectory?: string;
    autoBackupEnabled?: boolean;
  }): Promise<{ message: string }> {
    return request('/api/setup/complete', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  // Auth
  async login(username: string, password: string): Promise<{ token: string; user: UserProfile }> {
    const res = await request<{ token: string; user: UserProfile }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    setAuthToken(res.token);
    return res;
  },
  async logout(): Promise<void> {
    try {
      await request('/api/auth/logout', { method: 'POST' });
    } finally {
      removeAuthToken();
    }
  },
  async getMe(): Promise<{ user: UserProfile }> {
    return request('/api/auth/me');
  },
  async changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
    return request('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword })
    });
  },

  // Server Control
  async getServerStatus(): Promise<ServerHealthSummary> {
    return request<ServerHealthSummary>('/api/server/status');
  },
  async startServer(): Promise<{ message: string }> {
    return request('/api/server/start', { method: 'POST' });
  },
  async stopServer(): Promise<{ message: string }> {
    return request('/api/server/stop', { method: 'POST' });
  },
  async restartServer(): Promise<{ message: string }> {
    return request('/api/server/restart', { method: 'POST' });
  },
  async killServer(): Promise<{ message: string }> {
    return request('/api/server/kill', { method: 'POST' });
  },
  async sendCommand(command: string): Promise<{ message: string }> {
    return request('/api/server/command', {
      method: 'POST',
      body: JSON.stringify({ command })
    });
  },
  async getConsoleLogs(limit = 200): Promise<{ logs: ConsoleLine[] }> {
    return request(`/api/server/console?limit=${limit}`);
  },
  async clearConsoleLogs(): Promise<void> {
    return request('/api/server/console', { method: 'DELETE' });
  },

  // Players
  async getPlayers(): Promise<{ players: PlayerInfo[] }> {
    return request('/api/server/players');
  },
  async opPlayer(username: string): Promise<void> {
    return request('/api/server/players/op', { method: 'POST', body: JSON.stringify({ username }) });
  },
  async deopPlayer(username: string): Promise<void> {
    return request('/api/server/players/deop', { method: 'POST', body: JSON.stringify({ username }) });
  },
  async kickPlayer(username: string, reason?: string): Promise<void> {
    return request('/api/server/players/kick', { method: 'POST', body: JSON.stringify({ username, reason }) });
  },
  async banPlayer(username: string, reason?: string): Promise<void> {
    return request('/api/server/players/ban', { method: 'POST', body: JSON.stringify({ username, reason }) });
  },
  async pardonPlayer(username: string): Promise<void> {
    return request('/api/server/players/pardon', { method: 'POST', body: JSON.stringify({ username }) });
  },
  async whitelistPlayer(username: string, action: 'add' | 'remove'): Promise<void> {
    return request('/api/server/players/whitelist', { method: 'POST', body: JSON.stringify({ username, action }) });
  },

  // Mods
  async getMods(): Promise<{ mods: ModInfo[] }> {
    return request('/api/mods');
  },
  async toggleMod(filename: string, enabled: boolean): Promise<void> {
    return request('/api/mods/toggle', { method: 'POST', body: JSON.stringify({ filename, enabled }) });
  },
  async deleteMod(filename: string): Promise<void> {
    return request(`/api/mods/${encodeURIComponent(filename)}`, { method: 'DELETE' });
  },
  async uploadMod(file: File): Promise<void> {
    const formData = new FormData();
    formData.append('modFile', file);
    return request('/api/mods/upload', { method: 'POST', body: formData });
  },
  async searchModrinth(query: string, mcVersion = '1.21.1'): Promise<{ results: ModrinthSearchResult[] }> {
    return request(`/api/mods/search?q=${encodeURIComponent(query)}&mcVersion=${encodeURIComponent(mcVersion)}`);
  },
  async getModrinthVersions(projectId: string, mcVersion = '1.21.1'): Promise<{ versions: ModrinthVersionInfo[] }> {
    return request(`/api/mods/versions/${encodeURIComponent(projectId)}?mcVersion=${encodeURIComponent(mcVersion)}`);
  },
  async installModrinthMod(projectId: string, versionId?: string, mcVersion = '1.21.1'): Promise<void> {
    return request('/api/mods/install', {
      method: 'POST',
      body: JSON.stringify({ projectId, versionId, mcVersion })
    });
  },

  // Files
  async getFiles(subPath = ''): Promise<{ currentPath: string; files: FileEntry[] }> {
    return request(`/api/files?path=${encodeURIComponent(subPath)}`);
  },
  async getFileContent(filePath: string): Promise<{ path: string; content: string }> {
    return request(`/api/files/content?path=${encodeURIComponent(filePath)}`);
  },
  async saveFileContent(filePath: string, content: string): Promise<void> {
    return request('/api/files/content', {
      method: 'PUT',
      body: JSON.stringify({ path: filePath, content })
    });
  },
  async createDirectory(dirPath: string): Promise<void> {
    return request('/api/files/directory', {
      method: 'POST',
      body: JSON.stringify({ path: dirPath })
    });
  },
  async renamePath(oldPath: string, newPath: string): Promise<void> {
    return request('/api/files/rename', {
      method: 'POST',
      body: JSON.stringify({ oldPath, newPath })
    });
  },
  async deletePath(targetPath: string): Promise<void> {
    return request('/api/files', {
      method: 'DELETE',
      body: JSON.stringify({ path: targetPath })
    });
  },
  async uploadFile(destinationPath: string, file: File): Promise<void> {
    const formData = new FormData();
    formData.append('destinationPath', destinationPath);
    formData.append('file', file);
    return request('/api/files/upload', {
      method: 'POST',
      body: formData
    });
  },

  // Backups
  async getBackups(): Promise<{ backups: BackupRecord[] }> {
    return request('/api/backups');
  },
  async createBackup(type: 'MANUAL' | 'AUTO' = 'MANUAL', notes?: string): Promise<{ backup: BackupRecord }> {
    return request('/api/backups', {
      method: 'POST',
      body: JSON.stringify({ type, notes })
    });
  },
  async restoreBackup(backupId: string): Promise<void> {
    return request(`/api/backups/${backupId}/restore`, { method: 'POST' });
  },
  async deleteBackup(backupId: string): Promise<void> {
    return request(`/api/backups/${backupId}`, { method: 'DELETE' });
  },

  // Geyser & Floodgate
  async getGeyserStatus(): Promise<GeyserStatus> {
    return request('/api/geyser/status');
  },
  async getFloodgateStatus(): Promise<FloodgateStatus> {
    return request('/api/floodgate/status');
  },

  // Settings & System
  async getSettings(): Promise<ServerConfigSettings> {
    return request('/api/settings');
  },
  async updateSettings(settings: Partial<ServerConfigSettings>): Promise<void> {
    return request('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(settings)
    });
  },
  async getAuditLogs(limit = 100): Promise<{ logs: AuditLogEntry[] }> {
    return request(`/api/settings/audit-logs?limit=${limit}`);
  },
  async detectJava(): Promise<{ javaPaths: string[] }> {
    return request('/api/settings/detect-java');
  }
};
