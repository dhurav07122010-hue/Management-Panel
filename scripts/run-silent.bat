@echo off
setlocal
cd /d "%~dp0\.."

REM Ensure node is available
where node >nul 2>nul
if %errorlevel% neq 0 (
    exit /b 1
)

REM Launch agent watchdog in background logging output to data/agent-service.log
node apps\agent\dist\client\watchdog.js >> "data\agent-service.log" 2>&1


