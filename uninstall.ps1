# mcp-media-9router Windows uninstaller
# Usage: powershell -ExecutionPolicy Bypass -File uninstall.ps1 [-KeepConfig] [-Yes]
param([switch]$KeepConfig, [switch]$Yes)
$ErrorActionPreference = "Stop"

$InstallDir = Join-Path $env:LOCALAPPDATA "mcp-media-9router"
$BinPath = Join-Path $env:LOCALAPPDATA "bin\mm9.cmd"
$ConfigDir = Join-Path $env:APPDATA "mcp-media-9router"
$OpenCodeConfig = Join-Path $env:USERPROFILE ".config\opencode\opencode.jsonc"

if (-not $Yes -and -not $KeepConfig) {
  Write-Host ""
  Write-Host "Choose what to remove:"
  Write-Host "  1. Application only - keep provider configuration and API key"
  Write-Host "  2. Everything - remove application, configuration, and API key"
  Write-Host "  3. Cancel"
  $choice = Read-Host "Select [3]"
  switch ($choice) {
    "1" { $KeepConfig = $true }
    "2" { }
    default { Write-Host "Uninstall cancelled."; exit 0 }
  }
} elseif (-not $Yes) {
  $scope = if ($KeepConfig) { "the application only and keep saved setup" } else { "the application and all saved setup" }
  $answer = Read-Host "Remove $scope? [y/N]"
  if ($answer -notin @("y", "Y", "yes", "YES")) { exit 0 }
}

if (Test-Path $OpenCodeConfig) {
  $content = Get-Content $OpenCodeConfig -Raw
  $content = $content -replace ',\s*([}\]])', '$1'
  $config = $content | ConvertFrom-Json
  if ($config.mcp -and $config.mcp.PSObject.Properties["media-9router"]) {
    $config.mcp.PSObject.Properties.Remove("media-9router")
    $config | ConvertTo-Json -Depth 20 | Set-Content $OpenCodeConfig
  }
}

Remove-Item -Force -Recurse $InstallDir -ErrorAction SilentlyContinue
Remove-Item -Force $BinPath -ErrorAction SilentlyContinue
if (-not $KeepConfig) { Remove-Item -Force -Recurse $ConfigDir -ErrorAction SilentlyContinue }
if ($KeepConfig) {
  Write-Host "Uninstall complete. Saved configuration and API key were kept." -ForegroundColor Green
} else {
  Write-Host "Uninstall complete. Application, configuration, and API key were removed." -ForegroundColor Green
}
Write-Host "Restart OpenCode if it is running."
