@echo off
setlocal
cd /d "%~dp0\.."

REM Ensure node is available
where node >nul 2>nul
if %errorlevel% neq 0 (
    exit /b 1
)

:loop
REM Launch agent in background logging output to data/agent-service.log
node apps\agent\dist\index.js >> "data\agent-service.log" 2>&1
ping 127.0.0.1 -n 6 >nul 2>&1
goto loop


