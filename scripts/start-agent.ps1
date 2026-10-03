# ============================================================
# start-agent.ps1
# Starts the Agent Watchdog and outbound connection in background
# ============================================================

$ProjectDir = (Resolve-Path "$PSScriptRoot\..").Path
$WatchdogScript = Join-Path $ProjectDir "apps\agent\dist\client\watchdog.js"

Write-Host "Starting Minecraft Management Agent in background..." -ForegroundColor Cyan
Start-Process -FilePath "node.exe" -ArgumentList "`"$WatchdogScript`"" -WorkingDirectory $ProjectDir -WindowStyle Hidden
Write-Host "[SUCCESS] Agent Watchdog launched." -ForegroundColor Green
