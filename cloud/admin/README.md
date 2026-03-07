# HelpSystem Pro — Admin (Web)

Painel central (web) para gerenciar **usuários/tenants/planos** da plataforma Cloud.

Este painel conversa com a API Cloud via endpoints REST em:
- `POST /api/bootstrap-admin`
- `POST /api/totp/setup-start`
- `POST /api/totp/enable`
- `POST /api/login`
- `GET/POST /api/admin/*`

## Rodar (dev)
```bash
cd cloud/admin
npm install
npm run dev
```

Variável opcional:
- `VITE_API_BASE=http://localhost:8802`

