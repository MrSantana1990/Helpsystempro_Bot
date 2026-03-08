# Cloud Admin - guia operacional (VPS por cliente)

Este guia cobre o painel administrativo em `http://localhost:8801`.

> Aviso: nao e recomendacao financeira e nao ha garantia de lucro.

## Rotas principais
- `http://localhost:8801/login`
- `http://localhost:8801/onboarding/bootstrap`
- `http://localhost:8801/onboarding/2fa`
- `http://localhost:8801/console`

## Fluxo de acesso (master)
1. Bootstrap interno (`/onboarding/bootstrap`) no primeiro uso.
2. Ativar 2FA (`/onboarding/2fa`) com Google Authenticator.
3. Login (`/login`) com email + senha + codigo TOTP.

## Fluxo comercial (cadastro -> aprovacao -> pagamento -> liberacao)
1. Cliente solicita cadastro no portal `http://localhost:8501` em **Solicitar cadastro**.
2. Pedido fica pendente em `Console > Solicitacoes`.
3. Master define plano/ciclo e confirma pagamento inicial.
4. Master aprova o cadastro.
5. Sistema cria automaticamente:
   - usuario
   - tenant (cliente)
   - vinculo usuario->tenant
   - assinatura
   - licenca
6. Cliente entra no portal com o mesmo email/senha e conclui 2FA no primeiro acesso.

## Billing automatico (PIX + webhook)

### Tabelas novas
- `invoices`
- `payment_webhooks`

### Endpoints admin
- `POST /api/admin/billing/invoices` (gera cobranca PIX)
- `GET /api/admin/billing/invoices`
- `POST /api/admin/billing/invoices/:id/cancel`

### Endpoint webhook publico
- `POST /api/billing/webhook/:provider`
- Idempotencia por `provider + event_id` (tabela `payment_webhooks`).

### Regras automaticas
- `invoice paid` => `subscription active`
- `invoice overdue` + prazo de graca => `subscription suspended`
- `subscription suspended` => bloqueio de LIVE no portal operacional

## Providers de pagamento
- Producao: `mercado_pago` (PIX real)
- Local/teste: `mock_pix` (gera copia-e-cola/QR de teste e aceita webhook simulado)

Variaveis relevantes no `cloud-api`:
- `HSP_BILLING_PROVIDER`
- `HSP_BILLING_GRACE_DAYS`
- `HSP_MP_ACCESS_TOKEN`
- `HSP_MP_WEBHOOK_SECRET`
- `HSP_MP_NOTIFICATION_URL`

## UI de Cobranca (Console > Cobranca)
- Status real por fatura (`pendente`, `pago`, `vencido`, `suspenso`, `cancelado`, `falhou`)
- Botao **Gerar PIX**
- Copia e cola do PIX
- QR code
- Historico de webhooks

## Observabilidade 24/7

### Endpoints
- Cloud API: `GET /api/metrics` (Prometheus)
- Bot API: `GET /api/metrics`
- Bot API: `GET /api/ops/health` (api, db, exchange, worker, license, subscription)

### Metricas minimas
- `bot_orders_total`
- `bot_risk_blocks_total`
- `bot_errors_total`
- `bot_cycle_duration_seconds`
- `api_request_duration_seconds`

### Alertas Telegram automaticos
- bot parado
- limite de risco atingido
- falha de exchange/API
- assinatura suspensa

## Seguranca
- 2FA obrigatorio no admin.
- Mensagens de erro amigaveis no UI/API.
- Logs estruturados JSON com `request_id` e `tenant_id` no cloud API e bot API.
- Chaves Binance sempre sem permissao de saque.

## Suporte interno (web + mobile)
- Portal operacional (`8501`): menu `Sistema > Suporte`
- App mobile: aba `Suporte`
- API:
  - `GET /api/support/sectors`
  - `POST /api/support/tickets`
  - `GET /api/support/tickets`
- Persistencia: `data/support_tickets.jsonl`
