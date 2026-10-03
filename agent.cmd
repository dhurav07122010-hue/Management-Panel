@echo off
setlocal
cd /d "%~dp0"
node apps\agent\dist\index.js %*
