import time
import logging
import os
import requests
from dotenv import load_dotenv
from telegram import Bot
import asyncio
from binance.client import Client
from Modulos.market_data import buscar_noticias, analisar_sentimento, ajustar_variaveis, selecionar_melhores_moedas, verificar_minimo_compra
from Modulos.trading_strategy import calcular_rsi, sinal_rsi
from Modulos.notifications import enviar_alerta, alerta_compra, alerta_venda
from Modulos.logger import configurar_logger
logger = configurar_logger()

# Carregar variáveis de ambiente
load_dotenv(dotenv_path='C:\\Users\\Rodolfo Santana\\Documents\\github\\binancebot\\config\\key.env')

# Verificando se as variáveis de ambiente foram carregadas corretamente
API_KEY = os.getenv('API_KEY')
API_SECRET = os.getenv('API_SECRET')
NEWS_API_KEY = os.getenv('NEWS_API_KEY')
TELEGRAM_API_KEY = os.getenv('TELEGRAM_API_KEY')
TELEGRAM_CHAT_ID = os.getenv('TELEGRAM_CHAT_ID')

# Configuração do log
logging.basicConfig(filename='trading_bot.log', level=logging.INFO, format='%(asctime)s - %(message)s')

# Criar instância do bot do Telegram
bot = Bot(token=TELEGRAM_API_KEY)

# Verificando se as variáveis de ambiente foram carregadas corretamente
if not API_KEY or not API_SECRET:
    print("Erro: As chaves da API da Binance não foram encontradas.")
    logging.error("As chaves da API da Binance não foram encontradas.")
    exit(1)

if not NEWS_API_KEY:
    print("Erro: API Key da NewsAPI não encontrada. Verifique o arquivo .env.")
    logging.error("API Key da NewsAPI não encontrada. Verifique o arquivo .env.")
    exit(1)

if not TELEGRAM_API_KEY or not TELEGRAM_CHAT_ID:
    print("Erro: API Key ou Chat ID do Telegram não encontrados.")
    logging.error("API Key ou Chat ID do Telegram não encontrados.")
    exit(1)

# Cliente Binance
client = Client(API_KEY, API_SECRET, testnet=False)

# 🔄 Função para sincronizar o horário com a Binance
def sincronizar_relogio_binance():
    try:
        server_time = client.get_server_time()
        offset = server_time['serverTime'] - int(time.time() * 1000)
        client.timestamp_offset = offset
        print(f"🕒 Sincronização de horário com a Binance realizada. Offset aplicado: {offset}ms")
        logging.info(f"Sincronização de horário com a Binance realizada. Offset aplicado: {offset}ms")
    except Exception as e:
        print(f"Erro ao sincronizar o horário com a Binance: {e}")
        logging.error(f"Erro ao sincronizar o horário com a Binance: {e}")

# Sincroniza o horário ao iniciar
sincronizar_relogio_binance()

# Função assíncrona para enviar mensagens via Telegram
async def enviar_mensagem_telegram(mensagem):
    try:
        await bot.send_message(chat_id=TELEGRAM_CHAT_ID, text=mensagem)
    except Exception as e:
        print(f"Erro ao enviar mensagem para o Telegram: {e}")
        logging.error(f"Erro ao enviar mensagem para o Telegram: {e}")

# Função para verificar saldo disponível
def verificar_saldo():
    try:
        saldo = client.get_asset_balance(asset='USDT')
        print(f"Saldo USDT: {saldo['free']}")
        return float(saldo['free'])
    except Exception as e:
        print(f"Erro ao verificar saldo: {e}")
        logging.error(f"Erro ao verificar saldo: {e}")
        sincronizar_relogio_binance()  # ✅ Sincroniza o horário se ocorrer erro de timestamp
        return 0.0

# Função para buscar preço de uma moeda
def buscar_preco(par_moeda):
    try:
        ticker = client.get_symbol_ticker(symbol=par_moeda)
        print(f"Preço atual de {par_moeda}: {ticker['price']}")
        return float(ticker['price'])
    except Exception as e:
        print(f"Erro ao buscar preço de {par_moeda}: {e}")
        logging.error(f"Erro ao buscar preço de {par_moeda}: {e}")
        return 0.0

# Função principal assíncrona
async def executar_bot():
    tentativas = 0
    while tentativas < 5:
        try:
            saldo = verificar_saldo()
            if saldo <= 0.01:
                print("Saldo insuficiente para operação.")
                logging.info("Saldo insuficiente para operação.")
                await enviar_mensagem_telegram("Saldo insuficiente para operação.")
                return

            # Buscar notícias de várias fontes
            noticias_gerais = await buscar_noticias()
            sentimento_geral = analisar_sentimento(noticias_gerais)

            # Seleção de moedas
            moedas_selecionadas = selecionar_melhores_moedas(sentimento_geral)
            saldo_por_moeda = saldo / len(moedas_selecionadas)

            for moeda in moedas_selecionadas:
                preco_atual = buscar_preco(moeda)
                decisao, risco = ajustar_variaveis(sentimento_geral)
                minimo_compra = await verificar_minimo_compra(moeda)

                if saldo_por_moeda >= risco * preco_atual:
                    quantidade = max((saldo_por_moeda * risco) / preco_atual, minimo_compra)
                    try:
                        ordem = client.order_market_buy(symbol=moeda, quantity=round(quantidade, 6))
                        print(f"Compra realizada de {moeda}: {ordem}")
                        logging.info(f"Compra realizada de {moeda}: {ordem}")
                        await enviar_mensagem_telegram(f"Compra realizada de {moeda}: {ordem}")
                    except Exception as e:
                        print(f"Erro ao comprar {moeda}: {e}")
                        logging.error(f"Erro ao comprar {moeda}: {e}")
                        await enviar_mensagem_telegram(f"Erro ao comprar {moeda}: {e}")
            tentativas = 0  # Resetar tentativas após sucesso

        except Exception as e:
            tentativas += 1
            logging.error(f"Erro ao executar bot: {e}")
            if tentativas == 5:
                await enviar_mensagem_telegram("Erro crítico no bot, por favor, revise o log.")
                break
            await asyncio.sleep(60)

# Execução contínua do bot
if __name__ == "__main__":
    while True:
        asyncio.run(executar_bot())
        time.sleep(30)
