@echo off
setlocal

echo ============================================================
echo   INSTALLING MINECRAFT SERVER AGENT TO WINDOWS STARTUP
echo ============================================================
echo.

cd /d "%~dp0"
set "PROJECT_DIR=%CD%"
set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "STARTUP_VBS=%STARTUP_FOLDER%\MinecraftServerAgent.vbs"

if not exist "%STARTUP_FOLDER%" (
    echo [ERROR] Could not find Windows Startup folder: %STARTUP_FOLDER%
    pause
    exit /b 1
)

(
echo Set WshShell = CreateObject("WScript.Shell"^)
echo ProjectDir = "%PROJECT_DIR%"
echo WshShell.CurrentDirectory = ProjectDir
echo WshShell.Run """" ^& ProjectDir ^& "\scripts\run-watchdog-silent.bat""", 0, False
) > "%STARTUP_VBS%"

if exist "%STARTUP_VBS%" (
    echo [SUCCESS] Auto-start script installed to:
    echo %STARTUP_VBS%
    echo.
    echo The Server Agent will now start automatically in the background
    echo whenever Windows boots or logs in!
) else (
    echo [ERROR] Failed to write to Startup folder.
)

echo.
pause
