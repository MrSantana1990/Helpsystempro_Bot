# Deploy VPS (24/7) — HelpSystem Pro • Binance Bot

Objetivo: rodar **24/7** em uma **VPS dedicada por cliente**, com acesso via web (HTTPS), sem depender do PC do cliente.

> Aviso: não é recomendação financeira e não há garantia de lucro. Use testnet/dry-run primeiro.

## Por que VPS dedicada (e não SaaS multi-tenant agora)
- Isolamento por cliente (menor risco de vazamento/impacto cruzado)
- Menos complexidade operacional
- Você evita “virar provedor financeiro” multi-tenant no início
- Dá para vender rápido e evoluir depois

## Pré-requisitos
- VPS Ubuntu 22.04+ (recomendado 2 vCPU / 4GB RAM)
- Domínio apontando para a VPS (ex: `bot.cliente.com`)
- Docker + Docker Compose instalados

## Rodar local rápido (antes da VPS)
No Windows (PowerShell), no root do repo:
```powershell
cd D:\DEV\Helpsystempro_Bot; .\run_local.ps1
```
Isso sobe:
- Painel: `http://localhost:8501`
- API: `http://localhost:8502/api/health`

## Guia completo (VPS)
Passo a passo completo para colocar no ar:
- `deploy/vps/GUIA_PASSO_A_PASSO.md`

## Passo a passo (resumo)
1) Clone o repo na VPS
2) Configure variáveis em `.env`
3) Suba com `docker compose up -d`
4) Acesse `https://SEU_DOMINIO`

## Observações de segurança (mínimo aceitável)
- Na Binance, crie API Key **sem withdraw**.
- (Opcional recomendado) Ative **IP whitelist** apontando para o IP da VPS.
- Use uma senha forte para o painel (Caddy basic auth).
- Mantenha `HSP_LIVE_TRADING=0` no piloto. Live só com trava + termo + licença.
- Para 24/7, use `HSP_AUTOSTART_BOT=1` (recomendado) e mantenha `HSP_AUTOSTART_DRY_RUN=1` por segurança.

## Arquivos desta pasta
- `deploy/vps/docker-compose.yml`: app + caddy (HTTPS + basic auth)
- `deploy/vps/Caddyfile`: reverse proxy + TLS automático (Let's Encrypt)
- `deploy/vps/.env.example`: variáveis do cliente

## Plataforma Cloud (opcional / próxima fase)
Se você estiver usando a plataforma **Cloud** (multiusuário + 2FA), o stack fica em `cloud/compose/` e o painel admin em `cloud/admin/`.
