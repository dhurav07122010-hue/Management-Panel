@echo off
setlocal
cd /d "%~dp0\.."

echo ============================================================
echo   LAUNCHING PUBLIC SECURE CLOUDFLARE TUNNEL
echo ============================================================
echo.

if not exist "cloudflared.exe" (
    echo [ERROR] cloudflared.exe not found!
    pause
    exit /b 1
)

echo Starting tunnel to local port 3001...
echo Look for the https://....trycloudflare.com URL below!
echo.
cloudflared.exe tunnel --url http://localhost:3001
pause
