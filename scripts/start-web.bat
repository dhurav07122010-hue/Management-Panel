@echo off
setlocal
cd /d "%~dp0\.."
echo Starting React Vite development server...
npm run dev --workspace=@mc-panel/web
pause
