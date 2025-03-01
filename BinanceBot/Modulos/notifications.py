from telegram import Bot
import os
import asyncio
import logging
from dotenv import load_dotenv

# Configurar logger
logger = logging.getLogger(__name__)

# Carregar credenciais do Telegram
load_dotenv(os.path.join(os.path.dirname(__file__), '../Configs/key.env'))  # Corrigido caminho

TELEGRAM_API_KEY = os.getenv('TELEGRAM_API_KEY')
TELEGRAM_CHAT_ID = os.getenv('TELEGRAM_CHAT_ID')

if not TELEGRAM_API_KEY or not TELEGRAM_CHAT_ID:
    raise ValueError("❌ TELEGRAM_API_KEY ou TELEGRAM_CHAT_ID não configurado corretamente no arquivo key.env")

bot = Bot(token=TELEGRAM_API_KEY)

# Definir limite de notificações por minuto
NOTIFICACOES_POR_MINUTO = 10
historico_notificacoes = []

# ----------------- GERENCIAMENTO DE NOTIFICAÇÕES -----------------

async def enviar_alerta(mensagem, tipo="INFO"):
    icones = {"INFO": "ℹ️", "ALERTA": "⚠️", "CRÍTICO": "❌"}
    mensagem_formatada = f"{icones.get(tipo, 'ℹ️')} {mensagem}"

    if len(historico_notificacoes) >= NOTIFICACOES_POR_MINUTO:
        logger.warning("⚠️ Limite de notificações por minuto atingido. Mensagem não enviada.")
        return

    try:
        await bot.send_message(chat_id=TELEGRAM_CHAT_ID, text=mensagem_formatada)
        historico_notificacoes.append(mensagem)
        asyncio.create_task(limpar_historico())
        logger.info(f"📩 Notificação enviada: {mensagem_formatada}")
    except Exception as e:
        logger.error(f"❌ Erro ao enviar mensagem para Telegram: {e}")

async def limpar_historico():
    await asyncio.sleep(60)
    if historico_notificacoes:
        historico_notificacoes.pop(0)

async def alerta_compra(moeda, preco, quantidade):
    mensagem = f"🟢 *COMPRA REALIZADA*\n📌 Moeda: {moeda}\n💰 Preço: {preco:.2f} USDT\n📊 Quantidade: {quantidade}"
    await enviar_alerta(mensagem, "ALERTA")

async def alerta_venda(moeda, preco, quantidade):
    mensagem = f"🔴 *VENDA REALIZADA*\n📌 Moeda: {moeda}\n💰 Preço: {preco:.2f} USDT\n📊 Quantidade: {quantidade}"
    await enviar_alerta(mensagem, "ALERTA")

async def alerta_erro(mensagem_erro):
    mensagem = f"❌ *ERRO DETECTADO*\n{mensagem_erro}"
    await enviar_alerta(mensagem, "CRÍTICO")

async def alerta_pnl(pnl, percentual):
    emoji = "📈" if pnl > 0 else "📉"
    mensagem = f"{emoji} *PNL Diário*\n💰 Lucro/Prejuízo: {pnl:.2f} USDT\n📊 Variação: {percentual:.2f}%"
    await enviar_alerta(mensagem, "INFO")
