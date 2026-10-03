# System Architecture & Monorepo Structure

The Minecraft Server Management platform uses a decoupled client-agent model.

---

## Architecture Diagram

```
[Android Phone / PC Browser]
            │
            ▼ HTTPS / WSS
[Server Agent (Express + ws)]
   ├── Database: SQLite (node:sqlite)
   ├── Security Jail (Safe Path Resolution)
   ├── Process Manager (child_process stdio pipes)
   │     └── Java Process (Minecraft Fabric Server)
   ├── Mod Manager (Modrinth API & JAR parsing)
   ├── Backup Manager (zip snapshots & cron schedule)
   └── Static Asset Server (Vite React bundle)
```

---

## Directory Organization

```
minecraft-server-panel/
├── apps/
│   ├── agent/                 # Windows backend service & WebSocket hub
│   │   ├── src/
│   │   │   ├── config/        # Environment & directory resolvers
│   │   │   ├── database/      # SQLite schema and repositories
│   │   │   ├── middleware/    # Auth, security, rate limiting, errors
│   │   │   ├── routes/        # Express REST API endpoints
│   │   │   ├── services/      # Process, Mods, Files, Backups, Stats, Geyser
│   │   │   ├── websocket/     # Real-time console and metrics dispatcher
│   │   │   ├── app.ts         # Express server configuration
│   │   │   └── index.ts       # Launcher and process signal handlers
│   │   └── tests/             # Vitest automated test suite
│   └── web/                   # Modern React mobile-first frontend
│       ├── src/
│       │   ├── components/    # Navigation, Dialogs, Badges
│       │   ├── layouts/       # Responsive layout (Sidebar / BottomNav)
│       │   ├── pages/         # Dashboard, Console, Players, Mods, Files, etc.
│       │   ├── services/      # Typed API client
│       │   └── hooks/         # useWebSocket, useAuth
│       └── vite.config.ts
├── packages/
│   └── types/                 # Shared TypeScript models and contracts
├── scripts/                   # Setup and launcher scripts for Windows
├── docs/                      # Full technical manuals
├── data/                      # Local SQLite database & default server root
├── backups/                   # Backup archives destination
└── .env.example
```

---

## WebSocket Event Model

The agent pushes live events over `/ws?token=...`:
- `server.console`: Streams every stdout/stderr line with timestamp and parsed level.
- `server.status`: Broadcasts state changes (`ONLINE`, `STOPPING`, `OFFLINE`, `CRASHED`).
- `server.stats`: Pushes live CPU%, Memory RSS, and system load every 2 seconds.
- `server.players`: Pushes online player list when joins/leaves occur.
