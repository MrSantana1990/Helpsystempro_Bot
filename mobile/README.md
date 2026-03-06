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

## Produção (VPS)
Para produção, aponte a Base URL para o domínio HTTPS (VPS):
- `https://bot.seudominio.com`

Recomendado:
- Binance API Key sem withdraw
- IP whitelist da VPS
- Token forte + auth habilitado
