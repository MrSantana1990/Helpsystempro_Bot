# HelpSystem • Binance Bot

Portal operacional (React) + API (FastAPI) + bot (Python), com:
- Decisões explicáveis (técnico + sentimento + eventos)
- Risk controls e kill switch
- Licença e compliance
- Histórico/auditoria em SQLite + export CSV
- Central de suporte no web e no app (setor + prioridade + chamado)

> Aviso: não existe garantia de lucro. Use dry-run/testnet antes de LIVE.

## Rodar local (Windows / PowerShell)

```powershell
cd D:\DEV\Helpsystempro_Bot
powershell -NoProfile -ExecutionPolicy Bypass -File .\run_local.ps1
```

- Portal: `http://localhost:8501`
- API: `http://localhost:8502/docs`

### Modo LAN (celular)

```powershell
cd D:\DEV\Helpsystempro_Bot
powershell -NoProfile -ExecutionPolicy Bypass -File .\run_local.ps1 -Lan
```

- API em LAN (`0.0.0.0`) + token aleatório.
- No celular: `http://IP_DO_PC:8502` + token LAN.

### Dados mock

```powershell
.\run_local.ps1 -Mock -Seed 42
```

## Web + mobile (2 terminais)

Terminal 1:
```powershell
cd D:\DEV\Helpsystempro_Bot
.\run_local.ps1 -Lan
```

Terminal 2:
```powershell
cd D:\DEV\Helpsystempro_Bot
.\run_mobile.ps1
```

## Docker full (1 play)

```powershell
cd D:\DEV\Helpsystempro_Bot
.\run_docker_full.ps1
```

URLs:
- Operacional: `http://localhost:8501`
- Bot API: `http://localhost:8502/docs`
- Cloud Admin: `http://localhost:8801`
- Cloud API: `http://localhost:8802/health`

## Suporte na plataforma

- Web (`8501`): menu `Sistema > Suporte`
- Mobile: aba `Suporte`
- API de suporte:
  - `GET /api/support/sectors`
  - `POST /api/support/tickets`
  - `GET /api/support/tickets`

## Documentação

- `docs/MANUAL.md`
- `docs/MANUAL_COMERCIAL.md`
- `docs/CLOUD_ADMIN.md`
- `docs/DOCKER_FULL_PLAY.md`
- `docs/RELATORIO_GERAL_SISTEMA.md`
- `deploy/vps/GUIA_PASSO_A_PASSO.md`

## App mobile

Código em `mobile/` (Expo SDK 54). Guia completo em `mobile/README.md`.
