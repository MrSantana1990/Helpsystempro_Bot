param(
  [int]$Seed = 42,
  [switch]$Mock
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

function Get-PythonLauncher {
  if (Test-Path ".\\.venv\\Scripts\\python.exe") { return ".\\.venv\\Scripts\\python.exe" }
  if (Get-Command py -ErrorAction SilentlyContinue) { return "py" }
  if (Get-Command python -ErrorAction SilentlyContinue) { return "python" }
  if (Get-Command python.exe -ErrorAction SilentlyContinue) { return "python.exe" }
  throw "Python nao encontrado. Instale o Python 3.12+ ou configure o comando 'py'."
}

function Ensure-Venv {
  if (Test-Path ".\\.venv\\Scripts\\python.exe") { return }
  $launcher = Get-PythonLauncher
  if ($launcher -eq "py") {
    & py -m venv .venv
  } else {
    & $launcher -m venv .venv
  }
}

function Stop-Port($port) {
  $pattern = ":$port\s+.*(LISTENING|OUVINDO)"
  for ($attempt = 1; $attempt -le 6; $attempt++) {
    $pids = @()
    try {
      $pids += Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique
    } catch {}

    try {
      $lines = netstat -ano | Select-String -Pattern $pattern
      foreach ($m in $lines) {
        $parts = ($m.Line -split "\s+") | Where-Object { $_ -ne "" }
        if ($parts.Count -gt 0) { $pids += $parts[-1] }
      }
    } catch {}

    $pids = $pids | Where-Object { $_ -and ($_ -as [int]) -gt 0 } | Sort-Object -Unique
    if (-not $pids -or $pids.Count -eq 0) { break }

    foreach ($pid in $pids) {
      Write-Host "Porta $port em uso. Encerrando PID $pid... (tentativa $attempt/6)" -ForegroundColor Yellow
      cmd /c "taskkill /PID $pid /T /F >NUL 2>NUL"
    }

    Start-Sleep -Milliseconds 350
  }
}

function Assert-PortFree($port) {
  try {
    $still = netstat -ano | Select-String -Pattern (":$port\s+.*(LISTENING|OUVINDO)")
    if ($still) {
      Write-Host "Ainda existe um processo escutando na porta $port." -ForegroundColor Red
      $still | ForEach-Object { Write-Host $_.Line -ForegroundColor Red }
      throw "Porta $port ocupada."
    }
  } catch {
    if ($_.Exception -and $_.Exception.Message -like "Porta * ocupada.*") { throw }
  }
}

function Stop-OldPortalServer {
  # evita conflito quando alguém rodou: python BinanceBot\\portal_server.py --port 8502
  try {
    $procs = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -match "portal_server\\.py" }
    foreach ($p in ($procs | Where-Object { $_.ProcessId -gt 0 })) {
      Write-Host "Encerrando portal_server.py (PID $($p.ProcessId))..." -ForegroundColor Yellow
      Stop-Process -Id ([int]$p.ProcessId) -Force -ErrorAction SilentlyContinue
    }
  } catch {}
}

Ensure-Venv
$py = ".\\.venv\\Scripts\\python.exe"

$env:HSP_PORTAL_TOKEN = "local-dev"

Write-Host "Usando Python:" (& $py -V)
Write-Host "Instalando dependencias (venv)..." -ForegroundColor Cyan
& $py -m pip install --upgrade pip | Out-Null
& $py -m pip install -r .\\requirements.txt

Write-Host "Gerando dados ficticios (MOCK)..." -ForegroundColor Cyan
if ($Mock) {
  Write-Host "MOCK ligado: gerando dados ficticios..." -ForegroundColor Cyan
  & $py .\\BinanceBot\\Binance_Bot.py --mock --seed $Seed | Out-Host
} else {
  Write-Host "MOCK desligado: sem dados ficticios (use -Mock se quiser seed)." -ForegroundColor DarkGray
}

Write-Host "Subindo API (FastAPI) em http://localhost:8502" -ForegroundColor Green
Write-Host "Subindo PAINEL (React/Vite) em http://localhost:8501" -ForegroundColor Green
Write-Host "Token (config + start/stop): local-dev" -ForegroundColor Yellow

Stop-OldPortalServer
Stop-Port 8501
Stop-Port 8502
Start-Sleep -Milliseconds 200
Assert-PortFree 8501
Assert-PortFree 8502

$api = Start-Process -PassThru -FilePath $py -ArgumentList @(
  "-m","uvicorn","BinanceBot.portal_api:app",
  "--host","127.0.0.1","--port","8502"
)

try {
  # espera API subir
  $ok = $false
  for ($i = 0; $i -lt 25; $i++) {
    try {
      $r = Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:8502/api/health" -TimeoutSec 2
      if ($r.StatusCode -eq 200) { $ok = $true; break }
    } catch {}
    Start-Sleep -Milliseconds 200
  }
  if (!$ok) { throw "API nao respondeu em http://127.0.0.1:8502/api/health" }

  # garante que e o backend FastAPI (e nao o portal_server.py antigo)
  try {
    $fx = Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:8502/api/market/usdtbrl" -TimeoutSec 4
    $obj = $fx.Content | ConvertFrom-Json
    if ($null -eq $obj.price) { throw "Sem campo price" }
  } catch {
    throw "Backend errado na 8502 (parece portal_server.py antigo). Feche processos antigos e rode .\\run_local.ps1 novamente."
  }

  try { Start-Process "http://localhost:8501" | Out-Null } catch {}

  if (!(Test-Path ".\\web\\package.json")) { throw "Pasta web/ nao encontrada. Atualize o projeto." }
  Push-Location .\\web
  try {
    if (!(Test-Path ".\\node_modules")) {
      Write-Host "Instalando dependencias do painel (npm)..." -ForegroundColor Cyan
      cmd /c "npm install"
    }
    Write-Host "Rodando painel React (Vite)..." -ForegroundColor Cyan
    cmd /c "npm run dev -- --host 127.0.0.1 --port 8501"
  } finally {
    Pop-Location
  }
} finally {
  if ($api -and $api.Id) {
    Write-Host "Encerrando API (PID $($api.Id))..." -ForegroundColor Yellow
    Stop-Process -Id $api.Id -Force -ErrorAction SilentlyContinue
  }
}
