# HelpSystem • Binance Bot — Mobile (React Native / Expo)

App mobile (Android/iOS) no mesmo código, para operar/monitorar o **HelpSystem • Binance Bot**.

> Aviso: não é recomendação financeira e não há garantia de lucro. Use dry-run/testnet e limites de risco.

## Pré-requisitos
- Node.js 18+ (recomendado 20)
- Expo Go instalado no celular (Android/iOS)

## Rodar o backend em modo LAN (para o celular enxergar)
No PC (Windows / PowerShell), no root do repo:

```powershell
cd D:\DEV\Helpsystempro_Bot; .\run_local.ps1 -Lan
```

O console vai mostrar um token no formato `lan-...`.
No celular, use:
- Base URL: `http://IP_DO_PC:8502`
- Token: o `lan-...`

## Rodar o app
```powershell
cd D:\DEV\Helpsystempro_Bot\mobile
npm install
npm run start
```

Depois:
- Leia o QR Code com o Expo Go
- ou selecione `a` (Android) no terminal para abrir no emulador

## Se aparecer “Project is incompatible with this version of Expo Go”
Isso acontece quando o projeto usa um **Expo SDK mais novo** do que o Expo Go da Play Store/App Store suporta naquele momento.

Este repo usa **Expo SDK 54** para compatibilidade com o Expo Go atual.

Se você já tinha instalado dependências antes (ou trocou de SDK), faça um reset:

```powershell
cd D:\DEV\Helpsystempro_Bot\mobile
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue
npm install
npx expo start
```

Se ainda assim falhar, use `npx expo start --tunnel` (evita problemas de rede/LAN) ou crie um **Development Build** (sem Expo Go).

## Produção (VPS)
Para produção, aponte a Base URL para o domínio HTTPS (VPS):
- `https://bot.seudominio.com`

Recomendado:
- Binance API Key sem withdraw
- IP whitelist da VPS
- Token forte + auth habilitado
