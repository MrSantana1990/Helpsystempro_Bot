from telegram import Bot
import os
from dotenv import load_dotenv

load_dotenv('config/key.env')
TELEGRAM_API_KEY = os.getenv('TELEGRAM_API_KEY')
TELEGRAM_CHAT_ID = os.getenv('TELEGRAM_CHAT_ID')
bot = Bot(token=TELEGRAM_API_KEY)

async def enviar_alerta(mensagem):
    try:
        await bot.send_message(chat_id=TELEGRAM_CHAT_ID, text=mensagem)
    except Exception as e:
        print(f"Erro ao enviar mensagem: {e}")

async def alerta_compra(moeda, preco, quantidade):
    mensagem = f"🟢 COMPRA REALIZADA\nMoeda: {moeda}\nPreço: {preco}\nQuantidade: {quantidade}"
    await enviar_alerta(mensagem)

async def alerta_venda(moeda, preco, quantidade):
    mensagem = f"🔴 VENDA REALIZADA\nMoeda: {moeda}\nPreço: {preco}\nQuantidade: {quantidade}"
    await enviar_alerta(mensagem)
