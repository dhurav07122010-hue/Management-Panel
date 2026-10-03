@echo off
setlocal
cd /d "%~dp0\.."
echo Starting standalone Agent in development mode with live reload...
npm run dev --workspace=@mc-panel/agent
pause
