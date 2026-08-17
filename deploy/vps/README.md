<div align="center">

# 🛰️ Deploy VPS · HelpSystem Pro Bot

### Execução 24/7 com isolamento, HTTPS e operação segura.

[![Docker](https://img.shields.io/badge/runtime-Docker-2496ed?style=for-the-badge&logo=docker&logoColor=white)](#-implantação)
[![Padrão](https://img.shields.io/badge/LIVE-desligado-ef4444?style=for-the-badge)](#-regras-de-segurança)
[![Tunnel](https://img.shields.io/badge/acesso-Cloudflare_Tunnel-f38020?style=for-the-badge&logo=cloudflare&logoColor=white)](#-modelos)

</div>

---

## ✦ Objetivo

Executar o portal e o motor em uma VPS sem depender do computador do operador. O piloto deve permanecer em dry-run/testnet.

> Não existe garantia de lucro. Proteja as credenciais e valide extensivamente antes de considerar LIVE.

## 🧱 Requisitos

- Ubuntu 22.04 ou superior;
- mínimo recomendado de 2 vCPU e 4 GB RAM;
- Docker Engine e Docker Compose;
- domínio gerenciado com HTTPS;
- backup externo e monitoramento.

## 🛣️ Modelos

| Arquivo | Uso |
|---|---|
| docker-compose.tunnel.yml | Recomendado: porta apenas em localhost + Cloudflare Tunnel |
| docker-compose.yml | Caddy com HTTPS direto, quando realmente necessário |
| .env.example | Lista de variáveis, nunca credenciais reais |

## 🚀 Implantação

Siga o [guia completo](GUIA_PASSO_A_PASSO.md). Para o modelo protegido por túnel:

    docker compose --env-file .env -f docker-compose.tunnel.yml up -d --build
    docker compose --env-file .env -f docker-compose.tunnel.yml ps

## 🛡️ Regras de segurança

- HSP_LIVE_TRADING=0;
- HSP_AUTOSTART_BOT=0 durante validação;
- HSP_AUTOSTART_DRY_RUN=0 no primeiro início;
- API Key sem saque;
- allowlist do IP da VPS na Binance;
- HSP_PORTAL_TOKEN longo e exclusivo;
- arquivo .env com permissão 600;
- nenhuma porta pública no modelo Tunnel;
- Cloudflare Access antes de criar o hostname público.

## ✅ Verificação

    curl http://127.0.0.1:8501/api/health
    docker compose logs --tail=100
    ss -ltnp

O binding seguro deve aparecer como 127.0.0.1, nunca 0.0.0.0.
