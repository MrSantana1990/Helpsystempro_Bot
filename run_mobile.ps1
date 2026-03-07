param(
  [string]$Dir = "mobile"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repo = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $repo

if (!(Test-Path $Dir)) { throw "Pasta '$Dir' não encontrada. Rode este script no root do repo." }

Push-Location $Dir
try {
  if (!(Test-Path ".\\node_modules")) {
    Write-Host "Instalando dependências do app mobile (npm)..." -ForegroundColor Cyan
    cmd /c "npm install"
  }
  Write-Host "Rodando Expo (mobile)..." -ForegroundColor Green
  Write-Host "Dica: use o QR Code no Expo Go." -ForegroundColor DarkGray
  cmd /c "npm run start"
} finally {
  Pop-Location
}

