<div align="center">

# ☁️ HelpSystem Pro Cloud

### Identidade, administração e operação central 24/7.

[![API](https://img.shields.io/badge/API-TypeScript-3178c6?style=for-the-badge&logo=typescript)](api/)
[![Banco](https://img.shields.io/badge/banco-PostgreSQL-4169e1?style=for-the-badge&logo=postgresql&logoColor=white)](compose/)
[![2FA](https://img.shields.io/badge/2FA-TOTP-22c55e?style=for-the-badge)](#-primeiro-acesso)

</div>

---

## ✦ Objetivo

Camada central para usuários, empresas, planos, licenças, auditoria e autenticação. A execução de cada bot permanece isolada.

## 🧩 Componentes

| Diretório | Responsabilidade |
|---|---|
| [api](api/) | API Node.js, TypeScript, Express, tRPC e Zod |
| [admin](admin/) | Console administrativo React |
| [compose](compose/) | PostgreSQL, API e infraestrutura local |

## 🚀 Executar

1. Copie cloud/compose/.env.example para cloud/compose/.env.
2. Gere segredos fortes e exclusivos.
3. Inicie:

       cd cloud/compose
       docker compose up -d --build

4. Verifique http://localhost:8802/health.

Painel em desenvolvimento:

    cd cloud/admin
    npm install
    npm run dev

## 🔐 Primeiro acesso

1. Abra http://localhost:8801.
2. Crie o primeiro administrador com HSP_BOOTSTRAP_CODE.
3. Configure TOTP no autenticador.
4. Confirme o 2FA.
5. Cadastre usuários e empresas.
6. Vincule cada usuário ao tenant correto.

O bootstrap é bloqueado após o primeiro administrador.

## 🛡️ Produção

- nunca reutilize os valores dos arquivos example;
- mantenha banco e API fora de portas públicas;
- use HTTPS e Cloudflare Access;
- faça backup do PostgreSQL;
- rotacione segredos;
- preserve logs de auditoria.

> Não há garantia de lucro e este software não constitui recomendação financeira.
