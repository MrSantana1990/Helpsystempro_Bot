# Roadmap Cloud 24/7 — HelpSystem Pro • Binance Bot

Este documento define a migração **Local-first → 24/7 web acessível** sem pular etapas.

> Importante: não é recomendação financeira e não há garantia de lucro.  
> Antes de LIVE, exigir piloto em dry-run/testnet, termo aceito e limites de risco.

---

## Princípio de produto (ordem correta)

**Fase 1** → Local-first (piloto) ✅  
**Fase 2** → VPS dedicada por cliente (24/7) ✅ (próximo)  
**Fase 3** → (se fizer sentido) SaaS multi-tenant

Evite inverter isso.

---

## Fase 2 — VPS dedicada por cliente (recomendado)

### Objetivo
Rodar **24/7** com painel web, sem depender do PC do cliente, mantendo isolamento e reduzindo risco multi-tenant.

### Como fica
- 1 VPS por cliente
- 1 stack Docker Compose por cliente
- HTTPS + basic auth no reverse proxy
- App interno (API + portal) por trás do proxy
- Dados em volume local (SQLite + audit + configs)

### Segurança mínima (baseline)
- Chaves Binance do cliente **sem withdraw**
- (Opcional recomendado) IP whitelist apontando para IP da VPS
- Token do portal (HSP_PORTAL_TOKEN) longo e secreto
- Reverse proxy com auth (primeira camada)
- Logs com redaction (segredos não aparecem)

### Entregáveis técnicos (Fase 2.0)
- `deploy/vps/*` (Caddy + docker-compose) ✅
- Monitoramento local: `/api/ops/health` ✅
- Export audit/trades CSV ✅
- Bloqueio LIVE sem termo + licença ✅

### Próximos itens (Fase 2.1 – hardening)
- Autenticação real (login + cookie httpOnly), sem “token em URL”
- 2FA (TOTP) para ações críticas (LIVE/start/stop/config)
- Segredos criptografados em repouso (key.env → vault/crypto)
- Observabilidade (logs JSON + métricas simples)
- Backup automático (volume data/logs)

---

## Variante (Fase 2b) — 1 VPS maior com múltiplos clientes (multi-tenant “light”)

Quando fizer sentido reduzir custo:
- 1 VPS maior
- 1 container por cliente
- reverse proxy (Traefik) roteando por subdomínio
- volumes separados por cliente

Entrega: `deploy/vps_multi/`

---

## Fase 3 — SaaS multi-tenant (só se validar mercado)

### O que muda
- Auth completo (RBAC, 2FA)
- Storage multi-tenant (MySQL/Postgres)
- KMS/Vault para criptografia de chaves
- Jobs/Workers (fila) para execução 24/7
- Billing/assinaturas e limites por plano

### Riscos/complexidade
- superfície jurídica e operacional maior
- necessidade de isolamento e criptografia por tenant
- custo de suporte/monitoramento aumenta

---

## Checklist de decisão (quando sair do VPS dedicada para SaaS)
Só faça quando tiver:
- ticket médio validado
- churn controlado
- playbook de onboarding estável
- suporte e monitoramento funcionando
- política de segurança definida e aplicada
