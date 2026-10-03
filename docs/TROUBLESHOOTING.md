# Troubleshooting Guide & Common Solutions

Quick diagnostic reference for common operational scenarios.

---

### 1. "Agent Offline" or Connection Failed on Phone
- **Cause 1**: Phone and PC are on different Wi-Fi networks (e.g. Guest Wi-Fi vs Main Wi-Fi).
  - *Fix*: Connect phone to the exact same Wi-Fi SSID.
- **Cause 2**: Windows Defender Firewall blocked port 3001.
  - *Fix*: Open PowerShell as Administrator and run:
    ```powershell
    New-NetFirewallRule -DisplayName "Minecraft Web Panel" -Direction Inbound -LocalPort 3001 -Protocol TCP -Action Allow
    ```
- **Cause 3**: Agent process was stopped.
  - *Fix*: Double-click `start-panel.bat` on your PC.

---

### 2. Minecraft Server Won't Start
- **Cause 1**: Server JAR filename mismatch.
  - *Fix*: Check **Settings** &gt; **Server JAR**. If your file is named `server.jar` instead of `fabric-server-launch.jar`, update the setting.
- **Cause 2**: Port 25565 is already in use by another running Minecraft instance or background service.
  - *Fix*: Check Windows Task Manager for existing `javaw.exe` or `java.exe` processes and end them.
- **Cause 3**: Java version too old.
  - *Fix*: Minecraft 1.20.5+ requires Java 21+. Use the **Settings** page to point to an installed Java 21+ executable.

---

### 3. Java Not Found
- Verify that Java is installed and in your Windows PATH.
- In Command Prompt, run:
  ```cmd
  java -version
  ```
- If Java is in a non-standard folder (such as `C:\Program Files\Eclipse Adoptium\jdk-21\bin\java.exe`), paste that full path directly into **Settings** &gt; **Java Executable Path**.

---

### 4. Mod Incompatible or Crash on Startup
- Check the **Console** tab for the stack trace or crash report.
- Often, a Fabric mod requires `Fabric API` (`fabric-api.jar`) or an updated Fabric Loader.
- Go to **Mods**, disable the offending mod using the toggle switch, and click **START** again.

---

### 5. Geyser / Floodgate Not Detected
- Ensure the Geyser Fabric mod is in the `mods/` directory and named with `geyser` (e.g. `Geyser-Fabric.jar`).
- For Floodgate, ensure `Floodgate-Fabric.jar` is in `mods/`. On first startup, Floodgate automatically creates its configuration directory and generates `key.pem`.

---

### 6. WebSocket Disconnected / Reconnecting
- The panel will automatically retry connecting every 3 seconds.
- If it doesn't reconnect, verify that your session has not expired by refreshing the browser and logging in.
