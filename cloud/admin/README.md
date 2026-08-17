<div align="center">

# ◫ HelpSystem Pro · Cloud Admin

### Console central para usuários, empresas, planos, segurança e auditoria.

[![React](https://img.shields.io/badge/React-Vite-61dafb?style=for-the-badge&logo=react&logoColor=black)](#-desenvolvimento)
[![Acesso](https://img.shields.io/badge/acesso-2FA-22c55e?style=for-the-badge)](#-fluxo)

</div>

---

## ✦ Responsabilidades

- bootstrap controlado do primeiro administrador;
- login e configuração TOTP;
- visão geral da plataforma;
- usuários, tenants e vínculos;
- planos, licenças e cobrança;
- segurança, configurações e auditoria.

## 🧭 Fluxo

| Rota | Uso |
|---|---|
| /login | Autenticação |
| /onboarding/bootstrap | Primeiro administrador |
| /onboarding/2fa | Ativação TOTP |
| /console | Console protegido |

## 🔌 API

O painel consome os endpoints públicos de configuração e bootstrap, autenticação, TOTP e rotas administrativas de dashboard, usuários, tenants, licenças, cobrança, segurança e auditoria.

## 🚀 Desenvolvimento

    cd cloud/admin
    npm install
    npm run dev

Variável opcional:

    VITE_API_BASE=http://localhost:8802

## ✅ Validação

    npm ci
    npm run build
    npm audit --omit=dev --audit-level=high

> O painel deve ser publicado somente com HTTPS e uma camada de controle de acesso.
