# Security Architecture & Policies

The Minecraft Server Management Web Panel implements defense-in-depth to protect your host Windows operating system.

---

## 1. Path Traversal & Filesystem Jail
- **Absolute Sandbox Enforcement**: All filesystem reads, writes, deletions, and uploads are resolved against the configured server root directory via `SecurityService.resolveSafePath`.
- **Blocked Attack Vectors**:
  - `../` and `..\` directory traversal sequences
  - Windows drive escaping (`C:\Windows`, `D:\...`)
  - Null-byte injection (`%00`)
  - URL-encoded traversal (`%2e%2e%2f`)
  - Symlink escapes

## 2. Secrets & Private Key Protection
- **Floodgate `key.pem` Redaction**: The panel explicitly blocks reading or downloading `key.pem`, private keys, or SSH credentials. The Floodgate status API only performs existence checks without transmitting private keys to the client.
- **Credential Storage**: Passwords are never stored in plaintext. They are salted and hashed using `bcrypt` (12 rounds). Session tokens are 32-byte cryptographically secure random values stored as SHA-256 hashes in the local SQLite database.

## 3. Brute Force & Rate Limiting
- Login attempts are tracked by IP address.
- Consecutive failed attempts trigger progressive exponential throttling and temporary lockout.

## 4. Minecraft Console Execution vs. Shell Execution
- Minecraft commands entered in the console or player management screens are written strictly to the Java process `stdin` stream.
- The web API does **not** expose general OS command execution (`cmd.exe` or `powershell.exe`).

## 5. Pre-Modification Safety Backups
- Destructive operations (mod installation, mod deletion, toggling, or editing critical configuration files such as `server.properties`) automatically generate timestamped backups before applying changes.
