# mcp-media-9router Windows uninstaller
# Usage: powershell -ExecutionPolicy Bypass -File uninstall.ps1 [-KeepConfig] [-Yes]
param([switch]$KeepConfig, [switch]$Yes)
$ErrorActionPreference = "Stop"

$InstallDir = Join-Path $env:LOCALAPPDATA "mcp-media-9router"
$ConfigDir = Join-Path $env:APPDATA "mcp-media-9router"
$OpenCodeConfig = Join-Path $env:APPDATA "opencode\opencode.json"

if (-not $Yes) {
  $answer = Read-Host "Remove mcp-media-9router and saved setup? [y/N]"
  if ($answer -notin @("y", "Y", "yes", "YES")) { exit 0 }
}

if (Test-Path $OpenCodeConfig) {
  $config = Get-Content $OpenCodeConfig -Raw | ConvertFrom-Json
  if ($config.mcp -and $config.mcp.PSObject.Properties["media-9router"]) {
    $config.mcp.PSObject.Properties.Remove("media-9router")
    $config | ConvertTo-Json -Depth 20 | Set-Content $OpenCodeConfig
  }
}

Remove-Item -Force -Recurse $InstallDir -ErrorAction SilentlyContinue
if (-not $KeepConfig) { Remove-Item -Force -Recurse $ConfigDir -ErrorAction SilentlyContinue }
Write-Host "Uninstall complete. Restart OpenCode if it is running." -ForegroundColor Green
