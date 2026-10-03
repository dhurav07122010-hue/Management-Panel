# ============================================================
# install-agent-service.ps1
# Production Windows Service / Startup Installer for Minecraft Agent
# ============================================================

$ErrorActionPreference = "Stop"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "   MINECRAFT MANAGEMENT AGENT - WINDOWS STARTUP INSTALLER" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

$ProjectDir = (Resolve-Path "$PSScriptRoot\..").Path
$NodePath = (Get-Command node.exe -ErrorAction SilentlyContinue).Source

if (-not $NodePath) {
    Write-Host "[ERROR] Node.js is not found in PATH!" -ForegroundColor Red
    Write-Host "Please install Node.js (https://nodejs.org) on this system." -ForegroundColor Red
    exit 1
}

Write-Host "Project Directory : $ProjectDir" -ForegroundColor Gray
Write-Host "Node.js Executable: $NodePath" -ForegroundColor Gray

# Ensure data directory exists
$DataDir = Join-Path $ProjectDir "data"
if (-not (Test-Path $DataDir)) {
    New-Item -ItemType Directory -Path $DataDir -Force | Out-Null
}

$WatchdogScript = Join-Path $ProjectDir "apps\agent\dist\client\watchdog.js"
$RunnerBat = Join-Path $ProjectDir "scripts\run-watchdog-silent.bat"

# Create clean runner batch file
$BatContent = @"
@echo off
cd /d "$ProjectDir"
"$NodePath" "$WatchdogScript" >> "$DataDir\watchdog.log" 2>&1
"@
Set-Content -Path $RunnerBat -Value $BatContent -Encoding ASCII

Write-Host "Created launcher script: $RunnerBat" -ForegroundColor Gray

# 1. Register Windows Scheduled Task (if Administrator)
$TaskName = "MinecraftServerAgent"
Write-Host "Registering Windows Scheduled Task '$TaskName'..." -ForegroundColor Cyan

$TaskRegistered = $false
try {
    $TaskAction = "schtasks /Create /TN `"$TaskName`" /TR `"`"$RunnerBat`"`" /SC ONLOGON /RL HIGHEST /F"
    $taskResult = Invoke-Expression $TaskAction 2>&1
    if ($LASTEXITCODE -eq 0) {
        $TaskRegistered = $true
        Write-Host " [SUCCESS] Windows Task '$TaskName' registered in Task Scheduler." -ForegroundColor Green
    }
} catch {}

# 2. Register in Windows User Startup Folder (Always works without Admin rights)
$StartupFolder = [System.IO.Path]::Combine($env:APPDATA, "Microsoft\Windows\Start Menu\Programs\Startup")
$StartupVbs = Join-Path $StartupFolder "MinecraftServerAgent.vbs"

if (Test-Path $StartupFolder) {
    $VbsContent = @"
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "$ProjectDir"
WshShell.Run """$RunnerBat""", 0, False
"@
    Set-Content -Path $StartupVbs -Value $VbsContent -Encoding ASCII
    Write-Host " [SUCCESS] Windows Startup entry created: $StartupVbs" -ForegroundColor Green
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host " [READY] Minecraft Agent Auto-Start is fully configured!" -ForegroundColor Green
Write-Host " The Agent and Watchdog will start automatically on Windows boot." -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green

