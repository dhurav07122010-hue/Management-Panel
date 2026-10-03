@echo off
setlocal enabledelayedexpansion

echo ============================================================
echo   MINECRAFT SERVER PANEL - ONE-CLICK WINDOWS SETUP
echo ============================================================

REM 1. Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH!
    echo Please install Node.js (LTS version 20+ recommended) from https://nodejs.org
    pause
    exit /b 1
)

REM 2. Check Java
where java >nul 2>nul
if %errorlevel% neq 0 (
    echo [WARNING] Java was not found in PATH.
    echo Minecraft requires Java 21+ for modern versions (1.20.5+).
)

echo [1/4] Installing monorepo dependencies...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install npm dependencies.
    pause
    exit /b 1
)

echo [2/4] Building shared types...
call npm run build --workspace=@mc-panel/types
if %errorlevel% neq 0 (
    echo [ERROR] Failed to build types package.
    pause
    exit /b 1
)

echo [3/4] Building server agent...
call npm run build --workspace=@mc-panel/agent
if %errorlevel% neq 0 (
    echo [ERROR] Failed to build agent backend.
    pause
    exit /b 1
)

echo [4/4] Building React web frontend...
call npm run build --workspace=@mc-panel/web
if %errorlevel% neq 0 (
    echo [ERROR] Failed to build web frontend.
    pause
    exit /b 1
)

echo ============================================================
echo   SETUP COMPLETED SUCCESSFULLY!
echo   You can now launch the panel by running: start-panel.bat
echo ============================================================
pause
