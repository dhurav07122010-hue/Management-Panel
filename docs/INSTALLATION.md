# Installation Guide

This guide walks you through setting up and running the Minecraft Server Management Web Panel on a Windows machine.

---

## 1. Prerequisites

1. **Windows 10 / 11 / Windows Server**
2. **Node.js (v20+ LTS recommended, v25+ fully supported)**:
   - Download and install from [https://nodejs.org](https://nodejs.org).
   - Ensure the checkbox "Add to PATH" is checked during installation.
3. **Java Runtime (Java 21 or Java 25 recommended for Minecraft 1.20.5+)**:
   - Download Eclipse Adoptium Temurin or Oracle JDK.
   - Verify by opening PowerShell or Command Prompt and running:
     ```cmd
     java -version
     ```

---

## 2. Fast Setup (One-Click)

1. Open the project root directory in Windows Explorer.
2. Double-click `setup.bat`.
3. The script will:
   - Install all required npm packages across the monorepo workspaces.
   - Compile `@mc-panel/types`.
   - Compile `@mc-panel/agent`.
   - Bundle the React production frontend with Vite into `apps/web/dist`.
4. Once setup finishes, double-click `start-panel.bat`.

---

## 3. First-Run Setup Wizard

1. Open your browser to `http://localhost:3001` (or click the address shown in the command console).
2. Follow the 10-step wizard:
   - **Step 1**: Choose an administrator password for user `admin`.
   - **Step 2**: Select your Minecraft server directory (e.g. `C:\MinecraftServer` or `./data/minecraft-server`).
   - **Step 3**: Select the detected Java installation path.
   - **Step 4**: Enter your server JAR name (default `fabric-server-launch.jar`) and RAM limits.
   - **Step 5 - 7**: Review detected mods directory, GeyserMC UDP configuration, and Floodgate keys.
   - **Step 8**: Configure automated backup frequency and retention.
   - **Step 9 - 10**: Verify configuration and complete setup.
3. Log in with `admin` and your chosen password.
