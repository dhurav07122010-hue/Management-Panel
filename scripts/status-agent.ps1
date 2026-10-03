# ============================================================
# status-agent.ps1
# Queries Agent Identity & Doctor Diagnostics
# ============================================================

$ProjectDir = (Resolve-Path "$PSScriptRoot\..").Path
$CliScript = Join-Path $ProjectDir "apps\agent\dist\index.js"

& node.exe "$CliScript" status
Write-Host ""
& node.exe "$CliScript" doctor
