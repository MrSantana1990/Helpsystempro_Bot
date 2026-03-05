param(
  [int]$Seed = 42,
  [switch]$Mock,
  [switch]$Lan
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repo = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $repo

$args = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ".\\scripts\\run_local.ps1", "-Seed", "$Seed")
if ($Mock) { $args += "-Mock" }
if ($Lan) { $args += "-Lan" }
& powershell @args
