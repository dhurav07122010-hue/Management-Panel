# Backup & Disaster Recovery Guide

The Backup Manager provides automated and manual snapshots of your Minecraft worlds and configurations.

---

## 1. What Is Included in a Backup?

Every snapshot packages:
- `world/` (Overworld chunks and player inventories)
- `world_nether/` (Nether dimension)
- `world_the_end/` (The End dimension)
- `server.properties`
- `eula.txt`
- `ops.json`
- `whitelist.json`
- `config/` (Mod configurations and Geyser/Floodgate settings)
- `mods/` (Active mod JAR files)

---

## 2. World Consistency & Safe Chunk Flushing

Before archiving a running server, the agent automatically dispatches:
```minecraft
save-all flush
```
to Minecraft's `stdin` and pauses briefly to guarantee that pending chunk writes in RAM are committed to disk before file copying begins.

---

## 3. Automated Backup Policy

Configured via the **Settings** or **Backups** tab:
- **Frequency**: Standard cron expression (e.g. `0 */6 * * *` for every 6 hours).
- **Retention Count**: Automatically deletes the oldest backups when the total count exceeds your retention limit (default: 10 snapshots).

---

## 4. Restoring a Backup

1. Stop the Minecraft server first. (The agent prevents restoration on a running server to avoid file lock errors and corruption).
2. Go to **Backups**, find the desired snapshot, and click **Restore**.
3. Confirm the warning dialog.
4. Once restoration finishes, you can start the server.
