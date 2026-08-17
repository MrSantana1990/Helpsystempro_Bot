<div align="center">

# 🧱 Deploy VPS Multi

### Uma VPS, múltiplos clientes e um contêiner isolado por operação.

[![Modelo](https://img.shields.io/badge/modelo-multi--tenant-8b5cf6?style=for-the-badge)](#-arquitetura)
[![Proxy](https://img.shields.io/badge/proxy-Traefik-24a1c1?style=for-the-badge&logo=traefikproxy&logoColor=white)](#-arquitetura)
[![Risco](https://img.shields.io/badge/status-evolução-f59e0b?style=for-the-badge)](#-quando-usar)

</div>

---

## ✦ Quando usar

Modelo para uma fase posterior, quando houver maturidade operacional para administrar vários clientes na mesma VPS. Para pilotos, prefira uma instância isolada.

## 🏗️ Arquitetura

    Internet
       │
    Traefik
       ├── cliente-a → contêiner + volumes próprios
       ├── cliente-b → contêiner + volumes próprios
       └── cliente-c → contêiner + volumes próprios

Cada tenant possui dados, logs, configurações, token e domínio independentes.

## 🚀 Base

    cd /opt/Helpsystempro_Bot
    docker compose -f deploy/vps_multi/base/docker-compose.yml up -d

## 👤 Novo tenant

    bash deploy/vps_multi/bin/add-tenant.sh cliente1 cliente1.seudominio.com

Revise deploy/vps_multi/tenants/cliente1/.env e então:

    bash deploy/vps_multi/bin/up-tenant.sh cliente1

Para subir todos:

    bash deploy/vps_multi/bin/up-all.sh

## 🔐 Credenciais

Gere autenticação básica com:

    bash deploy/vps_multi/bin/gen-basicauth.sh admin "SENHA_FORTE"

## 🛡️ Checklist mínimo

- chave Binance sem saque e com IP autorizado;
- token exclusivo por tenant;
- ENABLE_AUTH=1;
- LIVE desligado no piloto;
- volumes e redes separados;
- HTTPS, backups e logs;
- limites de CPU/memória;
- teste de restauração;
- contrato e validação jurídica.

> Multi-tenant aumenta o impacto de falhas. Só avance após monitoramento, backup e resposta a incidentes estarem testados.
