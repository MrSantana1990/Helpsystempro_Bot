# Manual Geral — HelpSystem • Binance Bot

Este projeto entrega um **bot de trading** + um **portal moderno (React)** para visualizar decisões, trades, notícias e configurar tudo de forma guiada.

> Aviso importante: **não existe garantia de lucro**. Use **testnet** e **dry-run** para validar antes de operar em conta real.

Links:
- Portfólio / site: https://helpsystempro.netlify.app/
- WhatsApp (implantação): +55 11 94002-5492
- GitHub: https://github.com/MrSantana1990

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

---

## 8) Manual comercial (para venda do sistema)

> Importante: este sistema **não promete lucro** e **não garante resultados**. Ele automatiza/organiza execução, risco e auditoria. Qualquer comunicação comercial deve evitar “promessa de ganhos”.

### 8.1) O que é (pitch rápido)
**HelpSystem • Binance Bot** é um portal + bot que:
- Analisa sinais técnicos (RSI/Bollinger/MACD) + notícias (sentimento)
- Gera **decisões explicáveis**
- Executa operações com **travas de risco**
- Descobre novas moedas (discovery) com **aprovação obrigatória**
- Centraliza tudo num painel “estilo exchange” para operação e auditoria

### 8.2) Público-alvo e casos de uso
- **Operador pessoa física** que quer padronizar entradas/saídas e reduzir erro manual
- **Small desk / grupo** que quer rastreabilidade (decisão → execução → log)
- **Criadores de comunidade** (uso educacional): mostrar “por que” a estratégia decide
- **Times internos** (backoffice): monitorar várias moedas e regras de risco

Casos de uso típicos:
- “Quero operar sempre as mesmas 6 moedas com regras fixas” (auto)
- “Quero que o bot procure oportunidades novas, mas eu aprovo” (discovery + pendências)
- “Quero alertas no Telegram quando houver evento/erro” (opcional)

### 8.3) Diferenciais (vantagens competitivas)
- **Explicável**: cada decisão guarda *por que* e *sinais* (auditoria real)
- **Discovery com governança**: moedas novas precisam de OK (evita “surpresas”)
- **Segurança por padrão**: dry-run e testnet primeiro; trava para live (`HSP_LIVE_TRADING=1`)
- **Onboarding guiado**: Configurações (Passo 1/2) e perfis (Conservador/Padrão/Agressivo)
- **Operação simplificada**: painel único com botões e status (Play/Stop/pendências)

### 8.4) Como vender (modelos de oferta)
Você pode vender como:
1) **Licença + instalação** (pagamento único) + opcional mensal de suporte
2) **Assinatura** (SaaS/hosted) com tiers (Starter/Pro/Team)
3) **Produto educacional** (curso + ferramenta) com modo dry-run obrigatório
4) **Serviço gerenciado** (setup + tuning + monitoramento) sem prometer retorno

### 8.5) Sugestão de planos (exemplo)
**Starter (local)**:
- Portal + bot em dry-run/testnet
- Config guiada + perfis
- Discovery com pendências

**Pro**:
- Tudo do Starter
- Alertas Telegram + limites de notificação
- Exportação de relatórios (trades/decisions) + rotinas de backup

**Team/Enterprise**:
- Multiusuário/roles (quando evoluir)
- Deploy padronizado (quando migrar para blueprint HelpSystem Pro serverless)
- Logs/telemetria avançada + SLA

### 8.6) Tempo de implantação e operação (estimativas realistas)
Esses tempos variam com familiaridade do usuário e ambiente:
- **Setup inicial** (instalar/rodar, configurar chaves e settings): ~10–30 min
- **Validação em dry-run/testnet** (rodar ciclos e ajustar parâmetros): ~30–120 min
- **Operação diária** (checar pendências/alertas e saúde do bot): ~2–10 min/dia

### 8.7) “Percentual de ganhos” — como tratar corretamente (sem promessa)
Evite afirmar “X% de ganho” em materiais de venda sem evidência e sem contexto.
O correto é oferecer um **método de medição** e deixar claro que:
- resultados dependem de mercado, slippage, taxas, liquidez e disciplina
- backtest ≠ resultado futuro

Métricas recomendadas para relatório ao cliente (com período e config):
- **PnL (USDT/R$)** e **PnL%**
- **Win rate** (taxa de acerto)
- **Max drawdown** (pior queda do período)
- **Expectancy** (ganho esperado por trade)
- **Sharpe** (ajustado ao risco, se aplicável)

Template de frase comercial segura:
> “O sistema não garante lucro. Ele oferece automação, gestão de risco e auditoria de decisões. A performance deve ser validada em testnet/dry-run e acompanhada por métricas (PnL, drawdown, win rate) no período definido.”

### 8.8) Compliance e texto de segurança (recomendado)
Inclua sempre:
- “Não é recomendação financeira”
- “Não há garantia de resultados”
- “Use testnet e dry-run antes do real”
- “Você é responsável por chaves, limites e risco”
