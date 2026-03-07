param(
  [int]$Seed = 42,
  [switch]$Mock,
  [switch]$Lan
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repo = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $repo

# Default: para testar mobile, LAN costuma ser o objetivo.
if (-not $Lan) { $Lan = $true }

$cmdApi = @(
  "-NoProfile",
  "-ExecutionPolicy",
  "Bypass",
  "-File",
  (Join-Path $repo "run_local.ps1")
)
if ($Lan) { $cmdApi += "-Lan" }
if ($Mock) { $cmdApi += "-Mock" }
$cmdApi += @("-Seed", "$Seed")

$cmdMobile = @(
  "-NoProfile",
  "-ExecutionPolicy",
  "Bypass",
  "-File",
  (Join-Path $repo "run_mobile.ps1")
)

Write-Host "Abrindo 2 terminais:" -ForegroundColor Cyan
Write-Host "1) API + Painel (Local-first)" -ForegroundColor Cyan
Write-Host "2) Mobile (Expo)" -ForegroundColor Cyan

Start-Process -FilePath "powershell.exe" -ArgumentList $cmdApi -WorkingDirectory $repo | Out-Null
Start-Sleep -Milliseconds 500
Start-Process -FilePath "powershell.exe" -ArgumentList $cmdMobile -WorkingDirectory $repo | Out-Null

Write-Host "OK. Se o Windows bloquear scripts, execute: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned" -ForegroundColor DarkGray

