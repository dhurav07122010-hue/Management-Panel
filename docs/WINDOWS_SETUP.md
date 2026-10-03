# Windows Host Setup & Network Configuration

This document covers running the server management panel on Windows, configuring the Windows Defender Firewall, discovering your LAN IP, and connecting from Android and iPhone mobile browsers.

---

## 1. Discovering Your Local Windows PC IP Address

To access the panel from your phone on the same Wi-Fi network:

1. Open PowerShell or Command Prompt.
2. Run:
   ```cmd
   ipconfig
   ```
3. Look for your active adapter (e.g. `Wireless LAN adapter Wi-Fi` or `Ethernet adapter Ethernet`).
4. Find the line:
   ```
   IPv4 Address. . . . . . . . . . . : 192.168.1.50
   ```
5. Your web control panel is accessible from your mobile phone at:
   ```
   http://192.168.1.50:3001
   ```

---

## 2. Windows Defender Firewall Configuration

Windows may initially block incoming connections from other devices on your home Wi-Fi. To allow your mobile phone to connect:

### Automatic via PowerShell (Run as Administrator):
```powershell
New-NetFirewallRule -DisplayName "Minecraft Web Panel" -Direction Inbound -LocalPort 3001 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "Minecraft Java Server" -Direction Inbound -LocalPort 25565 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "Minecraft Geyser Bedrock" -Direction Inbound -LocalPort 19132 -Protocol UDP -Action Allow
```

### Manual Configuration via GUI:
1. Open Windows Start menu and type **Windows Defender Firewall with Advanced Security**.
2. Click **Inbound Rules** in the left sidebar, then click **New Rule...** on the right.
3. Select **Port**, then click **Next**.
4. Choose **TCP**, and in **Specific local ports**, enter `3001, 25565`.
5. Select **Allow the connection**, choose **Private** network profile, and name the rule `Minecraft Control Panel`.
6. For Bedrock / GeyserMC, repeat the steps selecting **UDP** and port `19132`.

---

## 3. Running as a Background Windows Service (Optional)

You can run the Agent in the background using `pm2` or `node-windows`:

```cmd
npm install -g pm2
pm2 start apps/agent/dist/index.js --name "minecraft-panel"
pm2 save
pm2 startup
```
This ensures the agent starts automatically whenever your Windows PC boots up.
