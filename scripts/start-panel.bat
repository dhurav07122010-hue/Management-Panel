@echo off
setlocal

cd /d "%~dp0\.."

echo ============================================================
echo   LAUNCHING MINECRAFT SERVER CONTROL PANEL
echo ============================================================

REM Check if built
if not exist "apps\agent\dist\index.js" (
    echo Building backend components...
    call npm run build --workspace=@mc-panel/types
    call npm run build --workspace=@mc-panel/agent
)

if not exist "apps\web\dist\index.html" (
    echo Building web frontend...
    call npm run build --workspace=@mc-panel/web
)

echo Starting panel service...
node apps\agent\dist\index.js
pause
