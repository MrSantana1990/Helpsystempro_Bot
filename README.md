 📖 Manual Completo do Sistema de Trading Automatizado - Binance Bot

 1. Introdução
Este manual detalha o funcionamento do sistema de trading automatizado desenvolvido para a Binance. O bot realiza análises de mercado, verifica tendências de notícias e executa operações de compra de criptomoedas com base em estratégias predefinidas, incluindo critérios avançados de seleção de moedas e gerenciamento de risco.

 2. Instalação e Configuração

 2.1. Requisitos
- Tecnológicos:
  - Python 3.10 ou superior
  - Conta na Binance (API Key e Secret)
  - Conta no Telegram (Bot API Key e Chat ID)
  - Pacotes Python:
    - `python-binance`
    - `python-telegram-bot`
    - `aiohttp`
    - `python-dotenv`
    - `requests`
    - `textblob`
    - `pandas`
    - `numpy`

 2.2. Configuração de Ambiente
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
│   ├── order_manager.py
│   └── risk_management.py
├── config/
│   └── key.env
└── Logs/
    └── trading_bot.log
```

 4. Regras de Negócio

 4.1. Estratégia de Negociação
- Análise de Sentimento: O bot busca e analisa notícias relacionadas a criptomoedas utilizando a API NewsAPI para determinar o sentimento do mercado (positivo, neutro ou negativo).
- Seleção de Ativos:
  - Moedas como BTCUSDT, ETHUSDT, XRPUSDT, BNBUSDT, DOGEUSDT e SOLUSDT são avaliadas dinamicamente com base em critérios como sentimento, volume e variação percentual.
  - Moedas em baixa podem ser priorizadas para estratégias de "compra na baixa".
- Gestão de Risco:
  - Cada ordem respeita o valor mínimo de compra (`minNotional`) definido pela Binance (mínimo de $5.00 por operação).
  - Implementação de Stop-Loss e Take-Profit automáticos para limitar perdas e garantir lucros.

 4.2. Execução de Ordens
- Compra:
  - As ordens de compra são realizadas no mercado quando condições de análise técnica (RSI, Bollinger Bands) e sentimento são favoráveis.
  - Antes de executar a compra, verifica-se:
    - Se o saldo é suficiente.
    - Se o valor da ordem atende ao mínimo permitido (`minNotional`).
    - Se a quantidade respeita o filtro `LOT_SIZE`.
- Falhas:
  - Erros durante a validação ou execução de ordens são registrados no log e notificados ao usuário via Telegram.

 4.3. Alocação Dinâmica de Moedas
- Critérios Dinâmicos:
  - Seleção automática das melhores moedas com base em análises de sentimento, variação percentual de preço e volume nas últimas 24 horas.
  - Monitoramento contínuo das condições do mercado e ajuste da estratégia em tempo real.

 4.4. Integração de Stop-Loss e Take-Profit
- Stop-Loss: Configurado para ativar uma venda quando a perda ultrapassa o percentual definido.
- Take-Profit: Configurado para realizar lucros automaticamente ao atingir o percentual de ganho desejado.

 4.5. Taxas e Custos
- Taxas de Transação: Todas as operações levam em consideração as taxas cobradas pela Binance para garantir que o lucro líquido seja positivo.

 5. Funcionalidades

 5.1. Sincronização de Horário
- Sincroniza o horário local com o servidor da Binance para evitar erros de timestamp durante as operações.

 5.2. Envio de Notificações
- Notificações são enviadas via Telegram para informar:
  - Saldo disponível.
  - Moedas selecionadas para operação.
  - Resultado de ordens executadas.
  - Alertas de erros ou condições especiais no mercado.

 5.3. Registro de Logs
- Todas as ações e erros são registrados em `Logs/trading_bot.log` para auditoria e análise.

 5.4. Gerenciamento de Risco
- Integração de estratégias de Stop-Loss e Take-Profit para limitar perdas e garantir lucros.
- Avaliação constante do mercado para ajustar as estratégias.

 6. Execução do Bot
Para iniciar o bot, utilize o seguinte comando:
```bash
python Binance_Bot.py
```
O bot executará verificações periódicas e tomará decisões de compra com base nas condições de mercado.

 7. Possíveis Erros e Soluções
| Erro                                        | Descrição                                              | Solução                                               |
|------------------------------------------------|------------------------------------------------------------|-----------------------------------------------------------|
| `APIError(code=-1013): Filter failure: LOT_SIZE` | A quantidade de compra não respeita o tamanho mínimo.       | Ajustar o cálculo da quantidade para respeitar o `LOT_SIZE`. |
| `APIError(code=-1100): Illegal characters`      | Quantidade com formato inválido.                           | Garantir que a quantidade seja formatada corretamente.      |
| `Ordem abaixo do mínimo permitido`              | Valor da compra abaixo de $5.00.                          | Adicionar mais saldo ou ajustar o valor da compra.          |
| `Moeda não encontrada ou sem filtros disponíveis` | O par de moedas não está listado ou possui filtros faltando. | Verificar se o par é suportado e os filtros necessários estão disponíveis. |

 8. Manutenção e Expansão

 8.1. Adicionar Novos Pares de Moedas
- Atualizar o módulo `market_data.py` para incluir novas moedas no conjunto inicial de avaliação.
- Implementar validações para garantir que novos pares respeitem os critérios de seleção e execução.

 8.2. Melhorar Estratégias de Negociação
- Implementar novos indicadores técnicos (ex.: MACD, Volume Oscillator).
- Ajustar parâmetros de RSI e Bollinger Bands conforme o comportamento do mercado.

 8.3. Gerenciamento de Risco Avançado
- Introduzir estratégias de hedge para minimizar perdas em mercados voláteis.
- Implementar algoritmos para recalcular o Stop-Loss e Take-Profit dinamicamente.

---

📌 Este manual foi desenvolvido para garantir o uso seguro e eficaz do bot de trading automatizado.

✉️ Para dúvidas ou suporte, entre em contato pelo Telegram configurado no bot.

