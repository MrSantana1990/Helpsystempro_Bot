# Proposta Comercial — HelpSystem Pro (HelpSystem • Binance Bot)

Cliente: **[NOME DO CLIENTE]**  
Contato: **[WHATSAPP / EMAIL]**  
Data: **[DD/MM/AAAA]**  
Vendedor/Implantação: **HelpSystem Pro** — https://helpsystempro.netlify.app/  

> **Aviso legal:** este sistema **não é recomendação financeira** e **não há garantia de lucro**.  
> Operar criptoativos envolve risco, inclusive de perda total do capital.  

---

## 1) Visão geral (o que você está comprando)

O **HelpSystem Pro** é uma solução de **governança operacional** para operação em cripto que combina:
- **Portal estilo exchange** para status, logs, carteira, pendências e auditoria;
- **Bot com decisões explicáveis** (motivos + sinais) e trilha auditável;
- **Risk controls “finance-safe”** (kill switch e limites obrigatórios);
- **Discovery com governança**: o sistema encontra novas oportunidades, mas só opera moedas novas com **aprovação do usuário**.

Modelo recomendado: **Local-first**  
O bot + API + painel rodam na máquina do cliente (localhost). A API escuta apenas `127.0.0.1` e não há exposição pública.

---

## 2) Problemas que resolvemos (valor do produto)
- Reduz erro operacional (impulso, falta de regra, falta de limite)
- Aumenta disciplina com travas (limites por dia, posições, kill switch)
- Gera rastreabilidade (decisão → trade → log)
- Permite validação em **dry-run/testnet** antes de usar conta real

---

## 3) Comparativo (posicionamento)

Referência: `docs/COMPARATIVO_PRODUTOS.md`

Resumo:
- Concorrentes (SaaS): praticidade + integrações amplas, porém dependência cloud e uso de APIs em ambiente remoto.
- HelpSystem Pro (Local/VPS): foco em **governança, risco e auditoria**, com execução local e sem exposição pública por padrão.

---

## 4) Escopo técnico (entregáveis)

### 4.1 Entrega do software
- Portal local (React) + API local (FastAPI) + Bot
- Config guiada (key.env + settings.yml)
- Kill switch manual/automático
- Relatórios exportáveis: `audit.csv` e `trades.csv`
- Endpoint de saúde (observabilidade local): `/api/ops/health`

### 4.2 Implantação (setup assistido)
- Instalação e validação inicial no ambiente do cliente
- Perfil inicial de risco (Conservador / Padrão / Agressivo)
- Rodada de piloto em **dry-run/testnet** e checklist de segurança

### 4.3 Itens opcionais (conforme plano)
- Alertas Telegram
- Rotinas de backup e auditoria orientada
- Ajustes/tuning e acompanhamento de métricas

---

## 5) Planos e valores (exemplo)

> Preços podem variar conforme escopo, ambiente, implantação e SLA.

### Starter
Valor: **R$ 297/mês** + **Setup R$ 497**  
Inclui:
- Portal + bot em dry-run/testnet
- Discovery com governança (pendências)
- Auditoria e logs
- Implantação inicial e perfil de risco

### Pro
Valor: **R$ 497/mês**  
Inclui (Starter +):
- Alertas (Telegram opcional)
- Exportação e rotina de auditoria (CSV)
- Suporte recorrente e ajustes

### Premium
Valor: **R$ 997/mês**  
Inclui (Pro +):
- Tuning de perfis e limites
- Acompanhamento de métricas (sem promessa de retorno)
- Revisão de governança e risco

---

## 6) Processo de implementação (passo a passo)

1) Checklist do ambiente (PC/Windows, Node, Python, acesso à Binance)  
2) Instalação do sistema e execução local  
3) Configuração de chaves (se aplicável)  
4) Configuração de estratégia e limites (settings)  
5) Piloto em **dry-run/testnet** (obrigatório recomendado)  
6) Validação do painel (saúde, logs, export)  
7) (Opcional) ativação de LIVE com trava extra + aceite do termo

---

## 7) Segurança e governança (compromissos)

Local-first por padrão:
- API bind em `127.0.0.1`
- Sem exposição pública
- Sem custódia de chaves pelo fornecedor

Controles:
- Kill switch manual e automático
- Limites obrigatórios em LIVE
- Auditoria exportável (CSV)
- Licença offline para habilitar LIVE (assinada)

---

## 8) Termos de uso e limitações (resumo)

- **Não é recomendação financeira**
- **Não há garantia de lucro**
- Resultados variam por mercado, liquidez, taxas, slippage e configuração
- O cliente é responsável por:
  - chaves Binance e permissões da API
  - limites de risco e validação em testnet/dry-run
  - operar em conta real apenas quando entender os riscos

Documento: `docs/TERMO_RESPONSABILIDADE.md`

---

## 9) SLA sugerido (opcional, conforme plano)

Exemplo (ajustar):
- Janela de suporte: seg–sex, 09:00–18:00 (BRT)
- Tempo de resposta:
  - Starter: até 24h úteis
  - Pro: até 8h úteis
  - Premium: até 4h úteis
- Canal: WhatsApp + e-mail

Observação: SLA cobre **software e configuração**, não cobre “resultado financeiro”.

---

## 10) Aprovação

Ao aprovar esta proposta, o cliente declara que:
- leu e aceitou o termo de risco;
- entende que não há garantia de lucro;
- utilizará dry-run/testnet antes de operar ao vivo;
- é responsável pelas chaves e permissões de API.

Assinatura (Cliente): ___________________________  Data: ___/___/____  
Assinatura (HelpSystem Pro): _____________________  Data: ___/___/____

