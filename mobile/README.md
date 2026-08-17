<div align="center">

# 📱 HelpSystem Pro Mobile

### Operação, inteligência e risco na palma da mão.

[![Expo](https://img.shields.io/badge/Expo-SDK_54-000020?style=for-the-badge&logo=expo)](#-executar)
[![Android](https://img.shields.io/badge/Android-compatível-3ddc84?style=for-the-badge&logo=android&logoColor=white)](#-executar)
[![iOS](https://img.shields.io/badge/iOS-compatível-black?style=for-the-badge&logo=apple)](#-executar)
[![2FA](https://img.shields.io/badge/login-2FA-22c55e?style=for-the-badge)](#-segurança)

</div>

---

## ✦ Experiência

Aplicativo React Native com interface dark fintech, navegação simplificada e conexão segura ao backend local ou à VPS.

## ✨ Recursos

| Área | Entrega |
|---|---|
| Dashboard | Estado da conta, operação e risco |
| IA | Decisões e explicações |
| Mercado | Indicadores e acompanhamento |
| Bot | Controles autorizados |
| Conta | Plano, licença, senha e suporte |

Inclui onboarding guiado, login com TOTP, conexão por QR Code e central de chamados.

## 🧱 Requisitos

- Node.js 20 ou superior;
- Expo Go atualizado;
- API local em LAN ou VPS protegida.

## 🚀 Executar

Primeiro, no diretório raiz:

    .\run_local.ps1 -Lan

Depois:

    cd mobile
    npm install
    npm run start

Escaneie o QR Code com o Expo Go. Para limpar um bundle antigo:

    npx expo start --clear

## 🧭 Fluxo

1. onboarding;
2. conexão com API;
3. login e 2FA;
4. dashboard;
5. operação conforme permissões.

## 🔐 Segurança

- token mantido no armazenamento seguro disponível;
- TOTP para contas cloud;
- nenhuma chave Binance digitada no aplicativo;
- ações críticas dependem da API;
- URLs HTTP somente para testes em LAN confiável;
- VPS sempre com HTTPS e controle de acesso.

## ⚖️ Aviso

O aplicativo não oferece recomendação financeira nem garantia de lucro. Use dry-run/testnet e respeite os limites de risco.
