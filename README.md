# Minecraft Server Management Control Panel & Persistent Agent

> Production-grade, mobile-friendly Minecraft server control panel with a **persistent outbound agent architecture**. Eliminates the need for flaky local tunnels, open inbound router ports, or DDNS. Built for Windows hosts running Fabric with GeyserMC & Floodgate support.

---

## 🏗️ Architectural Overview

```
             MOBILE / DESKTOP (Browser)
                        │
                        ▼
            WEB MANAGEMENT UI (React 18 + Vite)
                        │
                        │ HTTPS / WSS
                        ▼
          CLOUD CONTROL BACKEND (Express + WebSocket Hub)
                        │
                        │ Persistent outbound authenticated WSS connection
                        │ Bidirectional heartbeat & command channel
                        ▼
            LOCAL AGENT (Windows Host CLI / Service)
                        │
                        ▼
             WINDOWS WATCHDOG SUPERVISOR
           ┌────────────┼────────────┐
           ▼            ▼            ▼
       Minecraft    Files/Mods   System/Logs
```

### 🔒 Key Architectural Improvements:
1. **No Inbound Holes / Tunnels**: The local Windows agent initiates and maintains an **outbound** persistent WebSocket Secure (WSS) connection to the Cloud Backend.
2. **Resilience to Network Shifts**: Works reliably across PC IP changes, Wi-Fi reconnects, router reboots, and temporary internet outages with exponential backoff & jitter reconnection.
3. **Windows Service & Watchdog**: Supervised by a dedicated watchdog that restarts the agent process if crashed or frozen, and automatically starts on Windows boot.
4. **Idempotent Structured Command Protocol**: Commands have unique IDs (`command_xxx`), timeouts, state tracking (`COMMAND_SENT` ➔ `COMMAND_RECEIVED` ➔ `COMMAND_STARTED` ➔ `COMMAND_COMPLETED`), and safe offline queuing.
5. **Bidirectional Heartbeat & Status Engine**: Explicit thresholds (0–20s: 🟢 Online, 20–45s: 🟡 Reconnecting, 45s+: 🔴 Offline).

---

## ⚡ Quick Start

### 1. Install & Build
In the project root, run:
```cmd
npm install
npm run build
```

### 2. Start Cloud Control Backend & Panel
```cmd
npm start
```
The panel will be accessible at:
- **Local PC**: `http://localhost:3001`
- **Mobile / LAN**: `http://192.168.x.x:3001`

### 3. Agent Pairing & Setup
1. Open the Web Panel, log in, and click **Add / Pair Agent** on the Dashboard.
2. The UI will generate a temporary, single-use pairing code (e.g. `XXXX-XXXX`).
3. On the Windows host, run:
```cmd
agent.cmd pair
```
4. Enter the Backend URL and the pairing code.
5. The agent will authenticate, store credentials in `data/agent-config.json`, and transition to 🟢 **ONLINE**.

---

## 🛠️ Windows Service & Watchdog Management

PowerShell and batch scripts are provided in `scripts/`:

| Script | Purpose |
| :--- | :--- |
| `scripts/install-agent-service.ps1` | Registers the Agent Watchdog as a Windows Scheduled Task (starts on boot / logon) |
| `scripts/uninstall-agent-service.ps1` | Unregisters the Agent Scheduled Task from Windows |
| `scripts/start-agent.ps1` | Starts the Agent Watchdog in the background |
| `scripts/stop-agent.ps1` | Stops running Agent and Watchdog processes |
| `scripts/restart-agent.ps1` | Restarts the Agent |
| `scripts/status-agent.ps1` | Queries Agent status and runs the Doctor diagnostic |

---

## 💻 Agent CLI Commands

Run commands directly via `agent.cmd`:

```cmd
agent.cmd start              # Start outbound agent client
agent.cmd stop               # Stop agent
agent.cmd restart            # Restart agent
agent.cmd pair               # Pair Windows agent to Cloud Panel
agent.cmd unpair             # Remove local pairing credentials
agent.cmd status             # View agent ID, status, and config
agent.cmd doctor             # Run comprehensive environment diagnostics
agent.cmd logs [--follow]    # Inspect or tail live agent service logs
agent.cmd version            # Output agent version
agent.cmd --help             # View help
```

### 🩺 Doctor Output Example:
```cmd
agent.cmd doctor

[OK]   Internet & DNS             : Resolved remote host (1.1.1.1)
[OK]   Agent Configuration        : Agent ID: agent_xxxx (Gaming PC)
[OK]   Backend Reachability       : Connected to http://localhost:3001
[OK]   Minecraft Directory        : Found at C:\path\to\minecraft-server
[OK]   Java Runtime               : Found: java
[OK]   System Hardware            : 8 CPU cores, 16 GB RAM
[OK]   Windows Startup Service    : Registered in Windows Task Scheduler

Diagnosis: All critical systems are operational and ready for production management.
```

---

## 🧪 Testing Suite

Run the full automated test suite (including persistent agent pairing, command lifecycle, offline thresholds, and path traversal guards):

```cmd
npm test
```

All 27 automated tests pass with Vitest.
