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

## Arquivos desta pasta
- `deploy/vps/docker-compose.yml`: app + caddy (HTTPS + basic auth)
- `deploy/vps/Caddyfile`: reverse proxy + TLS automático (Let's Encrypt)
- `deploy/vps/.env.example`: variáveis do cliente

