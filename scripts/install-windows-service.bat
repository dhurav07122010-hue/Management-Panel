@echo off
setlocal EnableDelayedExpansion

echo ============================================================
echo   REGISTER MINECRAFT SERVER AGENT AS WINDOWS STARTUP TASK
echo ============================================================
echo.

REM Resolve absolute path to project root
cd /d "%~dp0\.."
set "PROJECT_DIR=%CD%"
set "NODE_EXE=node.exe"

REM Check node exists
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found in PATH!
    echo Please ensure Node.js is installed on your Windows system.
    pause
    exit /b 1
)

for /f "delims=" %%i in ('where node') do set "NODE_PATH=%%i"

echo Project Directory: %PROJECT_DIR%
echo Node.js Path:      %NODE_PATH%
echo.

REM Create startup runner batch script in scripts/
set "RUNNER_BAT=%PROJECT_DIR%\scripts\run-agent-silent.bat"
(
echo @echo off
echo cd /d "%PROJECT_DIR%"
echo "%NODE_PATH%" apps\agent\dist\index.js >> "%PROJECT_DIR%\data\agent-service.log" 2^>^&1
) > "%RUNNER_BAT%"

echo Created startup runner script at: %RUNNER_BAT%
echo.

REM Register task using schtasks.exe to run when user logs on or at system startup
echo Registering Windows Scheduled Task "MinecraftServerAgent"...
schtasks /Create /TN "MinecraftServerAgent" /TR "\"%RUNNER_BAT%\"" /SC ONLOGON /RL HIGHEST /F

if %errorlevel% equ 0 (
    echo.
    echo ============================================================
    echo [SUCCESS] Windows Scheduled Task "MinecraftServerAgent" created!
    echo The Server Agent will automatically start whenever Windows logs in.
    echo.
    echo If Automatic Startup is enabled in your panel settings,
    echo Minecraft will automatically boot immediately after Windows starts!
    echo ============================================================
) else (
    echo.
    echo [WARNING] Could not create scheduled task with highest privilege.
    echo Please right-click this script and select "Run as administrator".
)

echo.
pause
