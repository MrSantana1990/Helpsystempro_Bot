# Relatorio Geral do Sistema - HelpSystem Pro

Data de referencia: 2026-03-08  
Escopo: `D:\DEV\Helpsystempro_Bot`  
Modelo atual: **VPS por cliente (sem SaaS publico)**

---

## 1) Status executivo

O sistema esta em **MVP avancado comercial**, com esteira operacional fechada para:

- cadastro de cliente
- aprovacao administrativa
- cobranca PIX
- webhook de pagamento
- liberacao/bloqueio automatico de LIVE
- observabilidade e alertas operacionais
- suporte operacional omnicanal (web + mobile)

---

## 2) Blocos ativos

1. **Bot local-first** (Python + FastAPI + React portal)
2. **Cloud Admin** (Node/Express + Postgres + React console)
3. **Mobile** (Expo/React Native, consumo da API)

Portas:
- `8501` portal operacional
- `8502` bot API
- `8801` cloud admin
- `8802` cloud API

---

## 3) Fase A concluida - Billing automatico (PIX + webhook)

### 3.1 Adapter de pagamento
- Interface de provider implementada.
- Provider inicial: **Mercado Pago PIX**.
- Provider adicional para teste local: **mock_pix**.

### 3.2 Banco
Tabelas adicionadas:
- `invoices`
- `payment_webhooks`

### 3.3 Endpoints
Admin:
- `POST /api/admin/billing/invoices`
- `GET /api/admin/billing/invoices`
- `POST /api/admin/billing/invoices/:id/cancel`

Webhook publico:
- `POST /api/billing/webhook/:provider`
- Idempotencia por `provider + event_id` (unique).

### 3.4 Regras automaticas
- `paid` => assinatura `active`
- `overdue` + grace period => `suspended`
- assinatura `suspended` => LIVE bloqueado no portal operacional

---

## 4) Fase B concluida - Observabilidade 24/7

### 4.1 Metricas Prometheus
- Cloud: `GET /api/metrics`
- Bot: `GET /api/metrics`

Metricas minimas entregues:
- `bot_orders_total`
- `bot_risk_blocks_total`
- `bot_errors_total`
- `bot_cycle_duration_seconds`
- `api_request_duration_seconds`

### 4.2 Health consolidado
- `GET /api/ops/health` (api, db, exchange, worker, license, subscription)

### 4.3 Alertas Telegram
Eventos automaticos:
- bot parado
- limite de risco atingido
- falha de exchange/API
- assinatura suspensa (bloqueio de LIVE)

### 4.4 Logs estruturados
- Cloud API e Bot API em JSON
- inclui `request_id` e `tenant_id`

---

## 5) Fase C concluida - Decision Engine 2.0 (sem quebrar engine atual)

Implementado em paralelo ao motor atual:
- detector de regime (`trend`, `sideways`, `high_vol`, `risk_off`)
- score composto:
  - `technical`
  - `sentiment`
  - `event`
  - `regime`
  - `liquidity`
- sizing dinamico:
  - `risk_per_trade * regime_multiplier * volatility_factor * confidence`
- endpoint explicavel:
  - `GET /api/decisions/explain/latest`
- ativacao controlada por feature flags por tenant/plano

---

## 6) UI/Admin - melhorias aplicadas

- Console em portugues.
- Tela de cobranca com status real, QR, copia-e-cola e historico de webhooks.
- Mensagens de erro amigaveis (API + frontend).
- Ajuste de layout na tela de `Usuarios > Criar vinculo` (corrigido overlap visual).
- Suporte in-app/in-portal com abertura de chamado por setor/prioridade.
- App mobile com novo shell visual premium (cards/KPIs/score bars/tabs aprimoradas).

---

## 6.1) Suporte operacional (novo)

Endpoints no bot API:
- `GET /api/support/sectors`
- `POST /api/support/tickets`
- `GET /api/support/tickets`

Fluxo:
- Usuario abre chamado no `8501` ou no app mobile.
- Chamado grava em `data/support_tickets.jsonl`.
- Evento entra em auditoria (`support.ticket_opened`) e gera alerta Telegram quando configurado.

---

## 7) Compatibilidade Docker full

Mantida e atualizada:
- `docker-compose.full.yml`
- `run_docker_full.ps1`
- `.env.docker.full`

Novas envs de billing propagadas no compose:
- `HSP_BILLING_PROVIDER`
- `HSP_BILLING_GRACE_DAYS`
- `HSP_MP_ACCESS_TOKEN`
- `HSP_MP_WEBHOOK_SECRET`
- `HSP_MP_NOTIFICATION_URL`

---

## 8) Smoke test fim a fim (executado)

Cenario validado:
1. bootstrap master
2. 2FA master + login
3. cadastro publico de cliente
4. aprovacao no admin
5. 2FA cliente + login
6. geracao de fatura PIX
7. webhook `paid` => `can_live=true`
8. webhook `failed` => `subscription=suspended` e `can_live=false`
9. metricas cloud + bot acessiveis
10. `/api/ops/health` respondendo

Resultado: **fluxo funcional fim a fim para operacao comercial assistida em VPS por cliente**.

---

## 9) Gaps remanescentes (proxima iteracao)

1. Integracao de gateway em producao (PIX real) com monitoramento de webhook em dominio final.
2. Dashboard operacional mais visual (UX premium) no portal `8501`.
3. Cobertura mobile para paridade total com fluxos avancados da web.
