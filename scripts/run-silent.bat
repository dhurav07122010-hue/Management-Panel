@echo off
setlocal
cd /d "%~dp0\.."

REM Ensure node is available
where node >nul 2>nul
if %errorlevel% neq 0 (
    exit /b 1
)

REM Ensure playit tunnel is active
where playit >nul 2>nul
if %errorlevel% equ 0 (
    start "" /b playit start >nul 2>&1
) else (
    if exist "C:\Program Files\playit_gg\bin\playit.exe" (
        start "" /b "C:\Program Files\playit_gg\bin\playit.exe" start >nul 2>&1
    )
)

REM Launch agent in background logging output to data/agent-service.log
node apps\agent\dist\index.js >> "data\agent-service.log" 2>&1
