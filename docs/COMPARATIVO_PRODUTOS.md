# Comparativo de Produtos — HelpSystem Pro vs 3Commas, Bitsgap, Cryptohopper, TradeSanta

Este documento compara o **HelpSystem Pro (HelpSystem • Binance Bot)** com soluções populares de automação para cripto.

> Importante: **não é recomendação financeira** e **não há garantia de lucro**.  
> Recursos e planos de terceiros podem mudar; use este comparativo como guia de posicionamento e governança.

---

## 1) Resumo executivo (em 30 segundos)

**HelpSystem Pro** se posiciona como **ferramenta técnica de governança operacional** (risco + auditoria + aprovação), com **implantação Local-first** (ou VPS dedicada por cliente), evitando o modelo SaaS multi-tenant nesta fase.

O diferencial central não é “promessa de resultado”, e sim:
- **controles de risco “finance-safe”** (kill switch + limites obrigatórios),
- **decisões explicáveis** (por que comprou/vendeu),
- **auditoria exportável** (CSV + trilha),
- **discovery com aprovação** (moedas novas só com OK).

---

## 2) Tabela de recursos (visão de alto nível)

Legenda:
- ✅ = disponível
- ◐ = disponível em parte / depende de plano / depende de configuração
- ❌ = não é foco / não aplicável

| Recurso / Critério | HelpSystem Pro (Local/VPS) | 3Commas (SaaS) | Bitsgap (SaaS) | Cryptohopper (SaaS) | TradeSanta (SaaS) |
|---|---:|---:|---:|---:|---:|
| Modelo de entrega | **Local-first** / VPS dedicada | SaaS | SaaS | SaaS | SaaS |
| Custódia de chaves | **Cliente** (local) | Cliente (API na nuvem) | Cliente (API na nuvem) | Cliente (API na nuvem) | Cliente (API na nuvem) |
| Exposição pública necessária | **Não** (localhost) | Sim (conta cloud) | Sim | Sim | Sim |
| Governança “moeda nova só com OK” | ✅ | ◐ | ◐ | ◐ | ◐ |
| Kill switch (manual/auto) | ✅ | ◐ | ◐ | ◐ | ◐ |
| Limites obrigatórios em LIVE | ✅ | ◐ | ◐ | ◐ | ◐ |
| Auditoria (eventos + export CSV) | ✅ | ◐ | ◐ | ◐ | ◐ |
| Decisão explicável (sinais + motivo) | ✅ | ◐ | ◐ | ◐ | ◐ |
| Dry-run / simulação (piloto) | ✅ | ◐ | ◐ | ◐ | ◐ |
| Testnet-first recomendado | ✅ | ◐ | ◐ | ◐ | ◐ |
| Marketplace / copy / sinais externos | ❌ (fase atual) | ✅/◐ | ✅/◐ | ✅/◐ | ◐ |
| Multiusuário (SaaS) | ❌ (fase atual) | ✅ | ✅ | ✅ | ✅ |
| Suporte a muitas exchanges | ◐ (foco Binance no piloto) | ✅/◐ | ✅/◐ | ✅/◐ | ✅/◐ |
| 2FA/SSO (web) | ❌ (fase atual) | ✅/◐ | ✅/◐ | ✅/◐ | ✅/◐ |

Notas:
- Em SaaS, a experiência é “pronta” e com integrações amplas; em contrapartida, existe **dependência de conta cloud**, **políticas do provedor** e **exposição de API em ambiente compartilhado**.
- No Local-first, o cliente tem mais controle, menos superfície exposta e **auditoria local**.

---

## 3) Diferenças de modelo (SaaS vs Local/VPS dedicada)

### SaaS (3Commas/Bitsgap/Cryptohopper/TradeSanta)
Vantagens:
- onboarding rápido para a maioria dos usuários;
- menos “setup técnico” do cliente;
- integrações e features amplas (dependendo do produto/plano).

Trade-offs:
- dependência do provedor e de disponibilidade cloud;
- necessidade de armazenar/usar chaves API em ambiente remoto;
- governança e auditoria podem ser menos “explicáveis” para operação interna (varia por plano).

### Local-first / VPS dedicada (HelpSystem Pro)
Vantagens:
- **sem exposição pública por padrão** (API bind em `127.0.0.1`);
- **zero custódia** pelo fornecedor (chaves ficam no cliente);
- controle fino: kill switch, limites obrigatórios, auditoria exportável;
- caminho natural para **VPS dedicada por cliente** sem virar SaaS multi-tenant.

Trade-offs:
- exige instalação/setup assistido;
- o cliente precisa manter o ambiente (ou contratar suporte/monitoramento).

---

## 4) Pontos fortes do HelpSystem Pro (posicionamento)

Use como bullets de venda:
- **Governança operacional**: moedas novas entram como pendência (aprovadas por prazo).
- **Risco primeiro**: limites obrigatórios e kill switch automático (sem narrativa de “lucro garantido”).
- **Auditoria real**: export de `audit.csv` + `trades.csv` para prestação de contas e revisão.
- **Local-first**: reduz exposição e evita custo jurídico/infra típico de SaaS multi-tenant.
- **Licença offline (LIVE)**: habilitação controlada por arquivo assinado (evita “uso livre” em conta real).

---

## 5) Posicionamento de preço sugerido (sem prometer retorno)

Referência do produto (exemplo):
- **Starter**: assinatura + setup (onboarding + perfis)
- **Pro**: inclui suporte, relatórios, rotinas de backup, alertas (opcional)
- **Premium**: tuning e acompanhamento (foco em governança e disciplina)

Justificativa de preço (argumento):
- você não vende “bot mágico”; vende **implantação + governança + auditoria + suporte**.
- o valor é “redução de erro operacional” + “disciplina” + “rastreabilidade”.

Regra de ouro comercial:
> Se o cliente pedir “% ao mês”, redirecione para **métricas** (PnL, drawdown, win rate) e **piloto em dry-run/testnet**.

