# ============================================================
# restart-agent.ps1
# Restarts the Minecraft Agent
# ============================================================

& "$PSScriptRoot\stop-agent.ps1"
Start-Sleep -Seconds 2
& "$PSScriptRoot\start-agent.ps1"
