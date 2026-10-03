# Minecraft Server Management Web Panel

> Production-grade, mobile-first private web control panel for Minecraft servers hosted on Windows. Designed specifically for Fabric with GeyserMC and Floodgate support.

---

## 🎮 Highlights & Features

- **📱 Mobile-First UI**: Native bottom navigation on Android & iPhone browsers, responsive dark gamer theme, large touch targets, collapsible desktop sidebar.
- **⚡ Live Interactive Console**: Real-time WebSocket streaming of `stdout`/`stderr`, log search and level filtering (INFO/WARN/ERROR), auto-scroll lock, interactive command line with arrow-key history (`/say`, `/op`, `/time`, etc.).
- **🧩 Fabric Mod Manager**:
  - Scan installed mods with version and metadata extraction.
  - Enable / Disable toggle without deleting files (moves between `mods/` and `mods-disabled/`).
  - Search and 1-click install mods directly from Modrinth with SHA-512 checksum validation.
  - Upload `.jar` files straight from your phone.
- **🛡️ Rock-Solid Security**:
  - Strict path traversal jail preventing escapes (`../`, drive jumping, null bytes).
  - Bcrypt password hashing & session management with IP rate limiting.
  - Floodgate `key.pem` secrecy (private keys are never exposed or transmitted).
  - Pre-modification automated backups before mod changes or critical config edits.
- **📦 Backup & Disaster Recovery**:
  - Full ZIP snapshots of world dimensions, mods, configs, and server properties.
  - Automatic `save-all flush` chunk commit prior to snapshot creation.
  - Configurable automated schedule (cron) with retention limits.
  - One-click restore with verification safeguards.
- **🌐 Network & Bedrock Integration**:
  - GeyserMC UDP (port 19132) configuration inspection.
  - Floodgate key presence verification.
  - Host LAN IP discovery for seamless local network play.
- **🧪 Built-in Mock Mode (`MOCK_MODE=true`)**:
  - Simulate Minecraft status, console streaming, player events, CPU/RAM stats without needing real Minecraft files installed.

---

## 🚀 Quick Start (Windows)

### 1. One-Click Setup
Double-click `setup.bat` or run:
```cmd
npm install
npm run build
```

### 2. Launch Panel
Double-click `start-panel.bat` or run:
```cmd
npm run start
```
The console will display your local address:
- **Local PC**: `http://localhost:3001`
- **Mobile / LAN**: `http://192.168.x.x:3001`

### 3. First-Run Setup Wizard
On first launch, navigate to `http://localhost:3001`. The 10-step setup wizard will guide you through:
1. Setting an administrator password for `admin`.
2. Choosing your Minecraft server directory.
3. Detecting Java and server JAR.
4. Configuring backup schedules.

---

## 📂 Project Architecture

```
minecraft-server-panel/
├── apps/
│   ├── agent/                 # Windows backend service (Express + ws + node:sqlite)
│   └── web/                   # React 18 + Vite + Tailwind CSS mobile-first frontend
├── packages/
│   └── types/                 # Shared TypeScript models and WebSocket contracts
├── scripts/                   # Windows launchers (setup.bat, start-panel.bat)
├── docs/                      # Comprehensive documentation
├── data/                      # Local SQLite database (panel.sqlite)
└── backups/                   # Snapshot storage
```

---

## 📖 Documentation

- [Installation Guide](docs/INSTALLATION.md)
- [Windows Host & Firewall Setup](docs/WINDOWS_SETUP.md)
- [Security Architecture](docs/SECURITY.md)
- [System Architecture](docs/ARCHITECTURE.md)
- [Mod Manager Guide](docs/MOD_MANAGER.md)
- [Backups & Disaster Recovery](docs/BACKUPS.md)
- [Remote Access (Tailscale / VPN)](docs/REMOTE_ACCESS.md)
- [Troubleshooting & FAQ](docs/TROUBLESHOOTING.md)

---

## 🧪 Testing

Run the automated test suite covering security path traversal guards, session authentication, and jailed file operations:

```cmd
npm run test --workspace=@mc-panel/agent
```
All 16 tests will run via Vitest.
