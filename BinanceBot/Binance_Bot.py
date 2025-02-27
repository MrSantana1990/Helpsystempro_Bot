import time
import logging
import os
import requests
from dotenv import load_dotenv
from telegram import Bot
import asyncio
import aiohttp
from datetime import datetime
from binance.client import Client
from Modulos.market_data import buscar_noticias, analisar_sentimento, ajustar_variaveis, selecionar_melhores_moedas
from Modulos.trading_strategy import calcular_rsi, sinal_rsi
from Modulos.notifications import enviar_alerta, alerta_compra, alerta_venda
from Modulos.logger import configurar_logger
from Modulos.order_manager import verificar_minimo_compra, ajustar_quantidade, executar_compra
from datetime import datetime, timezone

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
    payload = {'chat_id': TELEGRAM_CHAT_ID, 'text': mensagem}

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, data=payload, timeout=aiohttp.ClientTimeout(total=10)) as response:
                if response.status != 200:
                    logger.error(f"Falha ao enviar mensagem para o Telegram. Status: {response.status}")
                else:
                    logger.info("📩 Mensagem enviada com sucesso!")
    except Exception as e:
        logger.error(f"Erro ao enviar mensagem para o Telegram: {e}")

# Verificar saldo
def verificar_saldo():
    try:
        saldo = client.get_asset_balance(asset='USDT')
        logger.info(f"💰 Saldo USDT: {saldo['free']}")
        return float(saldo['free'])
    except Exception as e:
        logger.error(f"Erro ao verificar saldo: {e}")
        sincronizar_relogio_binance()
        return 0.0

# Buscar preço atual
def buscar_preco(par_moeda):
    try:
        ticker = client.get_symbol_ticker(symbol=par_moeda)
        return float(ticker['price'])
    except Exception as e:
        logger.error(f"Erro ao buscar preço de {par_moeda}: {e}")
        return 0.0

# Verificar se está dentro do horário estratégico
def dentro_horario_estrategico():
    from datetime import datetime, timezone
    hora_atual = datetime.now(timezone.utc).hour
    return (9 <= hora_atual < 12) or (23 <= hora_atual < 2)

# Monitorar lucro diário
def calcular_pnl(saldo_inicial, saldo_atual):
    pnl = saldo_atual - saldo_inicial
    percentual_pnl = (pnl / saldo_inicial) * 100
    logger.info(f"📈 PnL Diário: {pnl:.2f} USDT ({percentual_pnl:.2f}%)")
    return pnl, percentual_pnl

# 📊 Função principal
async def executar_bot():
    # Verificar se está dentro do horário estratégico
    if not dentro_horario_estrategico():
        logger.info("Fora do horário estratégico. Aguardando...")
        await enviar_mensagem_telegram("⏳ Fora do horário estratégico. Bot pausado.")
        time.sleep(300)  # Pausa de 5 minutos
        return

    saldo_inicial = verificar_saldo()
    if saldo_inicial <= 0.01:
        await enviar_mensagem_telegram("❌ Saldo insuficiente para operação.")
        logger.warning("Saldo insuficiente para operação.")
        return

    noticias_gerais = await buscar_noticias()
    sentimento_geral = analisar_sentimento(noticias_gerais)
    logger.info(f"Sentimento geral das notícias: {sentimento_geral}")
    await enviar_mensagem_telegram(f"📰 Sentimento geral das notícias: {sentimento_geral:.2f}")

    moedas_selecionadas = selecionar_melhores_moedas(client, sentimento_geral, saldo_inicial)
    logger.info(f"Melhores moedas para negociação: {moedas_selecionadas}")
    await enviar_mensagem_telegram(f"💹 Melhores moedas para negociação: {', '.join(moedas_selecionadas)}")

    saldo_por_moeda = max(saldo_inicial / len(moedas_selecionadas), 5)
    for moeda in moedas_selecionadas:
        preco_atual = buscar_preco(moeda)
        await executar_compra(client, moeda, saldo_por_moeda, preco_atual, enviar_mensagem_telegram)

    saldo_final = verificar_saldo()
    pnl, percentual_pnl = calcular_pnl(saldo_inicial, saldo_final)

    mensagem_pnl = f"📊 PnL do dia: {pnl:.2f} USDT ({percentual_pnl:.2f}%)"
    await enviar_mensagem_telegram(mensagem_pnl)
    logger.info(mensagem_pnl)

if __name__ == "__main__":
    while True:
        asyncio.run(executar_bot())
        time.sleep(30)
