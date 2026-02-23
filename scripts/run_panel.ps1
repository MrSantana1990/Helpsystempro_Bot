Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

if (!(Test-Path ".\\.venv\\Scripts\\python.exe")) {
  throw "Venv nao encontrada em .venv. Rode .\\run_local.ps1 primeiro (ele cria a venv e instala dependencias)."
}

$env:PYTHONPATH = (Join-Path $repo "BinanceBot")
$env:STREAMLIT_BROWSER_GATHER_USAGE_STATS = "false"
& .\\.venv\\Scripts\\python.exe -m streamlit run .\\BinanceBot\\dashboard.py --server.headless true --server.port 8503 --browser.gatherUsageStats false

