@echo off
setlocal
cd /d "%~dp0"

echo Launching Minecraft Server Agent in the background...
wscript scripts\start-background.vbs
echo Agent started silently! You can monitor output in data\agent-service.log
ping 127.0.0.1 -n 3 >nul 2>&1

