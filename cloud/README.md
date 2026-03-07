# HelpSystem Pro — Plataforma Central (Cloud 24/7)

Este diretório inicia a **Fase Cloud**: multiusuário, autenticação obrigatória e execução 24/7 (VPS/containers).

Objetivo:
- Um backend central com **usuários + tenants + planos**
- **2FA obrigatório (TOTP / Google Authenticator)**
- Admin panel para você gerenciar clientes
- Execução do bot em containers isolados por cliente (próxima etapa)

> Aviso: não é recomendação financeira e não há garantia de lucro.

## Estrutura
- `cloud/api/` — API (Node.js + TypeScript + Express + tRPC + Zod)
- `cloud/compose/` — Docker Compose (Postgres + API)
 - `cloud/admin/` — Painel admin (React + Vite + Tailwind)

## Rodar local (Docker)
1) Copie `cloud/compose/.env.example` para `cloud/compose/.env`
2) Suba:
```bash
cd cloud/compose
docker compose up -d --build
```

3) Health:
- `http://localhost:8802/health`

## Rodar o Admin (web)
Em outro terminal:
```bash
cd cloud/admin
npm install
npm run dev
```

- Admin: `http://localhost:8801`

## Bootstrap do primeiro admin
Na primeira vez, o sistema permite criar o 1º admin com um **código de bootstrap** (env `HSP_BOOTSTRAP_CODE`).

Depois disso, bootstrap é bloqueado.

Fluxo sugerido:
1) Abra o Admin (`http://localhost:8801`)
2) Faça o bootstrap do 1º admin (código + email + senha)
3) Faça setup do 2FA (escaneia o QR no Google Authenticator e habilita)
4) Faça login com email/senha/TOTP
5) Cadastre usuários, clientes (tenants) e vincule usuário → tenant
