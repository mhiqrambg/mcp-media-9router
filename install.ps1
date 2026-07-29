# mcp-media-9router Windows installer
# Usage: irm https://raw.githubusercontent.com/mhiqrambg/mcp-media-9router/main/install.ps1 | iex
$ErrorActionPreference = "Stop"

$InstallDir = Join-Path $env:LOCALAPPDATA "mcp-media-9router"
$BinDir = Join-Path $env:LOCALAPPDATA "bin"
$RepoUrl = "https://github.com/mhiqrambg/mcp-media-9router.git"

function Require-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "'$Name' is required but was not found."
  }
}

Write-Host "`nmcp-media-9router installer" -ForegroundColor Cyan
Write-Host "--------------------------------" -ForegroundColor Cyan
Write-Host "[1/4] Checking prerequisites"
Require-Command git
Require-Command node
Require-Command npm
if ([int](node -p "process.versions.node.split('.')[0]") -lt 22) {
  throw "Node.js 22 or later is required."
}

Write-Host "[2/4] Installing source to $InstallDir"
if (Test-Path (Join-Path $InstallDir ".git")) {
  $changes = git -C $InstallDir status --porcelain
  if ($changes) { Write-Warning "Local changes detected; repository was not updated." }
  else { git -C $InstallDir pull --ff-only origin main }
} elseif (Test-Path $InstallDir) {
  throw "$InstallDir exists but is not a Git repository. Remove or rename it first."
} else {
  git clone --branch main --depth 1 $RepoUrl $InstallDir
}

Write-Host "[3/4] Installing dependencies and building"
npm --prefix $InstallDir ci
npm --prefix $InstallDir run build

Write-Host "[4/4] Creating mm9 command"
New-Item -ItemType Directory -Force -Path $BinDir | Out-Null
$NodePath = (Get-Command node).Source
$Launcher = "@echo off`r`n`"$NodePath`" `"$InstallDir\dist\cli.js`" %*`r`n"
Set-Content -Path (Join-Path $BinDir "mm9.cmd") -Value $Launcher -NoNewline
$LegacyLauncher = Join-Path $InstallDir "bin\mm9.cmd"
Remove-Item -Force $LegacyLauncher -ErrorAction SilentlyContinue
$UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($UserPath -notlike "*$BinDir*") {
  [Environment]::SetEnvironmentVariable("Path", "$UserPath;$BinDir", "User")
  Write-Host "Added $BinDir to the user PATH. Open a new terminal before using mm9." -ForegroundColor Yellow
}

Write-Host "`nInstallation complete." -ForegroundColor Green
Write-Host "Run: mm9 setup --opencode"
