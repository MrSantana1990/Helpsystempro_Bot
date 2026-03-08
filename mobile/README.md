# HelpSystem Mobile (Expo)

App mobile Android/iOS para operação e monitoramento do HelpSystem.

## Recursos atuais
- Painel mobile com visual premium (dark fintech)
- Tabs de operação (Painel, Mercados, Trades, Decisões, Bot, Saúde, Logs, Config)
- Aba **Suporte** com abertura de chamado por setor/prioridade
- Login local no aparelho + token/API configurável por QR Code

## Pré-requisitos
- Node.js 20+
- Expo Go atualizado
- Backend do bot rodando

## Rodar backend em LAN

No root do projeto:

```powershell
cd D:\DEV\Helpsystempro_Bot
.\run_local.ps1 -Lan
```

Use no app:
- Base URL: `http://IP_DO_PC:8502`
- Token: `lan-...` gerado no terminal

## Rodar app

```powershell
cd D:\DEV\Helpsystempro_Bot\mobile
npm install
npm run start
```

Depois escaneie o QR no Expo Go.

## Erro de versão Expo Go

Se aparecer incompatibilidade:

```powershell
cd D:\DEV\Helpsystempro_Bot\mobile
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue
npm install
npx expo start
```

## Endpoints usados no suporte
- `GET /api/support/sectors`
- `POST /api/support/tickets`
- `GET /api/support/tickets?mine=true`

## Compliance

Não é recomendação financeira e não há garantia de lucro.
