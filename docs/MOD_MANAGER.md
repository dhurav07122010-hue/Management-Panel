# Mod Manager & Modrinth Integration

The Mod Manager allows you to install, configure, enable, disable, and upload Fabric mods directly from your Android phone or PC.

---

## 1. Enabling and Disabling Mods

Rather than deleting mod JARs when they cause conflicts or during troubleshooting, the panel preserves them safely:
- **Active Mods**: Stored in `<server_directory>/mods/example.jar`.
- **Disabled Mods**: Moved to `<server_directory>/mods-disabled/example.jar.disabled`.

When you toggle the switch in the Web Panel, the file is safely moved between directories without modifying or corrupting the JAR archive.

---

## 2. Installing from Modrinth

1. Click **Install from Modrinth** on the Mods page.
2. Search for any mod (e.g. `Sodium`, `Lithium`, `FerriteCore`, `Geyser`).
3. The panel queries the official Modrinth API v2 (`https://api.modrinth.com/v2`).
4. The system automatically filters for:
   - Compatible Minecraft game versions (e.g. `1.21.1`).
   - The `fabric` mod loader.
5. Click **Install**.
6. The agent downloads the JAR, validates its SHA-512 / SHA-1 checksum, and creates a pre-modification backup before saving it to `mods/`.

---

## 3. Uploading Mods

- You can select any `.jar` file directly from your mobile phone or PC browser.
- The agent verifies the extension, sanitizes the filename to prevent path traversal, and validates file size (up to 100MB).
