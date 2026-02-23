# Manual Geral — HelpSystem • Binance Bot

Este projeto entrega um **bot de trading** + um **portal moderno (React)** para visualizar decisões, trades, notícias e configurar tudo de forma guiada.

> Aviso importante: **não existe garantia de lucro**. Use **testnet** e **dry-run** para validar antes de operar em conta real.

---

## 1) Rodar localmente (Windows / PowerShell)

Comando único:

```powershell
cd D:\DEV\Helpsystempro_Bot; powershell -NoProfile -ExecutionPolicy Bypass -File .\run_local.ps1
```

Abre:
- Portal: `http://localhost:8501`
- API: `http://localhost:8502/docs`

Gerar dados fictícios para ver o painel preenchido:

```powershell
.\run_local.ps1 -Mock -Seed 42
```

Smoke test da API:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\smoke_test.ps1
```

---

## 2) Configuração (passo a passo)

Abra o portal e vá em **Configurações**.

### Passo 1 — `key.env` (chaves)
Arquivo: `BinanceBot/Configs/key.env`

Campos:
- `API_KEY` / `API_SECRET` (Binance) — necessário para **trades reais/testnet**
- `NEWS_API_KEY` — habilita módulo de notícias
- `TELEGRAM_API_KEY` / `TELEGRAM_CHAT_ID` — **opcional** (alertas)

Modelo: `BinanceBot/Configs/key.env.example`

### Passo 2 — `settings.yml` (estratégia e limites)
Arquivo: `BinanceBot/Configs/settings.yml`

No portal, você tem:
- **Modo simples** (recomendado)
- Editor avançado (JSON → YAML)

Itens principais:
- `moedas_monitoradas`: lista de moedas **autorizadas** para operar sem pedir OK
- `stop_loss_percentual` / `take_profit_percentual`
- `max_open_positions` / `max_moedas_por_ciclo`
- `buy_threshold` / `avoid_threshold`
- `discovery_*` (busca de novas moedas)

---

## 3) Modos de execução (segurança)

### Dry-run (simular / análise)
- Não envia ordens.
- Pode rodar **mesmo sem API_KEY/API_SECRET** (modo análise com endpoints públicos).

### Testnet
- Ideal para validação com Binance.
- Mantenha `testnet: true` no `settings.yml`.

### Conta real (alto risco)
- Para operar com `testnet: false`, é obrigatório definir `HSP_LIVE_TRADING=1`.
- Recomenda-se: travas extras + validações + limites conservadores.

---

## 4) Aprovações de novas moedas (Discovery)

Regra do sistema:
- Moedas em `moedas_monitoradas` → **auto** (pode operar sem pedir)
- Moedas “descobertas” → **precisam do seu OK**

No portal:
1) Vá em **Bot (Play) → Aprovações (novas moedas)**
2) Escolha o prazo: **24h / 7 dias / sempre**
3) Clique **Aprovar** ou **Rejeitar**

Persistência:
- `data/symbol_registry.json` (ignorado pelo Git)

Controles (no `settings.yml`):
- `discovery_enabled`
- `discovery_limit`
- `discovery_min_quote_volume`
- `discovery_min_score`
- `discovery_max_new_per_day`
- `discovery_cooldown_hours`
- `discovery_exclude_bases`

---

## 5) Carteira e saldo em R$

No **Painel de Controle**:
- Se tiver `API_KEY/API_SECRET`, o portal mostra sua **carteira real** (estimativa em USDT e R$) e o **USDT livre**.
- Se não tiver, use **Carteira manual** (salva em `data/portfolio.json`) ou informe saldo manual.

---

## 6) Estrutura do projeto (alto nível)

- `BinanceBot/portal_api.py`: FastAPI (API + serve `portal/`)
- `BinanceBot/Binance_Bot.py`: ciclo do bot
- `BinanceBot/Modulos/*`: indicadores, engine de decisão, storage (SQLite), risk, etc.
- `web/`: React/Vite (fonte do portal)
- `portal/`: build do portal (saída do Vite)
- `data/`: runtime (sqlite, registry, estados) — **não versionar**

---

## 7) Boas práticas e prevenção de problemas

- **Nunca commitar** `key.env` (segredos).
- Comece com **dry-run** e **testnet**.
- Use limites conservadores em `settings.yml`.
- Se as portas estiverem ocupadas (`8501/8502`), rode `.\run_local.ps1` de novo (ele tenta encerrar processos que travam as portas).

