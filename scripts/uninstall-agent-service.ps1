# ============================================================
# uninstall-agent-service.ps1
# Remove Minecraft Agent from Windows Task Scheduler
# ============================================================

$TaskName = "MinecraftServerAgent"
Write-Host "Removing Minecraft Agent from autostart..." -ForegroundColor Cyan

# 1. Remove scheduled task if present
try {
    schtasks /Delete /TN "$TaskName" /F 2>&1 | Out-Null
    Write-Host "[SUCCESS] Task '$TaskName' removed from Task Scheduler (if present)." -ForegroundColor Green
} catch {}

# 2. Remove Startup folder entry if present
$StartupVbs = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Startup\MinecraftServerAgent.vbs"
if (Test-Path $StartupVbs) {
    Remove-Item $StartupVbs -Force -ErrorAction SilentlyContinue
    Write-Host "[SUCCESS] Removed Startup folder entry ($StartupVbs)." -ForegroundColor Green
}

Write-Host "[SUCCESS] Minecraft Agent autostart uninstalled." -ForegroundColor Green

