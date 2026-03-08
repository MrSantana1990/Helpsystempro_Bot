# HelpSystem Pro — Cloud Admin (Web)

Console administrativa enterprise para operação em VPS.

## Rotas de UI

- `/login`
- `/onboarding/bootstrap`
- `/onboarding/2fa`
- `/console`

## Endpoints principais usados

- `GET /api/public/config`
- `GET /api/public/bootstrap-status`
- `POST /api/bootstrap-admin`
- `POST /api/totp/setup-start`
- `POST /api/totp/enable`
- `POST /api/login`
- `GET /api/me`
- `GET /api/admin/dashboard`
- `GET /api/admin/subscribers`
- `GET/POST /api/admin/users`
- `GET/POST /api/admin/tenants`
- `GET /api/admin/links`
- `POST /api/admin/grant`
- `GET/POST /api/admin/licenses`
- `GET /api/admin/billing`
- `POST /api/admin/billing/event`
- `GET /api/admin/security`
- `GET /api/admin/audit`
- `GET /api/admin/settings`

## Rodar em desenvolvimento

```bash
cd cloud/admin
npm install
npm run dev
```

Variável opcional:

- `VITE_API_BASE=http://localhost:8802`
