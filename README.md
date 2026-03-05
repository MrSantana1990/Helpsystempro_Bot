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

## Documentação
- Manual geral: `docs/MANUAL.md`
- Manual comercial: `docs/MANUAL_COMERCIAL.md`
- Modelo de chaves: `BinanceBot/Configs/key.env.example`

## App Mobile (Android/iOS)
Código em `mobile/` (Expo). Instruções: `mobile/README.md`.
