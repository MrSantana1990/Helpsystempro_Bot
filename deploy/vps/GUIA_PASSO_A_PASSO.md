# VPS - passo a passo (producao por cliente)

Objetivo: rodar 24/7 em VPS dedicada por cliente, com governanca, billing e observabilidade.

> Aviso: nao e recomendacao financeira e nao ha garantia de lucro.

## 1) Requisitos
- Ubuntu 22.04+
- Dominio apontado para a VPS
- Portas `80` e `443` liberadas
- Docker + Docker Compose

## 2) Clonar projeto
```bash
mkdir -p ~/apps
cd ~/apps
git clone https://github.com/MrSantana1990/Helpsystempro_Bot.git
cd Helpsystempro_Bot
```

## 3) Configurar ambiente
Use o arquivo principal da stack completa:
```bash
cp .env.docker.full .env.docker.full.local
```

Edite variaveis obrigatorias:
- `JWT_SECRET`
- `HSP_ENCRYPTION_KEY_BASE64`
- `HSP_BOOTSTRAP_CODE`
- `HSP_MASTER_EMAIL`
- `HSP_BIND_ADDR=0.0.0.0`

Billing PIX (producao):
- `HSP_BILLING_PROVIDER=mercado_pago`
- `HSP_MP_ACCESS_TOKEN`
- `HSP_MP_WEBHOOK_SECRET`
- `HSP_MP_NOTIFICATION_URL=https://SEU_DOMINIO/api/billing/webhook/mercado_pago`

## 4) Subir stack
```bash
docker compose -f docker-compose.full.yml --env-file .env.docker.full.local up -d --build
docker compose -f docker-compose.full.yml --env-file .env.docker.full.local ps
```

## 5) Bootstrap e seguranca
1. Acesse `https://SEU_DOMINIO/login`
2. Abra `https://SEU_DOMINIO/onboarding/bootstrap` (primeira vez)
3. Ative 2FA em `https://SEU_DOMINIO/onboarding/2fa`
4. Login no console (`/login`)

## 6) Fluxo comercial em producao
1. Cliente solicita cadastro no portal operacional (`/` ou `:8501` conforme proxy).
2. Master aprova no Cloud Admin:
   - plano
   - ciclo (mensal/trimestral/semestral/anual)
   - status de pagamento inicial
3. Em `Cobranca`, gerar PIX para renovacoes.
4. Webhook atualiza automaticamente assinatura/licenca.
5. Se assinatura suspender, LIVE fica bloqueado automaticamente.
6. Cliente pode abrir chamado direto no portal (`Sistema > Suporte`) ou no app mobile (`Suporte`).

## 7) Health, metricas e logs
- Cloud API: `GET /api/metrics`
- Bot API: `GET /api/metrics`
- Bot API: `GET /api/ops/health`

Logs estruturados JSON incluem:
- `request_id`
- `tenant_id`
- status e latencia da requisicao

## 8) Alertas Telegram
Configure Telegram no bot para alertas automaticos:
- bot parado
- limite de risco atingido
- falha de exchange
- assinatura suspensa

## 9) Atualizacao segura
```bash
cd ~/apps/Helpsystempro_Bot
git pull
docker compose -f docker-compose.full.yml --env-file .env.docker.full.local build cloud-api cloud-admin bot-local
docker compose -f docker-compose.full.yml --env-file .env.docker.full.local up -d
```

## 10) Backups
Salve periodicamente:
- `data/`
- `logs/`
- `BinanceBot/Configs/`
- dump do Postgres (`cloud-db`)
