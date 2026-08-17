<div align="center">

# ⚡ HelpSystem Pro · Binance Automation

### Operação assistida, risco visível e decisões explicáveis.

[![CI](https://img.shields.io/github/actions/workflow/status/MrSantana1990/Helpsystempro_Bot/ci.yml?style=for-the-badge&label=CI)](https://github.com/MrSantana1990/Helpsystempro_Bot/actions)
[![Python](https://img.shields.io/badge/Python-3.12-3776ab?style=for-the-badge&logo=python&logoColor=white)](#-arquitetura)
[![React](https://img.shields.io/badge/React-painel-61dafb?style=for-the-badge&logo=react&logoColor=black)](#-arquitetura)
[![Modo](https://img.shields.io/badge/padrão-dry--run-f59e0b?style=for-the-badge)](#-segurança-operacional)

[Apresentação](https://bot.helpsystempro.site) · [Manual](docs/MANUAL.md) · [Cloud](cloud/README.md) · [Mobile](mobile/README.md) · [VPS](deploy/vps/README.md)

</div>

---

## ✦ Visão

Plataforma para monitorar e automatizar estratégias com um portal React, API FastAPI e motor Python. O projeto prioriza controles de risco, rastreabilidade e operação simulada antes de qualquer uso real.

> **Aviso:** não existe garantia de lucro. Este software não é recomendação financeira. Comece sempre em dry-run/testnet.

## ✨ Capacidades

| Pilar | Recursos |
|---|---|
| Decisão | Indicadores técnicos, sentimento e eventos |
| Risco | Limites diários, validações e kill switch |
| Operação | Dry-run, testnet e LIVE com múltiplas travas |
| Auditoria | Histórico SQLite, logs e exportação CSV |
| Plataforma | Licenças, planos, usuários e suporte |
| Experiência | Portal web e aplicativo Android/iOS |

## 🏗️ Arquitetura

    Portal React ───────┐
                       ├── FastAPI ── Motor Python ── Binance
    Aplicativo Mobile ─┘       │
                               ├── SQLite / auditoria
                               └── Cloud API / licenças

| Componente | Tecnologia | Porta local |
|---|---|---:|
| Portal operacional | React + Vite | 8501 |
| API do bot | Python + FastAPI | 8502 |
| Cloud Admin | React + Vite | 8801 |
| Cloud API | Node.js + TypeScript | 8802 |

## 🚀 Início rápido

### Windows

    cd D:\DEV\Helpsystempro_Bot
    powershell -NoProfile -ExecutionPolicy Bypass -File .\run_local.ps1

Com dados demonstrativos:

    .\run_local.ps1 -Mock -Seed 42

### Docker completo

    .\run_docker_full.ps1

## 📱 Teste no celular

Terminal 1:

    .\run_local.ps1 -Lan

Terminal 2:

    .\run_mobile.ps1

Use o token temporário exibido pelo iniciador. Não exponha a porta LAN fora de uma rede confiável.

## 🛡️ Segurança operacional

- LIVE desligado por padrão;
- testnet/dry-run como ponto de partida;
- duas liberações explícitas antes de operação real;
- API Key Binance sem permissão de saque;
- allowlist do IP da VPS recomendada;
- token do portal obrigatório;
- kill switch e limites diários;
- segredos fora do Git;
- painel público somente atrás de Cloudflare Access.

## 📚 Documentação

| Guia | Objetivo |
|---|---|
| [Manual](docs/MANUAL.md) | Operação diária |
| [Manual comercial](docs/MANUAL_COMERCIAL.md) | Apresentação do produto |
| [Cloud Admin](docs/CLOUD_ADMIN.md) | Administração central |
| [Docker Full](docs/DOCKER_FULL_PLAY.md) | Ambiente completo |
| [Relatório geral](docs/RELATORIO_GERAL_SISTEMA.md) | Estado técnico |
| [VPS](deploy/vps/GUIA_PASSO_A_PASSO.md) | Implantação 24/7 |

## ⚖️ Responsabilidade

Criptoativos envolvem risco elevado. O operador é responsável por testar estratégias, definir limites e proteger credenciais. O projeto não promete rentabilidade nem substitui orientação financeira, tributária ou jurídica.

---

<div align="center">

**HelpSystem Pro** · Automação com controle antes da velocidade.

</div>
