 📖 Manual Técnico Completo do Sistema de Trading Automatizado - Binance Bot

 1. Introdução
Este manual técnico detalha o funcionamento, configuração e manutenção do sistema de trading automatizado desenvolvido para operar na plataforma Binance. O bot realiza análises de mercado, verifica tendências de notícias e executa operações de compra de criptomoedas com base em estratégias predefinidas e regras de negócio.

 2. Instalação e Configuração
 2.1. Requisitos Técnicos
- Python 3.10 ou superior
- Conta na Binance com API Key e Secret habilitados
- Conta no Telegram com Bot API Key e Chat ID
- Pacotes Python necessários:
  - `python-binance`
  - `python-telegram-bot`
  - `aiohttp`
  - `python-dotenv`
  - `requests`

 2.2. Configuração do Ambiente
1. Clonar o repositório:
   ```bash
   git clone https://github.com/seu-repositorio/BinanceBot.git
   ```
2. Criar o arquivo `.env` em `config/key.env`:
   ```env
   API_KEY=SuaApiKeyDaBinance
   API_SECRET=SeuApiSecretDaBinance
   TELEGRAM_API_KEY=SuaApiKeyDoTelegramBot
   TELEGRAM_CHAT_ID=SeuChatIDDoTelegram
   NEWS_API_KEY=SuaApiKeyDeNoticias
   ```
3. Instalar dependências:
   ```bash
   pip install -r requirements.txt
   ```

 3. Estrutura do Projeto
```
BinanceBot/
├── Binance_Bot.py
├── Modulos/
│   ├── market_data.py
│   ├── trading_strategy.py
│   ├── notifications.py
│   ├── logger.py
│   └── order_manager.py
├── config/
│   └── key.env
└── Logs/
    └── trading_bot.log
```

 4. Regras de Negócio
 4.1. Estratégia de Negociação
- Análise de Sentimento: O bot avalia o sentimento de notícias para identificar oportunidades de compra.
- Seleção de Ativos: Prioriza ativos como BTCUSDT e ETHUSDT conforme análise de mercado.
- Gestão de Risco: Limita ordens a partir do valor mínimo (`minNotional`) da Binance.
- Alocação de Capital: Divide o saldo disponível proporcionalmente entre os ativos selecionados.

 4.2. Política de Execução de Ordens
- Validação: Verifica saldo disponível, valor mínimo de compra e conformidade com filtros `LOT_SIZE`.
- Execução: Compra é realizada apenas após todas as validações serem aprovadas.
- Notificação: Falhas são comunicadas via Telegram e registradas em log.

 5. Funcionalidades Técnicas
 5.1. Sincronização de Horário
- Alinha o relógio do sistema com o servidor Binance.

 5.2. Notificações via Telegram
- Informações sobre operações e falhas são enviadas ao usuário.

 5.3. Sistema de Logs
- Todos os eventos são documentados em `Logs/trading_bot.log`.

 6. Execução do Bot
```bash
python Binance_Bot.py
```

 7. Tratamento de Erros
| Erro                                        | Descrição                                  | Solução                                     |
|------------------------------------------------|------------------------------------------------|-------------------------------------------------|
| `APIError(code=-1013): Filter failure: LOT_SIZE` | Quantidade não respeita o tamanho mínimo.      | Ajustar a quantidade conforme `LOT_SIZE`.       |
| `APIError(code=-1100): Illegal characters`      | Quantidade com formato inválido.               | Corrigir o formato da quantidade.              |
| `Ordem abaixo do mínimo permitido`              | Compra inferior ao valor mínimo de $5.00.     | Aumentar saldo ou ajustar valor da ordem.      |

 8. Manutenção e Expansão
- Novos Ativos: Configurar no `market_data.py`.
- Novas Estratégias: Desenvolver no `trading_strategy.py`.
- Gerenciamento de Risco: Ajustar regras conforme necessidade.

 9. Regras Técnicas de Negócio
 9.1. Controle de Risco
- Respeitar o valor mínimo de ordem (`minNotional`).
- Verificar saldo antes de executar ordens.
- Ajustar a quantidade de compra com base no filtro `LOT_SIZE`.

 9.2. Validação de Dados
- Sincronizar horário com o servidor Binance.
- Validar as configurações no `.env` antes da execução.

 9.3. Notificações e Logs
- Registrar todas as operações e erros.
- Notificar o usuário em tempo real sobre o status das ordens.

---
📌 Este manual fornece orientação completa para operação e manutenção do bot de trading automatizado.

✉️ Suporte disponível via Telegram configurado no sistema.

