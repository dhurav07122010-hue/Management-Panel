# ============================================================
# stop-agent.ps1
# Stops the Agent Watchdog and running agent processes
# ============================================================

$ProjectDir = (Resolve-Path "$PSScriptRoot\..").Path
$PidFile = Join-Path $ProjectDir "data\agent.pid"

Write-Host "Stopping Minecraft Agent..." -ForegroundColor Cyan

if (Test-Path $PidFile) {
    $AgentPid = Get-Content $PidFile
    if ($AgentPid) {
        Stop-Process -Id ([int]$AgentPid) -Force -ErrorAction SilentlyContinue
        Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
    }
}

Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -match "watchdog.js" -or $_.CommandLine -match "index.js"
} | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Host "[SUCCESS] Agent processes stopped." -ForegroundColor Green
