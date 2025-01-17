import time
import logging
import os
import requests
from dotenv import load_dotenv
from telegram import Bot
import asyncio
import aiohttp
from binance.client import Client
from Modulos.market_data import buscar_noticias, analisar_sentimento, ajustar_variaveis, selecionar_melhores_moedas, verificar_minimo_compra
from Modulos.trading_strategy import calcular_rsi, sinal_rsi
from Modulos.notifications import enviar_alerta, alerta_compra, alerta_venda
from Modulos.logger import configurar_logger

logger = configurar_logger()

# Carregar variáveis de ambiente
load_dotenv(dotenv_path='C:\\Users\\Rodolfo Santana\\Documents\\github\\binancebot\\config\\key.env')

API_KEY = os.getenv('API_KEY')
API_SECRET = os.getenv('API_SECRET')
NEWS_API_KEY = os.getenv('NEWS_API_KEY')
TELEGRAM_API_KEY = os.getenv('TELEGRAM_API_KEY')
TELEGRAM_CHAT_ID = os.getenv('TELEGRAM_CHAT_ID')

# Configuração do log
logging.basicConfig(filename='Logs/trading_bot.log', level=logging.INFO, format='%(asctime)s - %(message)s')

# Bot do Telegram
bot = Bot(token=TELEGRAM_API_KEY)

# Validação das chaves de API
if not API_KEY or not API_SECRET:
    print("❌ Erro: As chaves da API da Binance não foram encontradas.")
    logger.error("As chaves da API da Binance não foram encontradas.")
    exit(1)

if not TELEGRAM_API_KEY or not TELEGRAM_CHAT_ID:
    print("❌ Erro: API Key ou Chat ID do Telegram não encontrados.")
    logger.error("API Key ou Chat ID do Telegram não encontrados.")
    exit(1)

# Cliente Binance
client = Client(API_KEY, API_SECRET, testnet=False)

# 🔄 Sincronização de horário com a Binance
def sincronizar_relogio_binance():
    try:
        server_time = client.get_server_time()
        offset = server_time['serverTime'] - int(time.time() * 1000)
        client.timestamp_offset = offset
        print(f"🕒 Sincronização com a Binance realizada. Offset: {offset}ms")
        logger.info(f"Sincronização com a Binance realizada. Offset: {offset}ms")
    except Exception as e:
        print(f"❌ Erro ao sincronizar o horário: {e}")
        logger.error(f"Erro ao sincronizar o horário com a Binance: {e}")

sincronizar_relogio_binance()

# 📲 Função para enviar mensagens para o Telegram
async def enviar_mensagem_telegram(mensagem):
    url = f"https://api.telegram.org/bot{TELEGRAM_API_KEY}/sendMessage"
    payload = {
        'chat_id': TELEGRAM_CHAT_ID,
        'text': mensagem
    }

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, data=payload, timeout=aiohttp.ClientTimeout(total=10)) as response:
                if response.status != 200:
                    print(f"⚠️ Falha ao enviar mensagem. Status: {response.status}")
                    logger.error(f"Falha ao enviar mensagem para o Telegram. Status: {response.status}")
                else:
                    print("📩 Mensagem enviada com sucesso!")
    except asyncio.TimeoutError:
        print("⏳ Timeout ao tentar enviar mensagem para o Telegram.")
        logger.error("Timeout ao enviar mensagem para o Telegram.")
    except RuntimeError as e:
        print(f"⚠️ Erro no loop assíncrono: {e}")
        logger.error(f"Erro no loop assíncrono: {e}")
    except Exception as e:
        print(f"❌ Erro ao enviar mensagem: {e}")
        logger.error(f"Erro ao enviar mensagem para o Telegram: {e}")

# Verificar saldo
def verificar_saldo():
    try:
        saldo = client.get_asset_balance(asset='USDT')
        print(f"💰 Saldo USDT: {saldo['free']}")
        return float(saldo['free'])
    except Exception as e:
        print(f"❌ Erro ao verificar saldo: {e}")
        logger.error(f"Erro ao verificar saldo: {e}")
        sincronizar_relogio_binance()
        return 0.0

# Buscar preço atual
def buscar_preco(par_moeda):
    try:
        ticker = client.get_symbol_ticker(symbol=par_moeda)
        print(f"💹 Preço atual de {par_moeda}: {ticker['price']}")
        return float(ticker['price'])
    except Exception as e:
        print(f"❌ Erro ao buscar preço de {par_moeda}: {e}")
        logger.error(f"Erro ao buscar preço de {par_moeda}: {e}")
        return 0.0

# Ajustar quantidade com base no LOT_SIZE
def ajustar_quantidade(moeda, quantidade):
    try:
        exchange_info = client.get_symbol_info(moeda)
        for filtro in exchange_info['filters']:
            if filtro['filterType'] == 'LOT_SIZE':
                step_size = float(filtro['stepSize'])
                casas_decimais = abs(int(format(step_size, 'e').split('e-')[1]))
                quantidade_corrigida = round(quantidade - (quantidade % step_size), casas_decimais)
                return format(quantidade_corrigida, f'.{casas_decimais}f')
    except Exception as e:
        logger.error(f"Erro ao ajustar a quantidade para {moeda}: {e}")
        print(f"❌ Erro ao ajustar quantidade para {moeda}: {e}")
    return quantidade

# Verificar o mínimo de compra permitido para a moeda
async def verificar_minimo_compra(par_moeda):
    try:
        exchange_info = client.get_symbol_info(par_moeda)
        if exchange_info is None:
            logger.error(f"Par de moedas {par_moeda} não encontrado na Binance.")
            return None
        for filtro in exchange_info['filters']:
            if filtro['filterType'] == 'MIN_NOTIONAL':
                min_notional = float(filtro['minNotional'])
                logger.info(f"MinNotional para {par_moeda}: {min_notional}")
                return min_notional
    except Exception as e:
        logger.error(f"Erro ao verificar mínimo de compra para {par_moeda}: {e}")
        return None

# 📊 Função principal
async def executar_bot():
    saldo = verificar_saldo()
    if saldo <= 0.01:
        await enviar_mensagem_telegram("❌ Saldo insuficiente para operação.")
        return

    noticias_gerais = await buscar_noticias()
    sentimento_geral = analisar_sentimento(noticias_gerais)
    moedas_selecionadas = selecionar_melhores_moedas(sentimento_geral)
    saldo_por_moeda = saldo / len(moedas_selecionadas)

    for moeda in moedas_selecionadas:
        preco_atual = buscar_preco(moeda)
        min_notional = await verificar_minimo_compra(moeda)
        valor_ordem = saldo_por_moeda

        # Verificar se o valor da ordem é maior ou igual ao mínimo permitido
        if min_notional is None or valor_ordem < min_notional:
            mensagem = f"⚠️ Ordem para {moeda} abaixo do mínimo permitido ({min_notional}). Valor da ordem: {valor_ordem:.2f}"
            await enviar_mensagem_telegram(mensagem)
            logger.warning(mensagem)
            continue

        # Ajustar quantidade de acordo com o stepSize
        quantidade = ajustar_quantidade(moeda, valor_ordem / preco_atual)
        if float(quantidade) <= 0:
            mensagem = f"⚠️ Quantidade ajustada para {moeda} é inválida: {quantidade}"
            await enviar_mensagem_telegram(mensagem)
            logger.warning(mensagem)
            continue

        try:
            ordem = client.order_market_buy(symbol=moeda, quantity=quantidade)
            await enviar_mensagem_telegram(f"🟢 Compra realizada de {moeda}: {ordem}")
        except Exception as e:
            mensagem = f"❌ Erro ao comprar {moeda}: {e}"
            await enviar_mensagem_telegram(mensagem)
            logger.error(mensagem)

if __name__ == "__main__":
    while True:
        asyncio.run(executar_bot())
        time.sleep(30)
