@echo off
setlocal
cd /d "%~dp0"
if "%~1"=="" (
    set /p NEW_PASS="Enter new admin password: "
) else (
    set NEW_PASS=%~1
)
node scripts\set-admin-password.js "%NEW_PASS%"
pause
