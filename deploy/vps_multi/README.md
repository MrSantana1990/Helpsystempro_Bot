# Deploy VPS Multi (1 VPS, múltiplos clientes) — HelpSystem Pro • Binance Bot

Objetivo: rodar **24/7** em **uma VPS maior** com **isolamento por cliente (1 container por cliente)**, acessível via web.

> Aviso: não é recomendação financeira e não há garantia de lucro. Use testnet/dry-run primeiro.

## Por que esse modelo agora
- Custo menor que 1 VPS por cliente no início
- Mantém isolamento prático (container + volumes por cliente)
- Evita Kubernetes cedo (complexidade)

## Como funciona
- `traefik` faz HTTPS e roteia por domínio/subdomínio
- Cada cliente roda um container `helpsystempro-bot` com:
  - `data/` (sqlite, auditoria, licença, runtime)
  - `logs/`
  - `BinanceBot/Configs/` (settings.yml e key.env)

## Pré-requisitos (VPS)
- Ubuntu 22.04+
- Docker + Docker Compose
- DNS apontando para a VPS:
  - `cliente1.seudominio.com`
  - `cliente2.seudominio.com`

## Setup (base)
1) Clone o repo na VPS
2) Suba o proxy:
```bash
cd /opt/Helpsystempro_Bot
docker compose -f deploy/vps_multi/base/docker-compose.yml up -d
```

## Criar um cliente (tenant)
1) Crie a pasta do cliente:
```bash
bash deploy/vps_multi/bin/add-tenant.sh cliente1 cliente1.seudominio.com
```

2) Edite o arquivo:
- `deploy/vps_multi/tenants/cliente1/.env`

3) Suba o tenant:
```bash
bash deploy/vps_multi/bin/up-tenant.sh cliente1
```

### Gerar basic auth (recomendado)
Na VPS (Ubuntu), instale `htpasswd`:
```bash
sudo apt-get update && sudo apt-get install -y apache2-utils
```
Gere o hash já com escape de `$` (vira `$$`) e cole em `TENANT_BASIC_AUTH`:
```bash
bash deploy/vps_multi/bin/gen-basicauth.sh admin "SENHA_FORTE"
```

## Acesso
- Portal do cliente: `https://cliente1.seudominio.com`
- (Opcional) Dashboard do Traefik: `https://traefik.seudominio.com` (habilitar se quiser)

## Segurança mínima (recomendado)
- Binance API key **sem withdraw**
- IP whitelist da Binance apontando para IP da VPS (se o cliente aceitar)
- Senha forte no basic auth (proxy)
- `HSP_PORTAL_TOKEN` longo e secreto (cada cliente diferente)
- `ENABLE_AUTH=1` (obriga token nos endpoints `/api/*` de escrita/start/stop)
- `HSP_LOCAL_ONLY=0` (obrigatório em cloud, senão bloqueia o IP do proxy)
- LIVE só com:
  - termo aceito
  - licença válida
  - `HSP_LIVE_TRADING=1`
