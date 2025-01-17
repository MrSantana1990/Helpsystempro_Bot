import pandas as pd
import numpy as np
from binance.client import Client

# Função para calcular o RSI
def calcular_rsi(fechamentos, periodo=14):
    delta = fechamentos.diff()
    ganho = delta.where(delta > 0, 0)
    perda = -delta.where(delta < 0, 0)
    
    media_ganho = ganho.rolling(window=periodo).mean()
    media_perda = perda.rolling(window=periodo).mean()

    rs = media_ganho / media_perda
    rsi = 100 - (100 / (1 + rs))
    return rsi

# Função para sinal de compra/venda com RSI
def sinal_rsi(client, par_moeda):
    klines = client.get_klines(symbol=par_moeda, interval=Client.KLINE_INTERVAL_1HOUR, limit=100)
    fechamentos = pd.Series([float(kline[4]) for kline in klines])
    
    rsi = calcular_rsi(fechamentos).iloc[-1]
    print(f"RSI de {par_moeda}: {rsi}")
    
    if rsi < 30:
        return 'compra'
    elif rsi > 70:
        return 'venda'
    else:
        return 'aguardar'
