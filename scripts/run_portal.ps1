Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Compat: mantido para quem ja usava run_portal.ps1.
# Agora o portal principal e o painel React (8501) + API (8502).

$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

& powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\run_local.ps1

