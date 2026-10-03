@echo off
setlocal

echo ============================================================
echo   UNREGISTER MINECRAFT SERVER AGENT WINDOWS TASK
echo ============================================================
echo.

schtasks /Delete /TN "MinecraftServerAgent" /F

if %errorlevel% equ 0 (
    echo.
    echo [SUCCESS] Windows Scheduled Task "MinecraftServerAgent" deleted.
) else (
    echo.
    echo [INFO] Task "MinecraftServerAgent" was not found or already deleted.
)

echo.
pause
