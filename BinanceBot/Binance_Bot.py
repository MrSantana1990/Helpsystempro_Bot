import time
import logging
import os
import yaml
import asyncio
import aiohttp
from dotenv import load_dotenv
from datetime import datetime, timezone
from telegram import Bot
from binance.client import Client

from Modulos.market_data import buscar_noticias, analisar_sentimento, ajustar_variaveis, selecionar_melhores_moedas
from Modulos.trading_strategy import calcular_rsi, sinal_rsi
from Modulos.notifications import enviar_alerta, alerta_compra, alerta_venda
from Modulos.logger import configurar_logger
from Modulos.order_manager import verificar_minimo_compra, ajustar_quantidade, executar_compra

# Configurar logger com rotação diária
logger = configurar_logger()

# Carregar configurações
def carregar_config():
    with open('configs/settings.yml', 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)

config = carregar_config()

# Carregar variáveis de ambiente
load_dotenv('configs/keys.env')

API_KEY = os.getenv('API_KEY')
API_SECRET = os.getenv('API_SECRET')
TELEGRAM_API_KEY = os.getenv('TELEGRAM_API_KEY')
TELEGRAM_CHAT_ID = os.getenv('TELEGRAM_CHAT_ID')

bot = Bot(token=TELEGRAM_API_KEY)
client = Client(API_KEY, API_SECRET, testnet=config.get('testnet', False))


# 🔄 Sincronização de horário com retry/backoff
def sincronizar_relogio_binance():
    tentativas = 3
    for tentativa in range(tentativas):
        try:
            server_time = client.get_server_time()
            offset = server_time['serverTime'] - int(time.time() * 1000)
            client.timestamp_offset = offset
            logger.info(f"🕒 Sincronização com a Binance realizada. Offset: {offset}ms")
            return
        except Exception as e:
            logger.warning(f"Erro ao sincronizar relógio (tentativa {tentativa + 1}/{tentativas}): {e}")
            time.sleep(5)
    logger.error("❌ Falha ao sincronizar relógio após múltiplas tentativas.")
sincronizar_relogio_binance()


# 📲 Enviar mensagem para Telegram
async def enviar_mensagem_telegram(mensagem):
    url = f"https://api.telegram.org/bot{TELEGRAM_API_KEY}/sendMessage"
    payload = {'chat_id': TELEGRAM_CHAT_ID, 'text': mensagem}

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, data=payload, timeout=aiohttp.ClientTimeout(total=10)) as response:
                if response.status != 200:
                    logger.error(f"Erro ao enviar mensagem para Telegram. Status: {response.status}")
    except Exception as e:
        logger.error(f"Erro ao enviar mensagem para Telegram: {e}")


# 📊 Verificar saldo disponível
def verificar_saldo():
    try:
        saldo = client.get_asset_balance(asset='USDT')
        logger.info(f"💰 Saldo USDT: {saldo['free']}")
        return float(saldo['free'])
    except Exception as e:
        logger.error(f"Erro ao verificar saldo: {e}")
        sincronizar_relogio_binance()
        return 0.0


# 📈 Buscar preço atual do par
def buscar_preco(par_moeda):
    try:
        ticker = client.get_symbol_ticker(symbol=par_moeda)
        return float(ticker['price'])
    except Exception as e:
        logger.error(f"Erro ao buscar preço de {par_moeda}: {e}")
        return 0.0


# ⏰ Verificar se está dentro do horário estratégico
def dentro_horario_estrategico():
    hora_atual = datetime.now(timezone.utc).hour
    horarios = config.get('horarios_estrategicos', [])
    return any(hora_inicio <= hora_atual < hora_fim for hora_inicio, hora_fim in horarios)


# 📊 Calcular PnL Diário
def calcular_pnl(saldo_inicial, saldo_atual):
    pnl = saldo_atual - saldo_inicial
    percentual_pnl = (pnl / saldo_inicial) * 100
    logger.info(f"📊 PnL Diário: {pnl:.2f} USDT ({percentual_pnl:.2f}%)")
    return pnl, percentual_pnl


# 🚀 Função Principal
async def executar_bot():
    if not dentro_horario_estrategico():
        logger.info("Fora do horário estratégico. Aguardando...")
        await enviar_mensagem_telegram("⏳ Fora do horário estratégico. Bot pausado.")
        time.sleep(config.get('intervalo_pausa', 300))  # Padrão 5 minutos
        return

    saldo_inicial = verificar_saldo()
    if saldo_inicial <= 0.01:
        await enviar_mensagem_telegram("❌ Saldo insuficiente para operar.")
        logger.warning("Saldo insuficiente.")
        return

    noticias = await buscar_noticias()
    sentimento_geral = analisar_sentimento(noticias)

    logger.info(f"Sentimento geral: {sentimento_geral:.2f}")
    await enviar_mensagem_telegram(f"📰 Sentimento do mercado: {sentimento_geral:.2f}")

    moedas = selecionar_melhores_moedas(client, sentimento_geral, saldo_inicial)
    await enviar_mensagem_telegram(f"📊 Moedas selecionadas: {', '.join(moedas)}")

    saldo_por_moeda = max(saldo_inicial / max(len(moedas), 1), 5)

    for moeda in moedas:
        preco_atual = buscar_preco(moeda)
        await executar_compra(client, moeda, saldo_por_moeda, preco_atual, enviar_mensagem_telegram)

    saldo_final = verificar_saldo()
    pnl, percentual_pnl = calcular_pnl(saldo_inicial, saldo_final)

    await enviar_mensagem_telegram(f"📊 PnL do dia: {pnl:.2f} USDT ({percentual_pnl:.2f}%)")
    logger.info(f"📊 PnL Final: {pnl:.2f} USDT ({percentual_pnl:.2f}%)")


# 🔄 Loop de Execução
if __name__ == "__main__":
    intervalo_execucao = config.get('intervalo_execucao', 30)  # Padrão 30 segundos
    while True:
        asyncio.run(executar_bot())
        time.sleep(intervalo_execucao)
