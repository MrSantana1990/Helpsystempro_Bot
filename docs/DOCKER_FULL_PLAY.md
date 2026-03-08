# Docker Full Play - stack completa com 1 play

Sobe toda a stack local para teste:
- bot/local API + portal (`8501` e `8502`)
- cloud admin (`8801`)
- cloud API (`8802`)
- postgres (`cloud-db`)

## Subir
```powershell
cd D:\DEV\Helpsystempro_Bot
.\run_docker_full.ps1
```

## URLs
- Portal operacional: `http://localhost:8501`
- API do bot: `http://localhost:8502/docs`
- Admin cloud: `http://localhost:8801`
- API cloud health: `http://localhost:8802/health`

Suporte interno:
- Web: menu `Sistema > Suporte` no `8501`
- Mobile: aba `Suporte`

## Conectar banco no VS Code (extensão Database)
Use estes dados no host local:
- Host: `127.0.0.1`
- Port: `5433`
- User: `postgres`
- Password: `postgres`
- Database: `helpsystem`

Nao use `cloud-db` como host no VS Code local (esse host so existe dentro da rede Docker).

## Variaveis criticas (`.env.docker.full`)
- `HSP_ENABLE_AUTH=1`
- `ENABLE_AUTH=1`
- `ENABLE_2FA=1`
- `BASE_URL=http://cloud-api:8802`
- `HSP_BILLING_PROVIDER=mock_pix` (teste local)

Para producao PIX real:
```env
HSP_BILLING_PROVIDER=mercado_pago
HSP_MP_ACCESS_TOKEN=APP_USR-...
HSP_MP_WEBHOOK_SECRET=
HSP_MP_NOTIFICATION_URL=https://SEU-DOMINIO/api/billing/webhook/mercado_pago
```

## Fluxo minimo de validacao
1. Bootstrap master (`/onboarding/bootstrap`)
2. Ativar 2FA (`/onboarding/2fa`)
3. Login (`/login`)
4. Solicitar cadastro no `8501`
5. Aprovar em `Console > Solicitacoes`
6. Gerar fatura PIX em `Console > Cobranca`
7. Confirmar pagamento por webhook
8. Validar bloqueio de LIVE quando fatura falha/suspende

## Smoke test rapido (executado neste ciclo)
- Cadastro -> aprovacao -> login cliente com 2FA: OK
- Geracao de fatura PIX (mock): OK
- Webhook `paid` => assinatura `active` e `can_live=true`: OK
- Webhook `failed` => assinatura `suspended` e `can_live=false`: OK
- `/api/metrics` (cloud e bot): OK
- `/api/ops/health`: OK (status consolidado)

## Rebuild quando nao refletir mudancas
```powershell
cd D:\DEV\Helpsystempro_Bot
docker compose -f docker-compose.full.yml --env-file .env.docker.full build cloud-api cloud-admin bot-local
docker compose -f docker-compose.full.yml --env-file .env.docker.full up -d
```

## Mobile em LAN
No `.env.docker.full`:
```env
HSP_BIND_ADDR=0.0.0.0
```

Depois:
```powershell
docker compose -f docker-compose.full.yml --env-file .env.docker.full up -d --build bot-local
```

No admin (`/console/settings`):
- modo `LAN`
- IP da maquina
- token
- escanear QR no app

## Parar stack
```powershell
cd D:\DEV\Helpsystempro_Bot
.\run_docker_full.ps1 -Down
```
