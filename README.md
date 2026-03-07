# HelpSystem • Binance Bot

Portal moderno (React) + API (FastAPI) + bot (Python) para **análise e execução** com:
- Decisões explicáveis (RSI/Bollinger/MACD + sentimento de notícias)
- Trades e histórico em SQLite
- Discovery de novas moedas com **aprovação obrigatória**
- Saldo estimado em **USDT e R$**

> Aviso: **não existe garantia de lucro**. Use **dry-run** e **testnet** antes de qualquer operação real.

## Rodar local (Windows / PowerShell)

```powershell
cd D:\DEV\Helpsystempro_Bot; powershell -NoProfile -ExecutionPolicy Bypass -File .\run_local.ps1
```

- Portal: `http://localhost:8501`
- API: `http://localhost:8502/docs`

### Modo LAN (celular / React Native)
Para testar no celular (Android/iOS) na mesma rede Wi‑Fi:

```powershell
cd D:\DEV\Helpsystempro_Bot; powershell -NoProfile -ExecutionPolicy Bypass -File .\run_local.ps1 -Lan
```

- A API vai aceitar conexões da rede (bind `0.0.0.0`) e o script gera um **token aleatório**.
- No celular, use `http://IP_DO_PC:8502` como Base URL e cole o token.

Dados fictícios (para ver o painel preenchido):
```powershell
.\run_local.ps1 -Mock -Seed 42
```

Smoke test:
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\smoke_test.ps1 -Token local-dev
```

## Subir tudo (2 terminais) — web/api + mobile
Terminal 1 (API + Painel + LAN):
```powershell
cd D:\DEV\Helpsystempro_Bot; .\run_local.ps1 -Lan
```

Terminal 2 (Mobile / Expo):
```powershell
cd D:\DEV\Helpsystempro_Bot; .\run_mobile.ps1
```

Ou (abre 2 terminais automaticamente):
```powershell
cd D:\DEV\Helpsystempro_Bot; .\run_dev_all.ps1 -Mock -Seed 42
```

## Documentação
- Manual geral: `docs/MANUAL.md`
- Manual comercial: `docs/MANUAL_COMERCIAL.md`
- Modelo de chaves: `BinanceBot/Configs/key.env.example`

## Plataforma Cloud (multiusuário + 2FA)
O modo **Cloud** (multiusuário, tenants, 2FA obrigatório e painel admin) fica em `cloud/`.

Rodar local (Docker + painel admin):
```powershell
cd D:\DEV\Helpsystempro_Bot\cloud\compose
Copy-Item .env.example .env -Force
docker compose up -d --build

cd D:\DEV\Helpsystempro_Bot\cloud\admin
npm install
npm run dev
```

- API Cloud: `http://localhost:8802/health`
- Admin Cloud: `http://localhost:8801`

Obs.: o repo **não** tem `package.json` na raiz. Para rodar `npm run dev`, entre na pasta do projeto desejado (`web/`, `landing/`, `cloud/admin/`, `mobile/`).

## App Mobile (Android/iOS)
Código em `mobile/` (Expo). Instruções: `mobile/README.md`.

Nota: o app mobile usa Expo SDK 53 para compatibilidade com o Expo Go da Play Store. Se você tinha uma instalação anterior, rode `npm install` em `mobile/` novamente.
