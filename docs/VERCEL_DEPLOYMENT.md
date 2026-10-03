# Minecraft Server Panel - Complete Production & Vercel Deployment Guide

This guide explains how to deploy your **Minecraft Server Management Dashboard** to **Vercel**, make it an installable **PWA on your Android device**, and securely connect it to the **Windows Server Agent** running on your PC.

---

## 1. Architectural Architecture

```
Android Phone (Browser / PWA)
      │
      ▼ (HTTPS)
Vercel Hosted Web Dashboard (apps/web)
      │
      ▼ (Authenticated HTTPS REST & Secure WSS)
Secure Tunnel / Dynamic DNS / Port Forwarding
      │
      ▼ (Port 3001)
Windows Server Agent (apps/agent on your PC)
      │
      ▼ (Process pipes / stdin / stdout)
Fabric Minecraft Server (Local Java Process)
```

---

## 2. Windows Server Agent Configuration

The Server Agent controls the Minecraft process, guards files against path traversal, and reports metrics.

### Step 1: Run the Server Agent Locally
From your project directory on Windows:
```bat
start-panel.bat
```
Or via terminal:
```bash
npm start
```
The agent starts on port `3001` (by default `http://localhost:3001` and your LAN IP `http://192.168.1.38:3001`).

### Step 2: Auto-Start Agent with Windows Boot
To ensure the Agent starts automatically when your Windows PC boots:
1. Right-click [`scripts/install-windows-service.bat`](file:///c:/Users/HP/Documents/Server%20manager/scripts/install-windows-service.bat) and choose **"Run as Administrator"**.
2. This creates a Windows Scheduled Task (`MinecraftServerAgent`) that launches the Agent on Windows logon.
3. In the Web Panel **Settings**, ensure **"Auto-start Minecraft server automatically when Agent boots"** is turned ON.
4. **Boot Flow**: Windows boots → Server Agent launches → Agent detects Minecraft offline & starts Fabric Java → Web panel reflects **ONLINE**.

---

## 3. Securely Exposing Your Windows Agent for Vercel

Because Vercel is hosted on the public internet, the Vercel web frontend needs an authenticated HTTPS/WSS URL to reach your home PC's Server Agent.

Choose one of the following recommended methods:

### Option A: Cloudflare Tunnel (Recommended - Free, High Security, No Open Ports)
1. Install [Cloudflare `cloudflared`](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/create-local-tunnel/) on Windows.
2. In your Cloudflare Zero Trust Dashboard, create a tunnel pointing to:
   - **Service**: `HTTP`
   - **URL**: `localhost:3001`
   - **Public Hostname**: e.g., `agent.yourdomain.com`
3. Cloudflare gives you a free HTTPS & WSS endpoint (`https://agent.yourdomain.com`).

### Option B: Tailscale Funnel / Tailscale Mesh
1. Install [Tailscale](https://tailscale.com) on your Windows PC and your Android phone.
2. Enable Tailscale on both devices.
3. You can access the Agent directly using your Windows PC's Tailscale IP or MagicDNS hostname (e.g., `http://100.x.y.z:3001`) with zero port forwarding!

### Option C: Router Port Forwarding & Dynamic DNS
1. Forward TCP port `3001` from your home Wi-Fi router to your PC's local IP (`192.168.1.38`).
2. Use a free DDNS service (e.g. DuckDNS, No-IP) to map your home IP to a domain name.

---

## 4. Deploying the Frontend to Vercel

### Step 1: Push Code to GitHub / GitLab
Make sure your project repository is committed and pushed to GitHub:
```bash
git add .
git commit -m "feat: production-ready Vercel + PWA Minecraft Panel"
git push
```

### Step 2: Import into Vercel
1. Log in to [Vercel](https://vercel.com).
2. Click **"Add New"** → **"Project"**.
3. Select your GitHub repository.
4. Configure Build & Development Settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `apps/web`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

### Step 3: Environment Variables on Vercel
Under **Environment Variables** in Vercel:
| Variable Name | Value | Purpose |
| :--- | :--- | :--- |
| `VITE_AGENT_URL` | `https://agent.yourdomain.com` (or leave blank) | Default endpoint for the Windows Agent |

> [!NOTE]
> Even if `VITE_AGENT_URL` is left blank, you can enter your Agent URL right on the **Login** page under **"Server Agent Connection Settings"** or in the **Settings** page! It gets stored securely in your browser's `localStorage` and never gets leaked to public code.

Click **Deploy**! Vercel will build and assign you a URL (e.g., `https://mc-panel.vercel.app`).

---

## 5. Installing the PWA on Your Android Phone

1. On your Android phone, open Chrome or your preferred browser.
2. Visit your Vercel URL (e.g. `https://mc-panel.vercel.app`) or your local Wi-Fi URL (`http://192.168.1.38:3001`).
3. Tap the **Three Dots (Menu)** in the browser.
4. Select **"Install app"** or **"Add to Home screen"**.
5. The **Minecraft Server Manager** icon will be placed directly on your phone's home screen!
6. Opening it gives you a full-screen, native app experience with no browser address bar.

---

## 6. Crash Recovery & Auto-Restart

The Server Agent contains an automated crash recovery watchdog:
- If Java exits unexpectedly with an error code, the agent marks the state as `CRASHED` and notifies all connected clients via WebSocket.
- The agent waits the configured delay (`restartDelaySeconds`, default 10s) and automatically relaunches the server.
- To prevent infinite loops in case of corrupt configs, it caps attempts to `maxRestartAttempts` (default 3) within a 5-minute window.
