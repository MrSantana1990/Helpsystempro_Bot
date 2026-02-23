Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

if (!(Test-Path ".\\.venv\\Scripts\\python.exe")) {
  throw "Venv nao encontrada em .venv. Rode .\\run_local.ps1 primeiro (ele cria a venv e instala dependencias)."
}

& .\\.venv\\Scripts\\python.exe .\\BinanceBot\\Binance_Bot.py --dry-run

