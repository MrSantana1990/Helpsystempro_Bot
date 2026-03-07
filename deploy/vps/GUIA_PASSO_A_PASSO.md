# VPS — Guia passo a passo (24/7) — HelpSystem • Binance Bot

Este guia coloca o **painel + API + bot** no ar **24/7** em uma VPS, acessível via web (HTTPS).

> Aviso: não é recomendação financeira. Não há garantia de lucro. Use dry-run/testnet e limites de risco.

---

## 0) O que você vai ter no final
- URL web (HTTPS): painel “estilo exchange”
- API (atrás do mesmo domínio, via reverse proxy)
- Execução 24/7 (Docker) com autostart (recomendado em dry-run/testnet no piloto)
- Proteções mínimas:
  - Binance API Key **sem withdraw**
  - Basic Auth no painel (Caddy)
  - Token obrigatório na API (`HSP_PORTAL_TOKEN`)

---

## 1) Pré-requisitos
- VPS Ubuntu 22.04+ (recomendado **2 vCPU / 4GB RAM**)
- Domínio apontando para a VPS (A record)
- Portas liberadas: **80** e **443**

---

## 2) Instalar Docker (Ubuntu)
```bash
sudo apt update -y
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo \"$VERSION_CODENAME\") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update -y
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker
```

---

## 3) Clonar o projeto na VPS
```bash
mkdir -p ~/apps
cd ~/apps
git clone https://github.com/MrSantana1990/Helpsystempro_Bot.git
cd Helpsystempro_Bot
```

---

## 4) Configurar o deploy (Caddy + app)
Entre em `deploy/vps` e crie o `.env`:
```bash
cd deploy/vps
cp .env.example .env
```

Edite `deploy/vps/.env` e ajuste:
- `DOMAIN=bot.seudominio.com`
- `HSP_PORTAL_TOKEN=` (gere um token forte, 32+ chars)
- `PANEL_USER=` (ex: admin)
- `PANEL_PASSWORD_HASH=` (gerar hash do Caddy)

### Gerar hash de senha (Caddy)
Ainda dentro de `deploy/vps`:
```bash
docker run --rm caddy:2 caddy hash-password --plaintext "SUA_SENHA_FORTE"
```
Copie o output para `PANEL_PASSWORD_HASH=...`

---

## 5) Subir com Docker Compose
No diretório `deploy/vps`:
```bash
docker compose up -d --build
docker compose ps
```

Ver logs:
```bash
docker compose logs -f --tail=200
```

---

## 6) Acessar
- Painel: `https://SEU_DOMINIO`
- A API fica atrás do mesmo domínio (via Caddy). O painel já chama a API internamente.

No app mobile:
- Base URL: `https://SEU_DOMINIO`
- Token: o valor de `HSP_PORTAL_TOKEN`

---

## 7) Checklist de segurança (mínimo aceitável)
- Binance:
  - API Key **SEM withdraw**
  - (Recomendado) whitelist de IP para o IP da VPS
- VPS:
  - Firewall permitindo só 22/80/443
  - Senha forte no Basic Auth
  - Token forte na API

---

## 8) Operação 24/7 (piloto)
No `.env` (deploy/vps):
- `HSP_AUTOSTART_BOT=1`
- `HSP_AUTOSTART_DRY_RUN=1` (recomendado no piloto)
- Mantenha `HSP_LIVE_TRADING=0` até validar termo + licença + limites.

---

## 9) Atualizar versão (deploy)
```bash
cd ~/apps/Helpsystempro_Bot
git pull
cd deploy/vps
docker compose up -d --build
```

---

## 10) Backup (recomendado)
Os dados importantes ficam em pastas do host (mapeadas como volume):
- `data/` (SQLite, auditoria, licença, etc.)
- `logs/`
- `BinanceBot/Configs/` (settings/key.env)

Faça backup dessas pastas (snapshot, rsync ou storage externo).

