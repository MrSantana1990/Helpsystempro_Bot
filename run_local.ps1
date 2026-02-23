param(
  [int]$Seed = 42,
  [switch]$Mock
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repo = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $repo

$args = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ".\\scripts\\run_local.ps1", "-Seed", "$Seed")
if ($Mock) { $args += "-Mock" }
& powershell @args
