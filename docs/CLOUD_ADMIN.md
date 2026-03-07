# Cloud Admin — usuários, 2FA e planos (Fase Cloud)

Este guia explica **onde** e **como** você gerencia:
- usuários/senhas do painel Cloud
- 2FA obrigatório (Google Authenticator / TOTP)
- clientes (tenants) e plano por cliente

> Aviso: não é recomendação financeira. Não há garantia de lucro.

---

## 1) Onde fica o “painel central”
- Backend (API Cloud): `cloud/api/`
- Banco (Postgres via Docker): `cloud/compose/`
- Painel Admin (web): `cloud/admin/`

O Admin é o lugar onde você cria usuários, cria tenants (clientes) e vincula usuários aos tenants.

---

## 2) Rodar local (Cloud)

### 2.1 Subir Postgres + API
```powershell
cd D:\DEV\Helpsystempro_Bot\cloud\compose
Copy-Item .env.example .env -Force
docker compose up -d --build
```

Health:
- `http://localhost:8802/health`

### 2.2 Subir o Admin (web)
```powershell
cd D:\DEV\Helpsystempro_Bot\cloud\admin
npm install
npm run dev
```

Admin:
- `http://localhost:8801`

---

## 3) Criar o primeiro admin (bootstrap)

No `.env` de `cloud/compose/`, defina um código forte:
- `HSP_BOOTSTRAP_CODE=...` (mínimo 8 chars)

No Admin (`http://localhost:8801`):
1) Informe `bootstrapCode + email + senha`
2) Clique em **Bootstrap admin**

Depois do primeiro admin criado, o bootstrap é bloqueado automaticamente.

---

## 4) 2FA obrigatório (Google Authenticator)

No Admin:
1) Clique em **Gerar QR (2FA)**
2) Escaneie o QR no Google Authenticator (ou app TOTP)
3) Digite o código de 6 dígitos e clique em **Habilitar 2FA**

Sem 2FA habilitado, o login retorna erro (2FA é obrigatório).

---

## 5) Login e gerenciamento (usuários / tenants / planos)

Depois do 2FA:
1) Faça login com `email + senha + TOTP`
2) Vá nas seções:
   - **Usuários**: cria usuários (`role=user/admin`)
   - **Tenants (clientes)**: cria clientes e define `plan` (starter/pro/premium)
   - **Vincular usuário → tenant**: dá acesso do usuário ao cliente

Observação:
- O campo `plan` existe para **limitar recursos por plano** (enforcement). A governança de plano é a próxima etapa do backend (limites por tenant).

---

## 6) Onde ficam “usuário e senha”

### No Cloud
- Usuários e senhas ficam no **Postgres** (tabela `users`), com senha **hash** (não reversível).
- O 2FA fica ligado por usuário (`totp_enabled` + segredo criptografado).

### No Local-first (painel local)
- Não há cadastro de usuário: o acesso é por **token local** (`HSP_PORTAL_TOKEN`) e por padrão a API só aceita `127.0.0.1`.

---

## 7) Variáveis importantes (Cloud)
No arquivo `cloud/compose/.env`:
- `DATABASE_URL=...`
- `JWT_SECRET=...` (forte, 32+ chars)
- `HSP_ENCRYPTION_KEY_BASE64=...` (32 bytes em base64, AES-256-GCM)
- `HSP_BOOTSTRAP_CODE=...`
- `PORT=8802` (opcional)

---

## 8) Segurança mínima recomendada (produção)
- Rodar atrás de HTTPS (reverse proxy) e firewall
- 2FA obrigatório (já implementado)
- Rate limit / lockout (recomendado como hardening)
- Nunca permitir chaves Binance com `withdraw`
- Auditoria (logs) e exportação (CSV)

