Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repo = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $repo

& powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\run_bot.ps1

