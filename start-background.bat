@echo off
setlocal
cd /d "%~dp0"

echo Launching Minecraft Server Agent in the background...
wscript scripts\start-background.vbs
echo Agent started silently! You can monitor output in data\agent-service.log
timeout /t 3 >nul
