param(
  [switch]$Down,
  [switch]$NoBuild
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repo = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $repo

$composeFile = ".\docker-compose.full.yml"
$envExample = ".\.env.docker.full.example"
$envFile = ".\.env.docker.full"

if (!(Test-Path $composeFile)) { throw "Arquivo docker-compose.full.yml não encontrado." }
if (!(Test-Path $envExample)) { throw "Arquivo .env.docker.full.example não encontrado." }

if (!(Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker não encontrado. Instale/abra o Docker Desktop e tente novamente."
}

if (!(Test-Path $envFile)) {
  Copy-Item $envExample $envFile -Force
  Write-Host "Arquivo .env.docker.full criado a partir do exemplo." -ForegroundColor Yellow
}

if ($Down) {
  Write-Host "Encerrando stack completa..." -ForegroundColor Yellow
  docker compose -f $composeFile --env-file $envFile down
  if ($LASTEXITCODE -ne 0) { throw "Falha ao encerrar a stack Docker completa." }
  Write-Host "Stack encerrada." -ForegroundColor Green
  exit 0
}

$args = @("compose", "-f", $composeFile, "--env-file", $envFile, "up", "-d")
if (-not $NoBuild) { $args += "--build" }

Write-Host "Subindo stack completa (local + cloud)..." -ForegroundColor Cyan
docker @args
if ($LASTEXITCODE -ne 0) { throw "Falha ao subir a stack Docker completa. Verifique portas e logs." }

Write-Host ""
Write-Host "Stack ativa. URLs para teste:" -ForegroundColor Green
Write-Host "Portal local (bot):   http://localhost:8501" -ForegroundColor White
Write-Host "API local (bot):      http://localhost:8502/docs" -ForegroundColor White
Write-Host "Cloud Admin:          http://localhost:8801" -ForegroundColor White
Write-Host "Cloud API:            http://localhost:8802/health" -ForegroundColor White
Write-Host "LAN mobile (opcional): ajuste HSP_BIND_ADDR=0.0.0.0 no .env.docker.full e rode novamente." -ForegroundColor White
Write-Host ""
Write-Host "Status:" -ForegroundColor Cyan
docker compose -f $composeFile --env-file $envFile ps
if ($LASTEXITCODE -ne 0) { throw "Falha ao consultar status da stack Docker completa." }
