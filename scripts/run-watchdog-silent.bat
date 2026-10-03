@echo off
cd /d "C:\Users\HP\Documents\Server manager"
"C:\Program Files\nodejs\node.exe" "C:\Users\HP\Documents\Server manager\apps\agent\dist\client\watchdog.js" >> "C:\Users\HP\Documents\Server manager\data\agent-service.log" 2>&1
